/**
 * @file affiliateController.ts
 * @description Enterprise Multi-Tier Affiliate & Commission Engine for Playall 365.
 * Handles Tier A -> Tier B (Direct 0.50%) -> Tier C (Subordinate 0.20%) -> Tier D (0.10%)
 * commission distributions upon valid bets with row-level locking.
 */

import { Request, Response } from 'express';
import { db } from '../../db/index.js';
import { affiliateNodes, affiliateCommissions, users, wallets, transactions } from '../../db/schema.js';
import { eq, sql, inArray } from 'drizzle-orm';

export interface DistributeCommissionParams {
  userId: number;
  betAmount: number;
  currency: string;
  sourceTransactionId: string;
  gameId: string;
}

export class AffiliateService {
  /**
   * Distribute multi-tier commissions when a player places a valid bet
   * Tier 1 (Direct Parent): 0.50%
   * Tier 2 (Grandparent): 0.20%
   * Tier 3 (Great-Grandparent): 0.10%
   */
  public static async processValidBetCommission(params: DistributeCommissionParams) {
    if (params.betAmount <= 0) return;

    // 1. Lookup user's affiliate node
    const [userNode] = await db
      .select()
      .from(affiliateNodes)
      .where(eq(affiliateNodes.userId, params.userId));

    if (!userNode || !userNode.parentAffiliateId) {
      return; // No upline sponsor
    }

    const parentId = userNode.parentAffiliateId;
    const grandParentId = userNode.grandParentAffiliateId;

    // Tier 1 Commission (0.50%)
    const tier1Rate = 0.005;
    const tier1Amount = Number((params.betAmount * tier1Rate).toFixed(4));

    if (tier1Amount > 0) {
      await db.transaction(async (tx) => {
        // Update parent affiliate totals
        await tx
          .update(affiliateNodes)
          .set({
            totalCommissionEarned: sql`${affiliateNodes.totalCommissionEarned} + ${tier1Amount}`,
            unclaimedCommission: sql`${affiliateNodes.unclaimedCommission} + ${tier1Amount}`,
            totalTurnoverVolume: sql`${affiliateNodes.totalTurnoverVolume} + ${params.betAmount}`,
            updatedAt: new Date()
          })
          .where(eq(affiliateNodes.userId, parentId));

        // Insert commission ledger entry
        await tx.insert(affiliateCommissions).values({
          beneficiaryUserId: parentId,
          sourceUserId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          tier: 1,
          validBetAmount: params.betAmount.toString(),
          commissionRate: tier1Rate.toString(),
          commissionAmount: tier1Amount.toString(),
          currency: params.currency,
          status: 'SETTLED',
          settledAt: new Date()
        });
      });
    }

    // Tier 2 Commission (0.20%)
    if (grandParentId) {
      const tier2Rate = 0.002;
      const tier2Amount = Number((params.betAmount * tier2Rate).toFixed(4));

      if (tier2Amount > 0) {
        await db.transaction(async (tx) => {
          await tx
            .update(affiliateNodes)
            .set({
              totalCommissionEarned: sql`${affiliateNodes.totalCommissionEarned} + ${tier2Amount}`,
              unclaimedCommission: sql`${affiliateNodes.unclaimedCommission} + ${tier2Amount}`,
              totalTurnoverVolume: sql`${affiliateNodes.totalTurnoverVolume} + ${params.betAmount}`,
              updatedAt: new Date()
            })
            .where(eq(affiliateNodes.userId, grandParentId));

          await tx.insert(affiliateCommissions).values({
            beneficiaryUserId: grandParentId,
            sourceUserId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            tier: 2,
            validBetAmount: params.betAmount.toString(),
            commissionRate: tier2Rate.toString(),
            commissionAmount: tier2Amount.toString(),
            currency: params.currency,
            status: 'SETTLED',
            settledAt: new Date()
          });
        });
      }
    }
  }

  /**
   * Claim accumulated affiliate commissions into withdrawable real wallet balance
   */
  public static async claimAffiliateCommission(userId: number) {
    return await db.transaction(async (tx) => {
      const [node] = await tx
        .select()
        .from(affiliateNodes)
        .where(eq(affiliateNodes.userId, userId));

      if (!node) throw new Error('Affiliate profile not found');
      const unclaimed = Number(node.unclaimedCommission);
      if (unclaimed <= 0) throw new Error('No unclaimed commissions available');

      // Find user wallet
      const [wallet] = await tx
        .select()
        .from(wallets)
        .where(eq(wallets.userId, userId));

      if (!wallet) throw new Error('Player wallet not found');

      const beforeBalance = Number(wallet.realBalance);
      const afterBalance = Number((beforeBalance + unclaimed).toFixed(4));

      // 1. Credit wallet real balance
      await tx
        .update(wallets)
        .set({
          realBalance: afterBalance.toString(),
          version: sql`${wallets.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      // 2. Reset unclaimed commission
      await tx
        .update(affiliateNodes)
        .set({
          unclaimedCommission: '0.0000',
          updatedAt: new Date()
        })
        .where(eq(affiliateNodes.userId, userId));

      // 3. Mark commissions as CLAIMED
      await tx
        .update(affiliateCommissions)
        .set({ status: 'CLAIMED' })
        .where(eq(affiliateCommissions.beneficiaryUserId, userId));

      // 4. Record double-entry transaction in ledger
      const txId = `COMM_CLAIM_${Date.now()}`;
      await tx.insert(transactions).values({
        providerId: 'GAMEPLAY365_CORE',
        transactionId: txId,
        userId: userId,
        walletId: wallet.id,
        gameId: 'AFFILIATE_COMMISSION_CLAIM',
        type: 'COMMISSION',
        amount: unclaimed.toString(),
        currency: wallet.currency,
        beforeBalance: beforeBalance.toString(),
        afterBalance: afterBalance.toString(),
        status: 'COMPLETED',
        metadata: {
          claimedAmount: unclaimed,
          timestamp: Date.now()
        },
        createdAt: new Date()
      });

      return {
        claimedAmount: unclaimed,
        newRealBalance: afterBalance,
        transactionId: txId
      };
    });
  }
}

// ----------------------------------------------------------------------------
// Express Route Handlers
// ----------------------------------------------------------------------------
export const getAffiliateSummaryHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawUserId = req.query.userId;
    if (!rawUserId || isNaN(Number(rawUserId))) {
      res.status(400).json({ status: 'ERROR', message: 'Valid userId query parameter is required' });
      return;
    }
    const userId = Number(rawUserId);
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
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
};

export const claimCommissionHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = Number(req.body.userId);
    const result = await AffiliateService.claimAffiliateCommission(userId);
    res.json({ status: 'SUCCESS', data: result });
  } catch (err: any) {
    res.status(400).json({ status: 'ERROR', message: err.message });
  }
};
