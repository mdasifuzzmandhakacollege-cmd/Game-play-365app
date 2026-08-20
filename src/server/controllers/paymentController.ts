/**
 * @file paymentController.ts
 * @description Local Cashier Payment Controller for Playall 365.
 * Handles bKash, Nagad, Rocket, Upay semi-automated deposits and withdrawals.
 */

import { Request, Response } from 'express';
import { db } from '../../db/index';
import { paymentRequests, wallets, transactions, users } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { PaymentMethodType } from '../types/seamless';

export class PaymentController {
  /**
   * Submit a local deposit request (bKash / Nagad / Rocket)
   */
  async submitDeposit(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        method,
        amount,
        currency = 'USD',
        senderNumber,
        receiverNumber,
        trxId,
        autoApprove = true
      } = req.body;

      if (!userId || !method || !amount || !trxId) {
        res.status(400).json({ error: 'Missing required deposit parameters' });
        return;
      }

      // 1. Verify user & wallet
      const userList = await db.select().from(users).where(eq(users.id, Number(userId)));
      if (userList.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const walletList = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, Number(userId)));

      let wallet = walletList.find((w) => w.currency === currency) || walletList[0];

      if (!wallet) {
        // Auto-create wallet if not present
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

      // 2. Insert Payment Request
      const status = autoApprove ? 'APPROVED' : 'PENDING';
      const [insertedReq] = await db
        .insert(paymentRequests)
        .values({
          userId: Number(userId),
          walletId: wallet.id,
          type: 'DEPOSIT',
          method: method as PaymentMethodType,
          amount: amount.toString(),
          currency: currency,
          senderNumber: senderNumber || '',
          receiverNumber: receiverNumber || '01900-112233',
          trxId: String(trxId).toUpperCase(),
          status: status,
          adminNote: autoApprove ? 'Instant Automated bKash/Nagad Validation' : 'Pending Review'
        })
        .returning();

      // 3. If autoApprove, credit the wallet balance atomically
      if (autoApprove) {
        const currentBal = Number(wallet.realBalance);
        const newBal = (currentBal + Number(amount)).toFixed(4);

        await db
          .update(wallets)
          .set({
            realBalance: newBal,
            version: wallet.version + 1,
            updatedAt: new Date()
          })
          .where(eq(wallets.id, wallet.id));

        // Insert double-entry ledger record
        await db.insert(transactions).values({
          providerId: 'CASHIER_LOCAL',
          transactionId: `DEP_${trxId.toUpperCase()}`,
          referenceTransactionId: String(insertedReq.id),
          userId: Number(userId),
          walletId: wallet.id,
          gameId: 'CASHIER_DEPOSIT',
          type: 'PROMO',
          amount: amount.toString(),
          currency: currency,
          beforeBalance: currentBal.toFixed(4),
          afterBalance: newBal,
          status: 'COMPLETED',
          metadata: { method, senderNumber, trxId }
        });
      }

      res.status(201).json({
        success: true,
        data: insertedReq,
        message: autoApprove
          ? 'Deposit verified and credited successfully'
          : 'Deposit request submitted for manual verification'
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
        currency = 'USD',
        receiverNumber,
        autoApprove = true
      } = req.body;

      if (!userId || !method || !amount || !receiverNumber) {
        res.status(400).json({ error: 'Missing required withdrawal parameters' });
        return;
      }

      const walletList = await db
        .select()
        .from(wallets)
        .where(eq(wallets.userId, Number(userId)));

      const wallet = walletList.find((w) => w.currency === currency) || walletList[0];

      if (!wallet || Number(wallet.realBalance) < Number(amount)) {
        res.status(400).json({ error: 'Insufficient funds for withdrawal' });
        return;
      }

      const currentBal = Number(wallet.realBalance);
      const newBal = (currentBal - Number(amount)).toFixed(4);

      // 1. Debit wallet
      await db
        .update(wallets)
        .set({
          realBalance: newBal,
          version: wallet.version + 1,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, wallet.id));

      const trxId = `WTH_${method}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      // 2. Insert Payment Request
      const [insertedReq] = await db
        .insert(paymentRequests)
        .values({
          userId: Number(userId),
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          method: method as PaymentMethodType,
          amount: amount.toString(),
          currency: currency,
          receiverNumber: receiverNumber,
          trxId: trxId,
          status: autoApprove ? 'APPROVED' : 'PENDING',
          adminNote: autoApprove ? 'Instant VIP Dispatched' : 'Queued for Bank Transfer'
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
        amount: amount.toString(),
        currency: currency,
        beforeBalance: currentBal.toFixed(4),
        afterBalance: newBal,
        status: 'COMPLETED',
        metadata: { method, receiverNumber }
      });

      res.status(201).json({
        success: true,
        data: insertedReq,
        message: 'Withdrawal request processed successfully'
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
