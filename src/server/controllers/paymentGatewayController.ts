/**
 * @file paymentGatewayController.ts
 * @description Express API Controller for Gameplay 365 Automated Payment Gateway.
 */

import { Request, Response } from 'express';
import { paymentGatewayEngine } from '../../services/paymentGatewayEngine';
import { PaymentProviderId, PaymentMethod } from '../types/paymentGateway';
import { WageringService } from '../services/wageringService';

export class PaymentGatewayController {
  /**
   * POST /api/v2/payment/deposit/intent
   * Create a unique deposit intent and assign payment destination from the pool
   */
  async createDepositIntent(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        username,
        provider,
        method,
        amount,
        currency = 'BDT',
        idempotencyKey
      } = req.body;

      if (!userId || !provider || !amount) {
        res.status(400).json({ error: 'Missing required parameters: userId, provider, amount' });
        return;
      }

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

      const intent = paymentGatewayEngine.createDepositIntent({
        userId: String(userId),
        username: String(username || `User_${userId}`),
        provider: provider as PaymentProviderId,
        method: (method || provider.toUpperCase()) as PaymentMethod,
        amount: Number(amount),
        currency: currency as 'BDT' | 'USD',
        idempotencyKey: idempotencyKey || req.headers['idempotency-key'] as string,
        clientIp
      });

      res.status(201).json({
        success: true,
        data: intent,
        message: 'Deposit intent created successfully. Please complete payment within 15 minutes.'
      });
    } catch (err: any) {
      console.error('[PaymentGatewayController.createDepositIntent error]:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  }

  /**
   * POST /api/v2/payment/deposit/verify-trx
   * Submit TrxID and trigger the 8-point Automated Verification & Credit Engine
   */
  async verifyTrxId(req: Request, res: Response): Promise<void> {
    try {
      const { depositId, trxId, senderNumber } = req.body;

      if (!depositId || !trxId) {
        res.status(400).json({ error: 'Missing required parameters: depositId, trxId' });
        return;
      }

      const result = await paymentGatewayEngine.verifyAndCreditDeposit({
        depositId: String(depositId),
        trxId: String(trxId),
        senderNumber: senderNumber ? String(senderNumber) : undefined
      });

      res.status(200).json({
        success: true,
        data: result.depositIntent,
        newBalance: result.newBalance,
        message: result.message
      });
    } catch (err: any) {
      console.error('[PaymentGatewayController.verifyTrxId error]:', err);
      const isUnconfigured = err.code === 'PROVIDER_NOT_CONFIGURED' || err.status === 'PENDING_INTEGRATION';
      res.status(isUnconfigured ? 503 : 400).json({
        success: false,
        code: err.code || 'VERIFICATION_FAILED',
        status: err.status || 'FAILED',
        error: err.message || 'Verification failed'
      });
    }
  }

  /**
   * POST /api/v2/payment/withdraw/request
   * Submit withdrawal request with balance reservation and automated payout
   */
  async requestWithdrawal(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        username,
        provider,
        method,
        amount,
        currency = 'BDT',
        recipientAccount,
        recipientName,
        idempotencyKey
      } = req.body;

      if (!userId || !provider || !amount || !recipientAccount) {
        res.status(400).json({ error: 'Missing required parameters: userId, provider, amount, recipientAccount' });
        return;
      }

      // Authoritative Server-Side Wagering Gate Check (PLAY369 Task 5.2)
      const gate = await WageringService.enforceWithdrawalWageringGate({ userId: Number(userId) });
      if (!gate.allowed) {
        res.status(403).json({
          success: false,
          error: `Withdrawal blocked: active wagering requirement is not completed (${gate.reason}).`,
          code: 'WAGERING_REQUIREMENT_INCOMPLETE',
          activeRequirementsCount: gate.activeRequirementsCount,
          activeRequirements: gate.activeRequirements
        });
        return;
      }

      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const key = idempotencyKey || (req.headers['idempotency-key'] as string) || `WD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const record = await paymentGatewayEngine.requestWithdrawal({
        userId: String(userId),
        username: String(username || `User_${userId}`),
        provider: provider as PaymentProviderId,
        method: (method || provider.toUpperCase()) as PaymentMethod,
        amount: Number(amount),
        currency: currency as 'BDT' | 'USD',
        recipientAccount: String(recipientAccount),
        recipientName: recipientName ? String(recipientName) : undefined,
        idempotencyKey: key,
        clientIp
      });

      res.status(201).json({
        success: true,
        data: record,
        message: 'Withdrawal submitted. Balance reserved and payout is being processed.'
      });
    } catch (err: any) {
      console.error('[PaymentGatewayController.requestWithdrawal error]:', err);
      const isUnconfigured = err.code === 'PROVIDER_NOT_CONFIGURED' || err.status === 'PENDING_INTEGRATION';
      res.status(isUnconfigured ? 503 : 400).json({
        success: false,
        code: err.code || 'WITHDRAWAL_FAILED',
        status: err.status || 'FAILED',
        error: err.message || 'Withdrawal failed'
      });
    }
  }

  /**
   * POST /api/v2/payment/webhook/:provider
   * Provider Webhook listener with signature validation
   */
  async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const provider = req.params.provider as PaymentProviderId;
      const signature = (req.headers['x-signature'] || req.headers['x-webhook-signature'] || '') as string;
      if (!signature) {
        res.status(401).json({ error: 'Missing required webhook signature header (x-signature)' });
        return;
      }

      const log = await paymentGatewayEngine.handleWebhook(provider, req.body, signature);

      res.status(200).json({
        received: true,
        processed: log.processed,
        eventId: log.eventId
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/v2/payment/destination-pool
   */
  async getDestinationPool(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: paymentGatewayEngine.getDestinationPool()
    });
  }

  /**
   * GET /api/v2/payment/stats
   */
  async getStats(_req: Request, res: Response): Promise<void> {
    res.json({
      success: true,
      data: paymentGatewayEngine.getStats()
    });
  }
}

export const paymentGatewayController = new PaymentGatewayController();
