/**
 * @file vipController.ts
 * @description Enterprise VIP & Loyalty Progression System for Playall 365.
 * Automated VIP tier evaluation (V1 Rookie to V10 Immortal), level-up bonus unlocks,
 * daily cashback distributions, and VIP benefit metrics.
 */

import { Request, Response } from 'express';
import { db } from '../../db/index.js';
import { vipLevels, userVipProgress, users, wallets, transactions } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { VIP_TIER_CONFIG } from '../../shared/gameplayConfig.js';
import { resolveAuthUser } from './promotionController.js';

export class VipService {
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
   */
  public static async claimLevelUpBonus(userId: number, levelToClaim: number) {
    return await db.transaction(async (tx) => {
      const [progress] = await tx
        .select()
        .from(userVipProgress)
        .where(eq(userVipProgress.userId, userId));

      if (!progress) throw new Error('VIP progress profile not found');
      if (progress.currentLevel < levelToClaim) {
        throw new Error(`You have not reached VIP Level ${levelToClaim} yet`);
      }

      const claimed = (progress.levelUpBonusClaimed as number[]) || [];
      if (claimed.includes(levelToClaim)) {
        throw new Error(`Level ${levelToClaim} bonus has already been claimed`);
      }

      const tierConfig = VIP_TIER_CONFIG.find((t) => t.level === levelToClaim);
      if (!tierConfig || tierConfig.bonus <= 0) {
        throw new Error('No bonus configured for this level');
      }

      // Credit player wallet
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId));

      if (!wallet) throw new Error('Player wallet not found');

      const beforeBalance = Number(wallet.realBalance);
      const afterBalance = Number((beforeBalance + tierConfig.bonus).toFixed(4));

      await tx
        .update(wallets)
        .set({
          realBalance: afterBalance.toString(),
          version: sql`${wallets.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      // Record in claimed list
      claimed.push(levelToClaim);
      await tx
        .update(userVipProgress)
        .set({
          levelUpBonusClaimed: claimed,
          updatedAt: new Date()
        })
        .where(eq(userVipProgress.userId, userId));

      // Ledger entry
      const txId = `VIP_BONUS_${Date.now()}`;
      await tx.insert(transactions).values({
        providerId: 'GAMEPLAY365_VIP',
        transactionId: txId,
        userId: userId,
        walletId: wallet.id,
        gameId: 'VIP_LEVEL_UP_REWARD',
        type: 'PROMO',
        amount: tierConfig.bonus.toString(),
        currency: wallet.currency,
        beforeBalance: beforeBalance.toString(),
        afterBalance: afterBalance.toString(),
        status: 'COMPLETED',
        metadata: {
          levelClaimed: levelToClaim,
          tierName: tierConfig.name
        },
        createdAt: new Date()
      });

      return {
        levelClaimed: levelToClaim,
        bonusAmount: tierConfig.bonus,
        newRealBalance: afterBalance,
        transactionId: txId
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
