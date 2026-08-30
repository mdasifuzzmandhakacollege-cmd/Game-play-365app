/**
 * @file vipController.ts
 * @description Enterprise VIP & Loyalty Progression System for Playall 365.
 * Automated VIP tier evaluation (V1 Rookie to V10 Immortal), level-up bonus unlocks,
 * daily cashback distributions, and VIP benefit metrics.
 */

import { Request, Response } from 'express';
import { db } from '../../db/index.js';
import { vipLevels, userVipProgress, users, vipRewardClaims } from '../../db/schema.js';
import { and, eq, sql } from 'drizzle-orm';
import { VIP_TIER_CONFIG } from '../../shared/gameplayConfig.js';
import { resolveAuthUser, toScale4, fromScale4 } from './promotionController.js';
import { WalletLedgerService } from '../ledger/walletLedgerService.js';

export class VipService {
  private static ledgerService: WalletLedgerService | null = null;

  public static setLedgerService(service: WalletLedgerService) {
    VipService.ledgerService = service;
  }

  public static getLedgerService(): WalletLedgerService | null {
    return VipService.ledgerService;
  }

  /**
   * Cron / Background Evaluator: Check cumulative deposits and bets to trigger tier upgrades
   */
  public static async evaluateVipUpgrade(userId: number) {
    return await db.transaction(async (tx) => {
      const [progress] = await tx
        .select()
        .from(userVipProgress)
        .where(eq(userVipProgress.userId, userId));

      if (!progress) return null;

      const currentLvl = progress.currentLevel;
      const deposit = Number(progress.cumulativeDeposit);
      const bet = Number(progress.cumulativeBet);

      // Find highest qualifying level
      let qualifiedLevel = 1;
      for (const tier of VIP_TIER_CONFIG) {
        if (deposit >= tier.minDeposit && bet >= tier.minBet) {
          qualifiedLevel = tier.level;
        }
      }

      if (qualifiedLevel > currentLvl) {
        const upgradedTier = VIP_TIER_CONFIG.find((t) => t.level === qualifiedLevel)!;

        // Upgrade user level
        await tx
          .update(userVipProgress)
          .set({
            currentLevel: qualifiedLevel,
            lastUpgradedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(userVipProgress.userId, userId));

        await tx
          .update(users)
          .set({
            vipLevel: qualifiedLevel,
            vipTier: upgradedTier.name.toUpperCase().replace(' ', '_'),
            updatedAt: new Date()
          })
          .where(eq(users.id, userId));

        return {
          upgraded: true,
          oldLevel: currentLvl,
          newLevel: qualifiedLevel,
          tierName: upgradedTier.name,
          levelUpBonusAvailable: upgradedTier.bonus
        };
      }

      return { upgraded: false, currentLevel: currentLvl };
    });
  }

  /**
   * Claim VIP Level-Up Reward
   * 
   * [FINANCIAL LEDGER & IDEMPOTENCY INVARIANTS]:
   * 1. Zero Direct Wallet Mutation: Balance changes are strictly executed by production WalletLedgerService.
   * 2. Canonical Scale-4 Money Arithmetic: Exact integer minor units (1 BDT = 10000 minor units).
   * 3. Deterministic Transaction ID: 'VIP_LEVELUP_<userId>_<level>' for exactly-once ledger credit idempotency.
   * 4. Crash-Safe State Machine:
   *    - Row lock on user_vip_progress via SELECT ... FOR UPDATE.
   *    - Row lock & reserve claim in vip_reward_claims with status 'PENDING'.
   *    - Idempotent execution via WalletLedgerService.
   *    - Synchronous transition of vip_reward_claims to 'CREDITED' and update of levelUpBonusClaimed.
   * 5. Fail Closed: Rejects immediately if production WalletLedgerService is unavailable.
   */
  public static async claimLevelUpBonus(
    userId: number,
    levelToClaim: number,
    customLedgerService?: WalletLedgerService
  ) {
    if (!userId || typeof userId !== 'number') {
      throw new Error('Valid userId is required');
    }
    if (!levelToClaim || typeof levelToClaim !== 'number' || levelToClaim < 1 || levelToClaim > 10) {
      throw new Error('Valid VIP level is required');
    }

    const effectiveLedger = customLedgerService || VipService.ledgerService;
    if (!effectiveLedger) {
      throw new Error('FATAL_LEDGER_UNAVAILABLE: Production WalletLedgerService is not configured. VIP reward claim failed closed.');
    }

    const tierConfig = VIP_TIER_CONFIG.find((t) => t.level === levelToClaim);
    if (!tierConfig || tierConfig.bonus <= 0) {
      throw new Error('No bonus configured for this level');
    }

    const deterministicClaimTxId = `VIP_LEVELUP_${userId}_${levelToClaim}`;
    const rewardAmountScale4 = toScale4(tierConfig.bonus);
    const rewardAmountStr = fromScale4(rewardAmountScale4);

    return await db.transaction(async (tx) => {
      // 1. Lock user VIP progress row with SELECT ... FOR UPDATE
      const [progress] = await tx
        .select()
        .from(userVipProgress)
        .where(eq(userVipProgress.userId, userId))
        .for('update');

      if (!progress) {
        throw new Error('VIP progress profile not found');
      }

      if (progress.currentLevel < levelToClaim) {
        throw new Error(`You have not reached VIP Level ${levelToClaim} yet`);
      }

      // 2. Lock & check existing claim record in vip_reward_claims
      const [existingClaim] = await tx
        .select()
        .from(vipRewardClaims)
        .where(
          and(
            eq(vipRewardClaims.userId, userId),
            eq(vipRewardClaims.vipLevel, levelToClaim)
          )
        )
        .for('update');

      if (existingClaim && existingClaim.status === 'CREDITED') {
        throw new Error(`Level ${levelToClaim} bonus has already been claimed`);
      }

      const claimedList = ((progress.levelUpBonusClaimed as number[]) || []).slice();
      if (existingClaim?.status === 'CREDITED' || (claimedList.includes(levelToClaim) && !existingClaim)) {
        throw new Error(`Level ${levelToClaim} bonus has already been claimed`);
      }

      // 3. Reserve or find claim record
      let claimRecord = existingClaim;
      if (!claimRecord) {
        const [inserted] = await tx
          .insert(vipRewardClaims)
          .values({
            userId,
            vipLevel: levelToClaim,
            transactionId: deterministicClaimTxId,
            rewardAmount: rewardAmountStr,
            currency: 'BDT',
            status: 'PENDING',
            createdAt: new Date()
          })
          .onConflictDoNothing()
          .returning();

        if (!inserted) {
          const [fetched] = await tx
            .select()
            .from(vipRewardClaims)
            .where(
              and(
                eq(vipRewardClaims.userId, userId),
                eq(vipRewardClaims.vipLevel, levelToClaim)
              )
            )
            .for('update');
          claimRecord = fetched;
        } else {
          claimRecord = inserted;
        }
      }

      if (claimRecord && claimRecord.status === 'CREDITED') {
        throw new Error(`Level ${levelToClaim} bonus has already been claimed`);
      }

      // 4. Authoritative Wallet Ledger Credit (Zero direct wallets balance mutation)
      const ledgerResult = await effectiveLedger.executeTransaction({
        userId: String(userId),
        currency: 'BDT',
        type: 'CREDIT',
        targetBalance: 'REAL',
        amountMinor: rewardAmountStr,
        transactionId: deterministicClaimTxId,
        auditMetadata: {
          providerId: 'GAMEPLAY365_VIP',
          type: 'VIP_LEVEL_UP_REWARD',
          userId,
          levelClaimed: levelToClaim,
          tierName: tierConfig.name,
          rewardAmount: rewardAmountStr
        }
      });

      // 5. Update claim record status to CREDITED
      if (claimRecord) {
        await tx
          .update(vipRewardClaims)
          .set({
            status: 'CREDITED',
            creditedAt: new Date()
          })
          .where(eq(vipRewardClaims.id, claimRecord.id));
      }

      // 6. Update levelUpBonusClaimed array on userVipProgress for compatibility/UI
      if (!claimedList.includes(levelToClaim)) {
        claimedList.push(levelToClaim);
      }
      await tx
        .update(userVipProgress)
        .set({
          levelUpBonusClaimed: claimedList,
          updatedAt: new Date()
        })
        .where(eq(userVipProgress.userId, userId));

      return {
        levelClaimed: levelToClaim,
        bonusAmount: tierConfig.bonus,
        newRealBalance: ledgerResult.afterBalanceMajor,
        transactionId: deterministicClaimTxId,
        status: 'CREDITED'
      };
    });
  }
}

// ----------------------------------------------------------------------------
// Express Handlers
// ----------------------------------------------------------------------------
export const getVipDetailsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req, req.query?.userId);
    const [progress] = await db
      .select()
      .from(userVipProgress)
      .where(eq(userVipProgress.userId, userId));

    res.json({
      status: 'SUCCESS',
      data: {
        tiers: VIP_TIER_CONFIG,
        userProgress: progress || {
          currentLevel: 1,
          cumulativeDeposit: '0.0000',
          cumulativeBet: '0.0000',
          levelUpBonusClaimed: [],
          totalCashbackClaimed: '0.0000'
        }
      }
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 500);
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};

export const claimVipBonusHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req, req.body?.userId);
    const rawLevel = req.body?.level;
    if (rawLevel === undefined || rawLevel === null || isNaN(Number(rawLevel))) {
      res.status(400).json({ status: 'ERROR', message: 'Valid level is required' });
      return;
    }
    const level = Number(rawLevel);
    const result = await VipService.claimLevelUpBonus(userId, level);
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 400);
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};
