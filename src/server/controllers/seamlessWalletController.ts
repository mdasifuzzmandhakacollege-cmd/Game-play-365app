/**
 * @file seamlessWalletController.ts
 * @description Express Controller handling the 4 primary B2B Seamless Wallet endpoints:
 * 1. POST /balance
 * 2. POST /bet
 * 3. POST /win
 * 4. POST /refund
 * 
 * Enforces strict 4-second SLA timeout response limit.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/hmac';
import { SeamlessWalletService } from '../services/walletService';
import {
  BalanceRequest,
  BetRequest,
  WinRequest,
  RefundRequest,
  SeamlessErrorCode
} from '../types/seamless';

// Strict Provider SLA timeout (iGaming providers typically drop connection after 4000ms)
const PROVIDER_SLA_TIMEOUT_MS = 3800; // 3.8s hard guard to guarantee response before 4.0s provider timeout

/**
 * Utility wrapper that executes a promise with strict timeout protection
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject({
        code: SeamlessErrorCode.TIMEOUT_EXCEEDED,
        message: `Wallet transaction processing exceeded ${timeoutMs}ms SLA threshold`,
        status: 504
      });
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

export class SeamlessWalletController {
  private walletService: SeamlessWalletService;

  constructor(walletService: SeamlessWalletService) {
    this.walletService = walletService;
  }

  // --------------------------------------------------------------------------
  // 1. POST /balance
  // --------------------------------------------------------------------------
  public getBalance = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const startTime = Date.now();
    try {
      const payload: BalanceRequest = {
        provider_id: req.providerId || req.body.provider_id,
        user_id: req.body.user_id,
        currency: req.body.currency,
        game_id: req.body.game_id,
        session_id: req.body.session_id
      };

      if (!payload.user_id || !payload.currency) {
        res.status(400).json({
          code: SeamlessErrorCode.INVALID_REQUEST,
          message: "Missing mandatory fields: 'user_id' and 'currency' are required",
          timestamp: Date.now()
        });
        return;
      }

      const result = await withTimeout(
        this.walletService.getBalance(payload),
        PROVIDER_SLA_TIMEOUT_MS
      );

      res.setHeader('X-Response-Time-Ms', Date.now() - startTime);
      res.status(200).json(result);
    } catch (err: any) {
      this.handleError(err, res, startTime);
    }
  };

  // --------------------------------------------------------------------------
  // 2. POST /bet
  // --------------------------------------------------------------------------
  public processBet = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const startTime = Date.now();
    try {
      const payload: BetRequest = {
        provider_id: req.providerId || req.body.provider_id,
        user_id: req.body.user_id,
        currency: req.body.currency,
        transaction_id: req.body.transaction_id,
        round_id: req.body.round_id,
        game_id: req.body.game_id,
        amount: Number(req.body.amount),
        session_id: req.body.session_id,
        is_round_end: req.body.is_round_end,
        metadata: req.body.metadata
      };

      if (
        !payload.user_id ||
        !payload.currency ||
        !payload.transaction_id ||
        !payload.round_id ||
        payload.amount === undefined ||
        isNaN(payload.amount)
      ) {
        res.status(400).json({
          code: SeamlessErrorCode.INVALID_REQUEST,
          message: 'Missing mandatory fields for bet transaction (user_id, currency, transaction_id, round_id, amount)',
          timestamp: Date.now()
        });
        return;
      }

      const result = await withTimeout(
        this.walletService.processBet(payload),
        PROVIDER_SLA_TIMEOUT_MS
      );

      res.setHeader('X-Response-Time-Ms', Date.now() - startTime);
      res.status(200).json(result);
    } catch (err: any) {
      this.handleError(err, res, startTime);
    }
  };

  // --------------------------------------------------------------------------
  // 3. POST /win
  // --------------------------------------------------------------------------
  public processWin = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const startTime = Date.now();
    try {
      const payload: WinRequest = {
        provider_id: req.providerId || req.body.provider_id,
        user_id: req.body.user_id,
        currency: req.body.currency,
        transaction_id: req.body.transaction_id,
        reference_transaction_id: req.body.reference_transaction_id,
        round_id: req.body.round_id,
        game_id: req.body.game_id,
        amount: Number(req.body.amount),
        is_round_end: req.body.is_round_end !== false,
        jackpot_amount: req.body.jackpot_amount ? Number(req.body.jackpot_amount) : undefined,
        metadata: req.body.metadata
      };

      if (
        !payload.user_id ||
        !payload.currency ||
        !payload.transaction_id ||
        !payload.round_id ||
        payload.amount === undefined ||
        isNaN(payload.amount)
      ) {
        res.status(400).json({
          code: SeamlessErrorCode.INVALID_REQUEST,
          message: 'Missing mandatory fields for win payout (user_id, currency, transaction_id, round_id, amount)',
          timestamp: Date.now()
        });
        return;
      }

      const result = await withTimeout(
        this.walletService.processWin(payload),
        PROVIDER_SLA_TIMEOUT_MS
      );

      res.setHeader('X-Response-Time-Ms', Date.now() - startTime);
      res.status(200).json(result);
    } catch (err: any) {
      this.handleError(err, res, startTime);
    }
  };

  // --------------------------------------------------------------------------
  // 4. POST /refund
  // --------------------------------------------------------------------------
  public processRefund = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const startTime = Date.now();
    try {
      const payload: RefundRequest = {
        provider_id: req.providerId || req.body.provider_id,
        user_id: req.body.user_id,
        currency: req.body.currency,
        transaction_id: req.body.transaction_id,
        reference_transaction_id: req.body.reference_transaction_id,
        round_id: req.body.round_id,
        game_id: req.body.game_id,
        amount: Number(req.body.amount || 0),
        reason: req.body.reason,
        metadata: req.body.metadata
      };

      if (
        !payload.user_id ||
        !payload.currency ||
        !payload.transaction_id ||
        !payload.reference_transaction_id ||
        !payload.round_id
      ) {
        res.status(400).json({
          code: SeamlessErrorCode.INVALID_REQUEST,
          message: 'Missing mandatory fields for refund (user_id, currency, transaction_id, reference_transaction_id, round_id)',
          timestamp: Date.now()
        });
        return;
      }

      const result = await withTimeout(
        this.walletService.processRefund(payload),
        PROVIDER_SLA_TIMEOUT_MS
      );

      res.setHeader('X-Response-Time-Ms', Date.now() - startTime);
      res.status(200).json(result);
    } catch (err: any) {
      this.handleError(err, res, startTime);
    }
  };

  /**
   * Centralized HTTP error mapper preserving provider-expected status codes and error payloads
   */
  private handleError(err: any, res: Response, startTime: number): void {
    const latency = Date.now() - startTime;
    res.setHeader('X-Response-Time-Ms', latency);

    const statusCode = err.status || 500;
    const errorCode = err.code || SeamlessErrorCode.INTERNAL_ERROR;
    const message = err.message || 'Internal wallet error during transaction execution';

    console.error(`[SeamlessController] Error (${errorCode} - ${statusCode}):`, err);

    res.status(statusCode).json({
      code: errorCode,
      message,
      balance: err.balance !== undefined ? err.balance : undefined,
      currency: err.currency !== undefined ? err.currency : undefined,
      timestamp: Date.now()
    });
  }
}
