/**
 * @file wageringService.ts
 * @description Production Server-Side Wagering Progression Engine for PLAY369 Task 5.1.
 * 
 * Invariants & Architecture Guarantees:
 * 1. Single PostgreSQL ACID Transaction: Lock active wagering requirement via SELECT ... FOR UPDATE,
 *    validate authoritative settled BET source, insert progression event, and update turnover atomically.
 * 2. Strict Qualification Rules: Only committed/settled BET transactions with positive amounts
 *    belonging to the same user count toward wagering turnover. Excludes WIN, REFUND, PROMO,
 *    failed/pending bets, demo stakes, and free-spin stakes.
 * 3. Exact Scale-4 BigInt Arithmetic: Pure integer minor-unit arithmetic (1.0000 = 10000n).
 *    Zero floating-point representations or imprecise arithmetic.
 * 4. Deterministic Idempotency: Unique constraint on (wagering_requirement_id, source_transaction_id)
 *    ensures replayed or duplicate bet transactions increment turnover zero extra times.
 * 5. Turnover Capping & Completion: Completed turnover is capped at targetTurnoverAmount.
 *    When target is reached: status transitions to 'COMPLETED' with completed_at = NOW().
 * 6. Expiry Enforcement: If expires_at <= NOW(), active requirement is automatically marked 'EXPIRED'
 *    and receives zero further progression.
 */

import { eq, and, sql, lte, gt } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { wageringRequirements, wageringProgressEvents, transactions, users } from '../../db/schema.js';

/**
 * Pure integer minor-units decimal arithmetic (scale 4, 1.0000 = 10000n)
 * Guarantees zero JavaScript floating-point representation errors.
 */
export const toScale4 = (val: string | number | bigint): bigint => {
  if (typeof val === 'bigint') return val;
  const s = typeof val === 'number' ? val.toFixed(4) : String(val).trim();
  const [intPart = '0', fracPart = ''] = s.split('.');
  const paddedFrac = fracPart.padEnd(4, '0').slice(0, 4);
  const isNeg = intPart.startsWith('-');
  const cleanInt = isNeg ? intPart.slice(1) : intPart;
  const combined = BigInt((cleanInt || '0') + paddedFrac);
  return isNeg ? -combined : combined;
};

export const fromScale4 = (val: bigint): string => {
  const isNeg = val < 0n;
  const abs = isNeg ? -val : val;
  const str = abs.toString().padStart(5, '0');
  const intPart = str.slice(0, -4) || '0';
  const fracPart = str.slice(-4);
  return `${isNeg ? '-' : ''}${intPart}.${fracPart}`;
};

export interface ProcessWageringBetParams {
  userId: number;
  sourceTransactionId: string;
  amount?: string | number | bigint;
  currency?: string;
  requirementId?: number; // Target specific requirement, or default to oldest active
  tx?: any;
}

export interface WageringProgressionResult {
  success: boolean;
  duplicate?: boolean;
  noActiveRequirement?: boolean;
  reason?: string;
  requirementId?: number;
  userId: number;
  sourceTransactionId: string;
  qualifiedAmount?: string;
  previousCompletedTurnover?: string;
  completedTurnover?: string;
  targetTurnover?: string;
  status?: string;
  completed?: boolean;
  completedAt?: Date | null;
  message?: string;
}

export interface CreateWageringRequirementParams {
  userId: number;
  promoName: string;
  bonusAmountGranted: string | number | bigint;
  requiredMultiplier?: number;
  expiryDays?: number;
  expiryHours?: number;
  expiresAt?: Date;
  tx?: any;
}

export interface WageringRequirementRecord {
  id: number;
  userId: number;
  promoName: string;
  bonusAmountGranted: string;
  requiredMultiplier: number;
  targetTurnoverAmount: string;
  completedTurnoverAmount: string;
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  expiresAt: Date;
  createdAt: Date;
  completedAt: Date | null;
}

export class WageringService {
  /**
   * Processes an authoritative BET transaction toward the user's active wagering requirement.
   * Executes entirely within a single PostgreSQL ACID transaction with row-level locks.
   */
  public static async processAuthoritativeBet(
    params: ProcessWageringBetParams
  ): Promise<WageringProgressionResult> {
    if (!params.userId || typeof params.userId !== 'number' || params.userId <= 0) {
      throw new Error('Valid numeric userId is required');
    }
    if (
      !params.sourceTransactionId ||
      typeof params.sourceTransactionId !== 'string' ||
      params.sourceTransactionId.trim() === ''
    ) {
      throw new Error('sourceTransactionId is required for wagering progression');
    }

    const runner = async (tx: any): Promise<WageringProgressionResult> => {
      // 1. Authoritative Source BET Validation with Row Lock
      const [betTx] = await tx
        .select()
        .from(transactions)
        .where(eq(transactions.transactionId, params.sourceTransactionId))
        .for('update');

      if (!betTx) {
        return {
          success: false,
          reason: 'SOURCE_TRANSACTION_NOT_FOUND',
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId
        };
      }

      if (betTx.userId !== params.userId) {
        return {
          success: false,
          reason: 'TRANSACTION_USER_MISMATCH',
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId
        };
      }

      if (betTx.type !== 'BET') {
        return {
          success: false,
          reason: 'INVALID_TRANSACTION_TYPE',
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId
        };
      }

      const isSettled = betTx.status === 'COMPLETED' || betTx.status === 'SETTLED';
      if (!isSettled) {
        return {
          success: false,
          reason: 'TRANSACTION_NOT_SETTLED',
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId
        };
      }

      // Metadata exclusion check (free spins, promo/demo stakes)
      const meta = betTx.metadata as any;
      if (
        meta &&
        (meta.freeSpin === true ||
          meta.isFreeSpin === true ||
          meta.source === 'FREE_SPIN' ||
          meta.isPromo === true ||
          meta.demo === true ||
          meta.isDemo === true ||
          meta.promotional === true)
      ) {
        return {
          success: false,
          reason: 'EXCLUDED_PROMOTIONAL_STAKE',
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId
        };
      }

      const authoritativeAmount = String(betTx.amount);
      const authoritativeCurrency = betTx.currency || 'BDT';

      // 2. Validate Scale-4 Amount & Caller Consistency
      const qualifiedAmountScale4 = toScale4(authoritativeAmount);
      if (qualifiedAmountScale4 <= 0n) {
        return {
          success: false,
          reason: 'INVALID_AMOUNT',
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId
        };
      }

      if (params.amount !== undefined && params.amount !== null) {
        const callerAmountScale4 = toScale4(params.amount);
        if (callerAmountScale4 !== qualifiedAmountScale4) {
          return {
            success: false,
            reason: 'BET_AMOUNT_MISMATCH',
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId
          };
        }
      }

      if (params.currency && typeof params.currency === 'string' && params.currency.trim() !== '') {
        if (params.currency.trim().toUpperCase() !== authoritativeCurrency.trim().toUpperCase()) {
          return {
            success: false,
            reason: 'CURRENCY_MISMATCH',
            userId: params.userId,
            sourceTransactionId: params.sourceTransactionId
          };
        }
      }

      // 3. Locate & Row-Lock Active Wagering Requirement
      let requirement;
      if (params.requirementId) {
        const [found] = await tx
          .select()
          .from(wageringRequirements)
          .where(
            and(
              eq(wageringRequirements.id, params.requirementId),
              eq(wageringRequirements.userId, params.userId)
            )
          )
          .for('update');
        requirement = found;
      } else {
        const [found] = await tx
          .select()
          .from(wageringRequirements)
          .where(
            and(
              eq(wageringRequirements.userId, params.userId),
              eq(wageringRequirements.status, 'ACTIVE')
            )
          )
          .orderBy(wageringRequirements.createdAt, wageringRequirements.id)
          .limit(1)
          .for('update');
        requirement = found;
      }

      if (!requirement) {
        return {
          success: true,
          noActiveRequirement: true,
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          completed: false,
          message: 'No active wagering requirement found for user'
        };
      }

      const now = new Date();

      // 4. Expiry and Status Validation
      if (requirement.expiresAt && new Date(requirement.expiresAt).getTime() <= now.getTime()) {
        // Mark as EXPIRED atomically
        if (requirement.status === 'ACTIVE') {
          await tx
            .update(wageringRequirements)
            .set({ status: 'EXPIRED' })
            .where(eq(wageringRequirements.id, requirement.id));
        }
        return {
          success: false,
          reason: 'REQUIREMENT_EXPIRED',
          requirementId: requirement.id,
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          status: 'EXPIRED',
          completedTurnover: requirement.completedTurnoverAmount,
          targetTurnover: requirement.targetTurnoverAmount
        };
      }

      if (requirement.status !== 'ACTIVE') {
        return {
          success: false,
          reason: 'REQUIREMENT_NOT_ACTIVE',
          requirementId: requirement.id,
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          status: requirement.status,
          completedTurnover: requirement.completedTurnoverAmount,
          targetTurnover: requirement.targetTurnoverAmount
        };
      }

      // 5. Idempotency Verification via Row Lock
      const [existingEvent] = await tx
        .select()
        .from(wageringProgressEvents)
        .where(
          and(
            eq(wageringProgressEvents.wageringRequirementId, requirement.id),
            eq(wageringProgressEvents.sourceTransactionId, params.sourceTransactionId)
          )
        )
        .for('update');

      if (existingEvent) {
        return {
          success: true,
          duplicate: true,
          reason: 'ALREADY_PROCESSED',
          requirementId: requirement.id,
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          qualifiedAmount: existingEvent.qualifiedAmount,
          completedTurnover: requirement.completedTurnoverAmount,
          targetTurnover: requirement.targetTurnoverAmount,
          status: requirement.status,
          completed: requirement.status === 'COMPLETED'
        };
      }

      // 6. Record Progression Event
      const [insertedEvent] = await tx
        .insert(wageringProgressEvents)
        .values({
          wageringRequirementId: requirement.id,
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          qualifiedAmount: fromScale4(qualifiedAmountScale4),
          currency: authoritativeCurrency,
          processedAt: now
        })
        .onConflictDoNothing()
        .returning();

      if (!insertedEvent) {
        // Handled concurrently by another thread
        const [freshReq] = await tx
          .select()
          .from(wageringRequirements)
          .where(eq(wageringRequirements.id, requirement.id));

        return {
          success: true,
          duplicate: true,
          reason: 'ALREADY_PROCESSED',
          requirementId: requirement.id,
          userId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          completedTurnover: freshReq?.completedTurnoverAmount || requirement.completedTurnoverAmount,
          targetTurnover: freshReq?.targetTurnoverAmount || requirement.targetTurnoverAmount,
          status: freshReq?.status || requirement.status,
          completed: (freshReq?.status || requirement.status) === 'COMPLETED'
        };
      }

      // 7. Calculate Turnover with Pure Scale-4 BigInt Arithmetic
      const currentCompletedScale4 = toScale4(requirement.completedTurnoverAmount || '0.0000');
      const targetTurnoverScale4 = toScale4(requirement.targetTurnoverAmount || '0.0000');
      const newCalculatedScale4 = currentCompletedScale4 + qualifiedAmountScale4;

      let cappedScale4: bigint;
      let newStatus: 'ACTIVE' | 'COMPLETED' = 'ACTIVE';
      let completedAt: Date | null = null;
      let isCompleted = false;

      if (newCalculatedScale4 >= targetTurnoverScale4) {
        cappedScale4 = targetTurnoverScale4;
        newStatus = 'COMPLETED';
        completedAt = now;
        isCompleted = true;
      } else {
        cappedScale4 = newCalculatedScale4;
        newStatus = 'ACTIVE';
        completedAt = null;
        isCompleted = false;
      }

      const completedTurnoverStr = fromScale4(cappedScale4);

      // 8. Update Wagering Requirement Row
      await tx
        .update(wageringRequirements)
        .set({
          completedTurnoverAmount: completedTurnoverStr,
          status: newStatus,
          completedAt: completedAt
        })
        .where(eq(wageringRequirements.id, requirement.id));

      return {
        success: true,
        duplicate: false,
        requirementId: requirement.id,
        userId: params.userId,
        sourceTransactionId: params.sourceTransactionId,
        qualifiedAmount: fromScale4(qualifiedAmountScale4),
        previousCompletedTurnover: fromScale4(currentCompletedScale4),
        completedTurnover: completedTurnoverStr,
        targetTurnover: fromScale4(targetTurnoverScale4),
        status: newStatus,
        completed: isCompleted,
        completedAt
      };
    };

    if (params.tx) {
      return await runner(params.tx);
    }
    return await db.transaction(runner);
  }

  /**
   * Creates a new authoritative Wagering Requirement record.
   * Target turnover is calculated via pure Scale-4 BigInt arithmetic: bonusAmountGranted * requiredMultiplier.
   */
  public static async createRequirement(
    params: CreateWageringRequirementParams
  ): Promise<WageringRequirementRecord> {
    const {
      userId,
      promoName,
      bonusAmountGranted,
      requiredMultiplier = 10,
      expiryDays = 7,
      expiryHours,
      expiresAt: customExpiresAt,
      tx
    } = params;

    if (!userId || typeof userId !== 'number' || userId <= 0) {
      throw new Error('Valid numeric userId is required');
    }
    if (!promoName || typeof promoName !== 'string' || promoName.trim() === '') {
      throw new Error('promoName is required');
    }

    const bonusScale4 = toScale4(bonusAmountGranted);
    if (bonusScale4 <= 0n) {
      throw new Error('bonusAmountGranted must be greater than zero');
    }

    if (!Number.isInteger(requiredMultiplier) || requiredMultiplier <= 0) {
      throw new Error('requiredMultiplier must be a positive integer');
    }

    const targetTurnoverScale4 = bonusScale4 * BigInt(requiredMultiplier);
    const targetTurnoverStr = fromScale4(targetTurnoverScale4);
    const bonusAmountStr = fromScale4(bonusScale4);

    const now = new Date();
    let calculatedExpiresAt: Date;
    if (customExpiresAt) {
      calculatedExpiresAt = customExpiresAt;
    } else if (expiryHours !== undefined) {
      calculatedExpiresAt = new Date(now.getTime() + expiryHours * 60 * 60 * 1000);
    } else {
      calculatedExpiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000);
    }

    const executor = tx || db;

    const [record] = await executor
      .insert(wageringRequirements)
      .values({
        userId,
        promoName: promoName.trim(),
        bonusAmountGranted: bonusAmountStr,
        requiredMultiplier,
        targetTurnoverAmount: targetTurnoverStr,
        completedTurnoverAmount: '0.0000',
        status: 'ACTIVE',
        expiresAt: calculatedExpiresAt,
        createdAt: now
      })
      .returning();

    if (!record) {
      throw new Error(`Failed to create wagering requirement for user ${userId}`);
    }

    return record as WageringRequirementRecord;
  }

  /**
   * Retrieves active, non-expired wagering requirements for a given user.
   * Stale requirements with expires_at <= NOW() are automatically marked EXPIRED.
   */
  public static async getUserActiveRequirements(userId: number): Promise<WageringRequirementRecord[]> {
    if (!userId || typeof userId !== 'number' || userId <= 0) {
      throw new Error('Valid numeric userId is required');
    }

    const now = new Date();

    // Mark expired requirements
    await db
      .update(wageringRequirements)
      .set({ status: 'EXPIRED' })
      .where(
        and(
          eq(wageringRequirements.userId, userId),
          eq(wageringRequirements.status, 'ACTIVE'),
          lte(wageringRequirements.expiresAt, now)
        )
      );

    const activeList = await db
      .select()
      .from(wageringRequirements)
      .where(
        and(
          eq(wageringRequirements.userId, userId),
          eq(wageringRequirements.status, 'ACTIVE')
        )
      )
      .orderBy(wageringRequirements.createdAt, wageringRequirements.id);

    return activeList as WageringRequirementRecord[];
  }

  /**
   * Retrieves a specific wagering requirement by ID.
   */
  public static async getRequirementById(id: number): Promise<WageringRequirementRecord | null> {
    if (!id || typeof id !== 'number' || id <= 0) return null;

    const [record] = await db
      .select()
      .from(wageringRequirements)
      .where(eq(wageringRequirements.id, id));

    return (record as WageringRequirementRecord) || null;
  }
}
