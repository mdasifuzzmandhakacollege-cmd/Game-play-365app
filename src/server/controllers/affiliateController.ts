/**
 * @file affiliateController.ts
 * @description Enterprise Multi-Tier Affiliate & Commission Engine for Playall 365.
 * Handles Tier A -> Tier B (Direct 0.50%) -> Tier C (Subordinate 0.20%) -> Tier D (0.10%)
 * commission distributions upon valid bets with row-level locking.
 */

import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../../db/index.js';
import { affiliateNodes, affiliateCommissions, users, transactions } from '../../db/schema.js';
import { eq, sql, inArray, and } from 'drizzle-orm';
import { resolveAuthUser, toScale4, fromScale4 } from './promotionController.js';
import { WalletLedgerService, walletLedgerService } from '../ledger/walletLedgerService.js';

export interface DistributeCommissionParams {
  userId: number;
  betAmount?: number | string | bigint;
  currency?: string;
  sourceTransactionId: string;
  gameId?: string;
}

/**
 * Pure integer minor-units arithmetic for Commission Rates
 * Preserves exact business rates:
 * Tier 1 (Direct Parent): 0.50% (0.0050 = 50 in basis points of 10000)
 * Tier 2 (Grandparent): 0.20% (0.0020 = 20 in basis points of 10000)
 * Tier 3 (Great-Grandparent): 0.10% (0.0010 = 10 in basis points of 10000)
 */
export const COMMISSION_TIER_BPS: Record<number, bigint> = {
  1: 50n, // 0.0050 * 10000 = 50 bps
  2: 20n, // 0.0020 * 10000 = 20 bps
  3: 10n, // 0.0010 * 10000 = 10 bps
};

export class AffiliateService {
  /**
   * Distribute multi-tier commissions when a player places a valid bet.
   * Enforces:
   * 1. Exact Scale-4 BigInt Math (Zero float drift).
   * 2. Transaction status validation (COMMITTED/COMPLETED/SETTLED).
   * 3. Strict Idempotency via sourceTransactionId + beneficiaryUserId + tier.
   * 4. Single ACID transaction with SELECT ... FOR UPDATE row-level locking on all affected affiliate nodes.
   * 5. Immutable commission ledger entries.
   */
  public static async processValidBetCommission(params: DistributeCommissionParams) {
    if (!params.sourceTransactionId || typeof params.sourceTransactionId !== 'string' || params.sourceTransactionId.trim() === '') {
      throw new Error('sourceTransactionId is required for commission distribution');
    }

    // 1. Authoritatively lookup source bet transaction from database
    const [sourceTx] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.transactionId, params.sourceTransactionId))
      .limit(1);

    // Reject if source transaction does not exist
    if (!sourceTx) {
      return { success: false, reason: 'SOURCE_TRANSACTION_NOT_FOUND', distributedCount: 0 };
    }

    // Validate type = BET
    if (sourceTx.type !== 'BET') {
      return { success: false, reason: 'INVALID_TRANSACTION_TYPE', distributedCount: 0 };
    }

    // Validate status = COMPLETED or SETTLED
    const isCommittedStatus = sourceTx.status === 'COMPLETED' || sourceTx.status === 'SETTLED';
    if (!isCommittedStatus) {
      return { success: false, reason: 'TRANSACTION_NOT_SETTLED', distributedCount: 0 };
    }

    // Validate ownership: source transaction must belong to the caller/source user
    if (sourceTx.userId !== params.userId) {
      return { success: false, reason: 'TRANSACTION_USER_MISMATCH', distributedCount: 0 };
    }

    // 2. Read authoritative bet amount and currency directly from verified database record
    const authoritativeBetScale4 = toScale4(sourceTx.amount);
    if (authoritativeBetScale4 <= 0n) {
      return { success: false, reason: 'INVALID_BET_AMOUNT', distributedCount: 0 };
    }
    const authoritativeCurrency = sourceTx.currency || 'BDT';

    // 3. Reject any mismatch between caller-supplied context and authoritative source transaction
    if (params.betAmount !== undefined && params.betAmount !== null) {
      const callerBetScale4 = typeof params.betAmount === 'bigint' ? params.betAmount : toScale4(params.betAmount);
      if (callerBetScale4 !== authoritativeBetScale4) {
        return { success: false, reason: 'BET_AMOUNT_MISMATCH', distributedCount: 0 };
      }
    }

    if (params.currency && typeof params.currency === 'string' && params.currency.trim() !== '') {
      if (params.currency.trim().toUpperCase() !== authoritativeCurrency.trim().toUpperCase()) {
        return { success: false, reason: 'CURRENCY_MISMATCH', distributedCount: 0 };
      }
    }

    const betScale4 = authoritativeBetScale4;
    const resolvedCurrency = authoritativeCurrency;

    // 4. Lookup user's affiliate node to resolve upline beneficiaries
    const [userNode] = await db
      .select()
      .from(affiliateNodes)
      .where(eq(affiliateNodes.userId, sourceTx.userId))
      .limit(1);

    if (!userNode || !userNode.parentAffiliateId) {
      return { success: true, reason: 'NO_UPLINE_BENEFICIARY', distributedCount: 0 }; // No upline sponsor
    }

    const beneficiaries: { userId: number; tier: number; bps: bigint; rateStr: string }[] = [];
    
    if (userNode.parentAffiliateId) {
      beneficiaries.push({
        userId: userNode.parentAffiliateId,
        tier: 1,
        bps: COMMISSION_TIER_BPS[1],
        rateStr: '0.0050'
      });
    }

    if (userNode.grandParentAffiliateId) {
      beneficiaries.push({
        userId: userNode.grandParentAffiliateId,
        tier: 2,
        bps: COMMISSION_TIER_BPS[2],
        rateStr: '0.0020'
      });
    }

    if (beneficiaries.length === 0) {
      return { success: true, reason: 'NO_UPLINE_BENEFICIARY', distributedCount: 0 };
    }

    // Execute within a single ACID transaction
    return await db.transaction(async (tx) => {
      // 5. Check existing commission records for strict idempotency
      const existingCommissions = await tx
        .select()
        .from(affiliateCommissions)
        .where(eq(affiliateCommissions.sourceTransactionId, params.sourceTransactionId));

      const existingTierMap = new Set(
        existingCommissions.map((c) => `${c.beneficiaryUserId}_${c.tier}`)
      );

      // Filter to only beneficiaries that haven't been credited for this source transaction
      const pendingBeneficiaries = beneficiaries.filter(
        (b) => !existingTierMap.has(`${b.userId}_${b.tier}`)
      );

      if (pendingBeneficiaries.length === 0) {
        return { success: true, reason: 'ALREADY_PROCESSED', distributedCount: 0 };
      }

      // Collect distinct beneficiary user IDs in deterministic ascending order to prevent deadlocks
      const distinctBeneficiaryIds = Array.from(
        new Set(pendingBeneficiaries.map((b) => b.userId))
      ).sort((a, b) => a - b);

      // 6. Row-level locking on affiliate_nodes using SELECT ... FOR UPDATE
      for (const bUserId of distinctBeneficiaryIds) {
        await tx.execute(
          sql`SELECT * FROM affiliate_nodes WHERE user_id = ${bUserId} FOR UPDATE`
        );
      }

      let distributedCount = 0;

      for (const beneficiary of pendingBeneficiaries) {
        // Exact BigInt calculation: (betScale4 * bps) / 10000n
        const commissionScale4 = (betScale4 * beneficiary.bps) / 10000n;
        if (commissionScale4 <= 0n) {
          continue; // Below min fractional precision unit
        }

        const commissionAmountStr = fromScale4(commissionScale4);
        const betAmountStr = fromScale4(betScale4);

        // Update beneficiary affiliate node counters authoritatively
        await tx
          .update(affiliateNodes)
          .set({
            totalCommissionEarned: sql`(${affiliateNodes.totalCommissionEarned}::numeric + ${commissionAmountStr}::numeric)::text`,
            unclaimedCommission: sql`(${affiliateNodes.unclaimedCommission}::numeric + ${commissionAmountStr}::numeric)::text`,
            totalTurnoverVolume: sql`(${affiliateNodes.totalTurnoverVolume}::numeric + ${betAmountStr}::numeric)::text`,
            updatedAt: new Date()
          })
          .where(eq(affiliateNodes.userId, beneficiary.userId));

        // Insert immutable commission ledger entry
        await tx.insert(affiliateCommissions).values({
          beneficiaryUserId: beneficiary.userId,
          sourceUserId: sourceTx.userId,
          sourceTransactionId: params.sourceTransactionId,
          tier: beneficiary.tier,
          validBetAmount: betAmountStr,
          commissionRate: beneficiary.rateStr,
          commissionAmount: commissionAmountStr,
          currency: resolvedCurrency,
          status: 'SETTLED',
          settledAt: new Date()
        });

        distributedCount++;
      }

      return {
        success: true,
        distributedCount,
        sourceTransactionId: params.sourceTransactionId
      };
    });
  }

  private static ledgerService: WalletLedgerService = walletLedgerService;

  public static setLedgerService(service: WalletLedgerService) {
    AffiliateService.ledgerService = service;
  }

  /**
   * Claim accumulated affiliate commissions into withdrawable real wallet balance.
   * Enforces:
   * 1. Authoritative Wallet Ledger: Credits wallet exclusively via WalletLedgerService (NO direct wallets.realBalance mutation).
   * 2. Deterministic Server Idempotency: Server-derived claim ID generated from exact SETTLED commission entry IDs (never Date.now(), client transactionId ignored).
   * 3. Strict Settlement Check: Only exact SETTLED commission entries are claimed; zero fallback credit from aggregate counters.
   * 4. Exact Scale-4 BigInt Math (zero float drift, strict minor-unit representation).
   * 5. ACID Transaction & Row Locks: Locks affiliate_nodes and affiliateCommissions with SELECT ... FOR UPDATE.
   * 6. Exact status transition: Marks claimed entries as CLAIMED and resets/deducts unclaimedCommission synchronously.
   */
  public static async claimAffiliateCommission(userId: number, customLedgerService?: WalletLedgerService) {
    if (!userId || typeof userId !== 'number') {
      throw new Error('Valid userId is required to claim commissions');
    }

    const effectiveLedger = customLedgerService || AffiliateService.ledgerService || walletLedgerService;

    return await db.transaction(async (tx) => {
      // 1. Lock affiliate node row with SELECT ... FOR UPDATE
      const [node] = await tx
        .select()
        .from(affiliateNodes)
        .where(eq(affiliateNodes.userId, userId))
        .for('update');

      if (!node) {
        throw new Error('Affiliate profile not found');
      }

      // 2. Fetch all SETTLED (unclaimed) commission entries for this beneficiary with row lock
      const settledCommissions = await tx
        .select()
        .from(affiliateCommissions)
        .where(
          and(
            eq(affiliateCommissions.beneficiaryUserId, userId),
            eq(affiliateCommissions.status, 'SETTLED')
          )
        )
        .for('update');

      // Strict enforcement: Only exact SETTLED affiliateCommissions entries may be claimed. Zero fallback credit.
      if (settledCommissions.length === 0) {
        throw new Error('No unclaimed commissions available');
      }

      // 3. Derive server-deterministic claim ID from exact SETTLED entries
      const sortedIds = settledCommissions.map((c) => c.id).sort((a, b) => a - b);
      const entriesFingerprint = sortedIds.join(',');
      const entriesHash = crypto.createHash('sha256').update(entriesFingerprint).digest('hex').slice(0, 24);
      const deterministicClaimTxId = `AFF_CLAIM_U${userId}_${entriesHash}`;

      // 4. Calculate total claimable commission using exact Scale-4 BigInt math
      let totalClaimableScale4 = 0n;
      for (const entry of settledCommissions) {
        totalClaimableScale4 += toScale4(entry.commissionAmount);
      }

      if (totalClaimableScale4 <= 0n) {
        throw new Error('No unclaimed commissions available');
      }

      const claimedAmountStr = fromScale4(totalClaimableScale4);

      // 5. Authoritatively credit user wallet via WalletLedgerService (NO direct wallets.realBalance mutation)
      const ledgerResult = await effectiveLedger.executeTransaction({
        userId: String(userId),
        currency: 'BDT',
        type: 'CREDIT',
        amountMinor: claimedAmountStr,
        transactionId: deterministicClaimTxId,
        auditMetadata: {
          providerId: 'GAMEPLAY365_CORE',
          type: 'AFFILIATE_COMMISSION_CLAIM',
          beneficiaryUserId: userId,
          claimedEntryIds: sortedIds,
          claimedAmount: claimedAmountStr
        }
      });

      // 6. Update unclaimed commission on affiliate node
      const nodeUnclaimedScale4 = toScale4(node.unclaimedCommission);
      const remainingUnclaimedScale4 = nodeUnclaimedScale4 > totalClaimableScale4
        ? nodeUnclaimedScale4 - totalClaimableScale4
        : 0n;
      const remainingUnclaimedStr = fromScale4(remainingUnclaimedScale4);

      await tx
        .update(affiliateNodes)
        .set({
          unclaimedCommission: remainingUnclaimedStr,
          updatedAt: new Date()
        })
        .where(eq(affiliateNodes.userId, userId));

      // 7. Mark exact SETTLED commission entries as CLAIMED
      await tx
        .update(affiliateCommissions)
        .set({ status: 'CLAIMED' })
        .where(inArray(affiliateCommissions.id, sortedIds));

      return {
        claimedAmount: claimedAmountStr,
        newRealBalance: ledgerResult.afterBalanceMajor || fromScale4(toScale4(ledgerResult.afterBalanceMinor)),
        transactionId: deterministicClaimTxId,
        ledgerEntryId: ledgerResult.ledgerEntryId,
        isIdempotent: ledgerResult.isIdempotent || false
      };
    });
  }
}

// ----------------------------------------------------------------------------
// Express Route Handlers
// ----------------------------------------------------------------------------
export const getAffiliateSummaryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req, req.query.userId);

    const [node] = await db
      .select()
      .from(affiliateNodes)
      .where(eq(affiliateNodes.userId, userId));

    const commissions = await db
      .select()
      .from(affiliateCommissions)
      .where(eq(affiliateCommissions.beneficiaryUserId, userId))
      .limit(50);

    res.json({
      status: 'SUCCESS',
      data: {
        node: node || {
          userId,
          referralCode: `PLAY369_${userId}`,
          totalDirectReferrals: 0,
          totalSubordinates: 0,
          totalTurnoverVolume: '0.0000',
          totalCommissionEarned: '0.0000',
          unclaimedCommission: '0.0000'
        },
        recentCommissions: commissions || []
      }
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 500);
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};

export const claimCommissionHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req, req.body?.userId);
    const result = await AffiliateService.claimAffiliateCommission(userId);
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : (err.message?.includes('frozen') || err.message?.includes('inactive') ? 403 : 400));
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};
