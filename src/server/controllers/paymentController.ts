/**
 * @file paymentController.ts
 * @description Local Cashier Payment Controller for Playall 365.
 * Handles bKash, Nagad, Rocket, Upay deposits and withdrawals with fail-safe server authority.
 */

import { Request, Response } from 'express';
import { db } from '../../db/index';
import { paymentRequests, wallets, transactions, users } from '../../db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { PaymentMethodType } from '../types/seamless';
import { WageringService, toScale4, fromScale4 } from '../services/wageringService';

export class PaymentController {
  /**
   * Submit a local deposit request (bKash / Nagad / Rocket)
   * In production, deposit submission creates ONLY a PENDING record.
   * Client-controlled autoApprove and direct wallet balance mutation are strictly disabled.
   */
  async submitDeposit(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        method,
        amount,
        currency = 'BDT',
        senderNumber,
        receiverNumber,
        trxId
      } = req.body;

      if (!userId || !method || amount === undefined || amount === null || !trxId) {
        res.status(400).json({ error: 'Missing required deposit parameters' });
        return;
      }

      // Exact Scale-4 validation to prevent floating point inaccuracies
      let amountMinor: bigint;
      try {
        amountMinor = toScale4(String(amount));
      } catch (err: any) {
        res.status(400).json({ error: `Invalid monetary amount: ${err.message}` });
        return;
      }

      if (amountMinor <= 0n) {
        res.status(400).json({ error: 'Deposit amount must be greater than zero' });
        return;
      }

      const normalizedAmount = fromScale4(amountMinor);

      // 1. Verify user exists
      const userList = await db.select().from(users).where(eq(users.id, Number(userId)));
      if (userList.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // 2. Verify or create wallet
      const walletList = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, Number(userId)));

      let wallet = walletList.find((w) => w.currency === currency) || walletList[0];

      if (!wallet) {
        const [newWallet] = await db
          .insert(wallets)
          .values({
            userId: Number(userId),
            currency: currency,
            realBalance: '0.0000',
            bonusBalance: '0.0000',
            lockedBalance: '0.0000'
          })
          .returning();
        wallet = newWallet;
      }

      // 3. Insert Payment Request with strictly PENDING status
      // Real wallet credit is strictly reserved for verified server-side provider callbacks/manual review
      const [insertedReq] = await db
        .insert(paymentRequests)
        .values({
          userId: Number(userId),
          walletId: wallet.id,
          type: 'DEPOSIT',
          method: method as PaymentMethodType,
          amount: normalizedAmount,
          currency: currency,
          senderNumber: senderNumber ? String(senderNumber) : '',
          receiverNumber: receiverNumber ? String(receiverNumber) : '01900-112233',
          trxId: String(trxId).trim().toUpperCase(),
          status: 'PENDING',
          adminNote: 'Deposit submitted, pending provider callback/manual verification'
        })
        .returning();

      res.status(201).json({
        success: true,
        data: insertedReq,
        message: 'Deposit request submitted for manual/provider verification'
      });
    } catch (err: any) {
      console.error('[PaymentController Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to submit deposit' });
    }
  }

  /**
   * Submit a local withdrawal request (bKash / Nagad / Rocket)
   */
  async submitWithdrawal(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        method,
        amount,
        currency = 'BDT',
        receiverNumber
      } = req.body;

      if (!userId || !method || amount === undefined || amount === null || !receiverNumber) {
        res.status(400).json({ error: 'Missing required withdrawal parameters' });
        return;
      }

      let amountMinor: bigint;
      try {
        amountMinor = toScale4(String(amount));
      } catch (err: any) {
        res.status(400).json({ error: `Invalid monetary amount: ${err.message}` });
        return;
      }

      if (amountMinor <= 0n) {
        res.status(400).json({ error: 'Withdrawal amount must be greater than zero' });
        return;
      }

      const normalizedAmount = fromScale4(amountMinor);

      // Authoritative Server-Side Wagering Gate Check (PLAY369 Task 5.2)
      const gate = await WageringService.enforceWithdrawalWageringGate({ userId: Number(userId) });
      if (!gate.allowed) {
        res.status(403).json({
          success: false,
          error: `Withdrawal blocked: active wagering requirement is not completed (${gate.reason}).`,
          code: gate.reason || 'WAGERING_REQUIREMENT_INCOMPLETE',
          activeRequirementsCount: gate.activeRequirementsCount,
          activeRequirements: gate.activeRequirements
        });
        return;
      }

      const walletList = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, Number(userId)));

      const wallet = walletList.find((w) => w.currency === currency) || walletList[0];

      if (!wallet) {
        res.status(404).json({ error: 'Wallet not found' });
        return;
      }

      const currentBalMinor = toScale4(wallet.realBalance || '0.0000');
      if (currentBalMinor < amountMinor) {
        res.status(400).json({ error: 'Insufficient funds for withdrawal' });
        return;
      }

      const newBalMinor = currentBalMinor - amountMinor;
      const newBalStr = fromScale4(newBalMinor);

      // 1. Debit wallet using scale-4 string
      await db
        .update(wallets)
        .set({
          realBalance: newBalStr,
          version: sql`${wallets.version} + 1`,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      const trxId = `WTH_${method}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      // 2. Insert Payment Request (PENDING)
      const [insertedReq] = await db
        .insert(paymentRequests)
        .values({
          userId: Number(userId),
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          method: method as PaymentMethodType,
          amount: normalizedAmount,
          currency: currency,
          receiverNumber: String(receiverNumber),
          trxId: trxId,
          status: 'PENDING',
          adminNote: 'Queued for Bank/MFS Transfer'
        })
        .returning();

      // 3. Record transaction
      await db.insert(transactions).values({
        providerId: 'CASHIER_LOCAL',
        transactionId: trxId,
        referenceTransactionId: String(insertedReq.id),
        userId: Number(userId),
        walletId: wallet.id,
        gameId: 'CASHIER_WITHDRAWAL',
        type: 'TIP',
        amount: normalizedAmount,
        currency: currency,
        beforeBalance: fromScale4(currentBalMinor),
        afterBalance: newBalStr,
        status: 'PENDING',
        metadata: { method, receiverNumber }
      });

      res.status(201).json({
        success: true,
        data: insertedReq,
        message: 'Withdrawal request submitted successfully and queued for disbursement'
      });
    } catch (err: any) {
      console.error('[PaymentController Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to submit withdrawal' });
    }
  }

  /**
   * List recent payment requests
   */
  async getRequests(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.query;
      let query = db.select().from(paymentRequests).orderBy(desc(paymentRequests.createdAt));

      if (userId) {
        const results = await db
          .select()
          .from(paymentRequests)
          .where(eq(paymentRequests.userId, Number(userId)))
          .orderBy(desc(paymentRequests.createdAt));
        res.json({ success: true, data: results });
        return;
      }

      const results = await query.limit(50);
      res.json({ success: true, data: results });
    } catch (err: any) {
      console.error('[PaymentController Error]:', err);
      res.status(500).json({ error: err.message || 'Failed to fetch requests' });
    }
  }
}

export const paymentController = new PaymentController();
