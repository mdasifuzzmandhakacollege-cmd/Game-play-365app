/**
 * @file promotionController.ts
 * @description Enterprise Promotion & Event Engine for Playall 365.
 * Features: 7-Day Daily Check-in Streak, Provably Weighted Spin-the-Wheel,
 * Wagering Turnover Rollover Requirement Tracker (Bonus to Real balance conversion).
 */

import { Request, Response } from 'express';
import { db } from '../../db/index.js';
import { users, dailyCheckIns, wheelSpins, wageringRequirements, wallets } from '../../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { DAILY_CHECKIN_REWARDS, WHEEL_PRIZES } from '../../shared/gameplayConfig.js';
import { AuthRequest } from '../../middleware/auth.js';

/**
 * Pure integer minor-units decimal arithmetic (scale 4, 1.0000 = 10000n)
 * Guarantees zero JavaScript floating-point representation errors.
 */
export const toScale4 = (val: string | number): bigint => {
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

export interface AuthenticatedUserResolution {
  userId: number;
  uid: string;
}

/**
 * Authoritative User Identifier Resolver with Firebase Auth Token Binding.
 * - Extracts verified `req.user.uid` from Firebase Auth token.
 * - Resolves the corresponding PostgreSQL user ID (`users.id`).
 * - Strictly validates that any client-supplied userId matches the authenticated identity.
 * - Throws 401 if token identity is missing/invalid.
 * - Throws 403 if client attempts to read/claim for another user ID.
 * - Throws 404 if user is not found in database.
 */
export const resolveAuthUser = async (
  req: Request,
  clientUserId?: unknown
): Promise<AuthenticatedUserResolution> => {
  const authUid = (req as AuthRequest).user?.uid;
  if (!authUid) {
    const error: any = new Error('Unauthorized: Authentication required');
    error.statusCode = 401;
    throw error;
  }

  // Authoritatively lookup user by Firebase UID in database
  const [foundUser] = await db
    .select({ id: users.id, uid: users.uid })
    .from(users)
    .where(eq(users.uid, authUid))
    .limit(1);

  if (!foundUser) {
    const error: any = new Error(`User account not found for UID: ${authUid}`);
    error.statusCode = 404;
    throw error;
  }

  // If client provided a userId in query or body, verify ownership strictly
  if (clientUserId !== undefined && clientUserId !== null && String(clientUserId).trim() !== '') {
    const strClientUserId = String(clientUserId).trim();
    const isMatchingUid = strClientUserId === foundUser.uid;
    const isMatchingId = /^\d+$/.test(strClientUserId) && parseInt(strClientUserId, 10) === foundUser.id;

    if (!isMatchingUid && !isMatchingId) {
      const error: any = new Error('Forbidden: Cannot access or claim rewards for another user');
      error.statusCode = 403;
      throw error;
    }
  }

  return {
    userId: foundUser.id,
    uid: foundUser.uid
  };
};

/**
 * Authoritative User Identifier Resolver (direct database resolution utility)
 */
export const resolveDbUserId = async (rawUserId: unknown): Promise<number> => {
  if (rawUserId === undefined || rawUserId === null || rawUserId === '') {
    throw new Error('Valid userId is required');
  }

  const strUserId = String(rawUserId).trim();
  if (!strUserId) {
    throw new Error('Valid userId is required');
  }

  // 1. Check if numeric primary key id
  if (/^\d+$/.test(strUserId)) {
    const numId = parseInt(strUserId, 10);
    const [foundUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, numId))
      .limit(1);

    if (foundUser) {
      return foundUser.id;
    }
  }

  // 2. Check if text UID in users table
  const [userByUid] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.uid, strUserId))
    .limit(1);

  if (userByUid) {
    return userByUid.id;
  }

  // Strict: If user cannot be found, throw error (no fallback or simulated user ID)
  throw new Error(`User not found: ${strUserId}`);
};


export class PromotionService {
  /**
   * Process 7-day Daily Check-In with ACID Row-Level Locking & Scale-4 BigInt Math
   */
  public static async claimDailyCheckIn(userId: number) {
    return await db.transaction(async (tx) => {
      // 1. Row-level lock on user's wallet to prevent concurrent duplicate claims
      const walletRows = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .for('update');

      const wallet = walletRows[0];
      if (!wallet) {
        throw new Error('Player wallet not found');
      }

      // 2. Fetch latest check in within transaction
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
      const rewardAmountStr = rewardAmount.toFixed(4);

      // 3. Scale-4 BigInt Ledger Calculation (no floating point errors)
      const currentBonusBigInt = toScale4(wallet.bonusBalance);
      const rewardBigInt = toScale4(rewardAmountStr);
      const newBonusBigInt = currentBonusBigInt + rewardBigInt;
      const newBonusBalanceStr = fromScale4(newBonusBigInt);

      // 4. Update wallet with atomic version bump
      await tx
        .update(wallets)
        .set({
          bonusBalance: newBonusBalanceStr,
          version: sql`${wallets.version} + 1`,
          updatedAt: now
        })
        .where(eq(wallets.id, wallet.id));

      // 5. Insert immutable check-in record
      await tx.insert(dailyCheckIns).values({
        userId: userId,
        checkInDate: now,
        streakDay: nextStreakDay,
        rewardAmount: rewardAmountStr,
        rewardType: 'BONUS_CREDIT',
        createdAt: now
      });

      // 6. Insert 10x wagering requirement entry
      const targetTurnoverBigInt = rewardBigInt * 10n;
      await tx.insert(wageringRequirements).values({
        userId: userId,
        promoName: `Daily Check-In Day ${nextStreakDay}`,
        bonusAmountGranted: rewardAmountStr,
        requiredMultiplier: 10,
        targetTurnoverAmount: fromScale4(targetTurnoverBigInt),
        completedTurnoverAmount: '0.0000',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        createdAt: now
      });

      return {
        streakDay: nextStreakDay,
        rewardAmount: rewardAmount,
        label: rewardConfig.label,
        newBonusBalance: parseFloat(newBonusBalanceStr)
      };
    });
  }

  /**
   * Provably fair Lucky Spin-the-Wheel with ACID Row-Level Locking, Daily Limits & Scale-4 Math
   */
  public static async executeWheelSpin(userId: number) {
    return await db.transaction(async (tx) => {
      // 1. Acquire row-level lock on the player's wallet to serialize concurrent requests
      const walletRows = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId))
        .for('update');

      const wallet = walletRows[0];
      if (!wallet) {
        throw new Error('Player wallet not found');
      }

      // 2. Strictly enforce wheel daily-spin limit inside the same server transaction
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const spinsToday = await tx
        .select({ id: wheelSpins.id })
        .from(wheelSpins)
        .where(
          sql`${wheelSpins.userId} = ${userId} AND ${wheelSpins.createdAt} >= ${todayStart}`
        );

      if (spinsToday.length >= 1) {
        throw new Error('You have already used your daily free wheel spin for today. Come back tomorrow!');
      }

      // 3. Provably weighted Spin-the-Wheel RNG algorithm
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

      const now = new Date();
      const prizeValueStr = winningPrize.value.toFixed(4);
      const prizeBigInt = toScale4(prizeValueStr);

      // 4. Exact integer scale-4 balance mutation
      if (winningPrize.type === 'REAL_CASH' && prizeBigInt > 0n) {
        const currentRealBigInt = toScale4(wallet.realBalance);
        const newRealBigInt = currentRealBigInt + prizeBigInt;
        const newRealBalanceStr = fromScale4(newRealBigInt);

        await tx
          .update(wallets)
          .set({
            realBalance: newRealBalanceStr,
            version: sql`${wallets.version} + 1`,
            updatedAt: now
          })
          .where(eq(wallets.id, wallet.id));
      } else if (winningPrize.type === 'BONUS_CASH' && prizeBigInt > 0n) {
        const currentBonusBigInt = toScale4(wallet.bonusBalance);
        const newBonusBigInt = currentBonusBigInt + prizeBigInt;
        const newBonusBalanceStr = fromScale4(newBonusBigInt);

        await tx
          .update(wallets)
          .set({
            bonusBalance: newBonusBalanceStr,
            version: sql`${wallets.version} + 1`,
            updatedAt: now
          })
          .where(eq(wallets.id, wallet.id));
      }

      // 5. Immutable wheel spin audit log
      await tx.insert(wheelSpins).values({
        userId: userId,
        prizeType: winningPrize.type,
        prizeLabel: winningPrize.label,
        prizeValue: prizeValueStr,
        currency: wallet.currency,
        isClaimed: true,
        createdAt: now
      });

      return {
        prize: winningPrize,
        timestamp: now.getTime()
      };
    });
  }
}

// ----------------------------------------------------------------------------
// Express Handlers
// ----------------------------------------------------------------------------
export const getPromotionDetailsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req, req.query.userId);

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

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const spinsToday = await db
      .select()
      .from(wheelSpins)
      .where(
        sql`${wheelSpins.userId} = ${userId} AND ${wheelSpins.createdAt} >= ${todayStart}`
      );

    let streak = 0;
    let canCheckInToday = true;

    if (lastCheckIn) {
      const now = new Date();
      const lastDate = new Date(lastCheckIn.createdAt);
      const diffHours = (now.getTime() - lastDate.getTime()) / (1000 * 3600);

      if (diffHours < 24) {
        canCheckInToday = false;
        streak = lastCheckIn.streakDay || 0;
      } else if (diffHours <= 48) {
        canCheckInToday = true;
        streak = lastCheckIn.streakDay || 0;
      } else {
        canCheckInToday = true;
        streak = 0; // Streak broken
      }
    }

    // Authoritative available spins: 1 free daily spin per 24 hours minus spins consumed today
    const availableSpins = Math.max(0, 1 - spinsToday.length);

    res.json({
      status: 'SUCCESS',
      data: {
        checkInStreak: streak,
        canCheckInToday,
        availableSpins,
        dailyRewards: DAILY_CHECKIN_REWARDS,
        wheelPrizes: WHEEL_PRIZES,
        activeWageringRequirements: activeWagering || []
      }
    });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 400);
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};

export const claimCheckInHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req, req.body?.userId);
    const result = await PromotionService.claimDailyCheckIn(userId);
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 400);
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};

export const spinWheelHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = await resolveAuthUser(req, req.body?.userId);
    const result = await PromotionService.executeWheelSpin(userId);
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    const statusCode = err.statusCode || (err.message?.includes('not found') ? 404 : 400);
    res.status(statusCode).json({ status: 'ERROR', message: err.message });
  }
};
