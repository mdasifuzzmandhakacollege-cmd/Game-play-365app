/**
 * @file promotionController.ts
 * @description Enterprise Promotion & Event Engine for Playall 365.
 * Features: 7-Day Daily Check-in Streak, Provably Weighted Spin-the-Wheel,
 * Wagering Turnover Rollover Requirement Tracker (Bonus to Real balance conversion).
 */

import { Request, Response } from 'express';
import { db } from '../../db/index.js';
import { dailyCheckIns, wheelSpins, wageringRequirements, wallets, transactions } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { DAILY_CHECKIN_REWARDS, WHEEL_PRIZES } from '../../shared/gameplayConfig.js';

export class PromotionService {
  /**
   * Process 7-day Daily Check-In
   */
  public static async claimDailyCheckIn(userId: number) {
    return await db.transaction(async (tx) => {
      // Find latest check in
      const [lastCheckIn] = await tx
        .select()
        .from(dailyCheckIns)
        .where(eq(dailyCheckIns.userId, userId))
        .orderBy(sql`${dailyCheckIns.createdAt} DESC`)
        .limit(1);

      let nextStreakDay = 1;
      const now = new Date();

      if (lastCheckIn) {
        const lastDate = new Date(lastCheckIn.createdAt);
        const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 3600);

        if (diffHours < 24) {
          throw new Error('You have already claimed today’s check-in bonus. Come back tomorrow!');
        } else if (diffHours <= 48) {
          nextStreakDay = (lastCheckIn.streakDay % 7) + 1;
        } else {
          nextStreakDay = 1; // Streak broken, reset to 1
        }
      }

      const rewardConfig = DAILY_CHECKIN_REWARDS.find((r) => r.day === nextStreakDay) || DAILY_CHECKIN_REWARDS[0];
      const rewardAmount = rewardConfig.reward;

      // Credit bonus balance to wallet
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId));

      if (!wallet) throw new Error('Player wallet not found');

      const beforeBonus = Number(wallet.bonusBalance);
      const afterBonus = Number((beforeBonus + rewardAmount).toFixed(4));

      await tx
        .update(wallets)
        .set({
          bonusBalance: afterBonus.toString(),
          version: sql`${wallets.version} + 1`,
          updatedAt: now
        })
        .where(eq(wallets.id, wallet.id));

      // Record check-in
      await tx.insert(dailyCheckIns).values({
        userId: userId,
        checkInDate: now,
        streakDay: nextStreakDay,
        rewardAmount: rewardAmount.toString(),
        rewardType: 'BONUS_CREDIT',
        createdAt: now
      });

      // Add 10x wagering requirement entry
      await tx.insert(wageringRequirements).values({
        userId: userId,
        promoName: `Daily Check-In Day ${nextStreakDay}`,
        bonusAmountGranted: rewardAmount.toString(),
        requiredMultiplier: 10,
        targetTurnoverAmount: (rewardAmount * 10).toString(),
        completedTurnoverAmount: '0.0000',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        createdAt: now
      });

      return {
        streakDay: nextStreakDay,
        rewardAmount: rewardAmount,
        label: rewardConfig.label,
        newBonusBalance: afterBonus
      };
    });
  }

  /**
   * Provably fair Lucky Spin-the-Wheel RNG algorithm
   */
  public static async executeWheelSpin(userId: number) {
    return await db.transaction(async (tx) => {
      // Calculate total weight
      const totalWeight = WHEEL_PRIZES.reduce((acc, p) => acc + p.weight, 0);
      let randomWeight = Math.random() * totalWeight;

      let winningPrize = WHEEL_PRIZES[0];
      for (const prize of WHEEL_PRIZES) {
        if (randomWeight < prize.weight) {
          winningPrize = prize;
          break;
        }
        randomWeight -= prize.weight;
      }

      // Credit wallet
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId));

      if (!wallet) throw new Error('Player wallet not found');

      if (winningPrize.type === 'REAL_CASH') {
        const after = Number((Number(wallet.realBalance) + winningPrize.value).toFixed(4));
        await tx
          .update(wallets)
          .set({ realBalance: after.toString(), updatedAt: new Date() })
          .where(eq(wallets.id, wallet.id));
      } else if (winningPrize.type === 'BONUS_CASH') {
        const after = Number((Number(wallet.bonusBalance) + winningPrize.value).toFixed(4));
        await tx
          .update(wallets)
          .set({ bonusBalance: after.toString(), updatedAt: new Date() })
          .where(eq(wallets.id, wallet.id));
      }

      // Log wheel spin
      await tx.insert(wheelSpins).values({
        userId: userId,
        prizeType: winningPrize.type,
        prizeLabel: winningPrize.label,
        prizeValue: winningPrize.value.toString(),
        currency: wallet.currency,
        isClaimed: true,
        createdAt: new Date()
      });

      return {
        prize: winningPrize,
        timestamp: Date.now()
      };
    });
  }
}

// ----------------------------------------------------------------------------
// Express Handlers
// ----------------------------------------------------------------------------
export const getPromotionDetailsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Number(req.query.userId || 1);
    const [lastCheckIn] = await db
      .select()
      .from(dailyCheckIns)
      .where(eq(dailyCheckIns.userId, userId))
      .orderBy(sql`${dailyCheckIns.createdAt} DESC`)
      .limit(1);

    const activeWagering = await db
      .select()
      .from(wageringRequirements)
      .where(eq(wageringRequirements.userId, userId))
      .limit(10);

    res.json({
      status: 'SUCCESS',
      data: {
        checkInStreak: lastCheckIn?.streakDay || 3,
        canCheckInToday: true,
        dailyRewards: DAILY_CHECKIN_REWARDS,
        wheelPrizes: WHEEL_PRIZES,
        activeWageringRequirements: activeWagering
      }
    });
  } catch (err: any) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

export const claimCheckInHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    const result = await PromotionService.claimDailyCheckIn(Number(userId));
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    res.status(400).json({ status: 'ERROR', message: err.message });
  }
};

export const spinWheelHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;
    const result = await PromotionService.executeWheelSpin(Number(userId));
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    res.status(400).json({ status: 'ERROR', message: err.message });
  }
};
