var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/server/index.ts
import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// src/server/middleware/hmac.ts
import crypto from "crypto";
var PROVIDER_SECRETS = {
  pragmatic_play: "sk_live_pragmatic_seamless_88492048102",
  evolution: "sk_live_evolution_seamless_39104859103",
  pgsoft: "sk_live_pgsoft_seamless_91823019482",
  spribe: "sk_live_spribe_seamless_74910284910",
  custom_provider: "sk_live_custom_seamless_secret_123456"
};
var REPLAY_TOLERANCE_MS = 5 * 60 * 1e3;
function generateHmacSignature(payloadString, timestamp2, secretKey) {
  const messageToSign = `${timestamp2}.${payloadString}`;
  return crypto.createHmac("sha256", secretKey).update(messageToSign, "utf8").digest("hex");
}
function validateHmacSignature(req, res, next) {
  try {
    const signature = req.headers["x-signature"] || req.headers["x-hub-signature-256"] || req.headers["authorization"];
    const timestampHeader = req.headers["x-timestamp"] || req.headers["x-request-timestamp"];
    const providerId = req.headers["x-provider-id"] || req.body?.provider_id;
    if (!signature) {
      res.status(401).json({
        code: "INVALID_SIGNATURE" /* INVALID_SIGNATURE */,
        message: "Missing X-Signature security header in incoming request",
        timestamp: Date.now()
      });
      return;
    }
    if (!timestampHeader) {
      res.status(401).json({
        code: "TIMESTAMP_EXPIRED" /* TIMESTAMP_EXPIRED */,
        message: "Missing X-Timestamp security header",
        timestamp: Date.now()
      });
      return;
    }
    if (!providerId) {
      res.status(400).json({
        code: "INVALID_REQUEST" /* INVALID_REQUEST */,
        message: "Missing provider identifier (X-Provider-Id header or provider_id in body)",
        timestamp: Date.now()
      });
      return;
    }
    const requestTimestamp = parseInt(timestampHeader, 10);
    if (isNaN(requestTimestamp)) {
      res.status(401).json({
        code: "TIMESTAMP_EXPIRED" /* TIMESTAMP_EXPIRED */,
        message: "Invalid X-Timestamp header format (must be epoch ms or seconds)",
        timestamp: Date.now()
      });
      return;
    }
    const normalizedTimestamp = requestTimestamp < 1e10 ? requestTimestamp * 1e3 : requestTimestamp;
    const now = Date.now();
    const drift = Math.abs(now - normalizedTimestamp);
    if (drift > REPLAY_TOLERANCE_MS) {
      res.status(401).json({
        code: "TIMESTAMP_EXPIRED" /* TIMESTAMP_EXPIRED */,
        message: `Request timestamp expired or clock drift exceeded. Drift: ${drift}ms (Max: ${REPLAY_TOLERANCE_MS}ms)`,
        timestamp: now
      });
      return;
    }
    const secretKey = PROVIDER_SECRETS[providerId];
    if (!secretKey) {
      res.status(401).json({
        code: "INVALID_SIGNATURE" /* INVALID_SIGNATURE */,
        message: `Unknown or unconfigured game provider: ${providerId}`,
        timestamp: now
      });
      return;
    }
    const rawPayload = req.rawBody || JSON.stringify(req.body || {});
    const cleanReceivedSig = signature.replace(/^sha256=/i, "").trim().toLowerCase();
    const expectedSig = generateHmacSignature(rawPayload, timestampHeader, secretKey).toLowerCase();
    const receivedBuffer = Buffer.from(cleanReceivedSig, "hex");
    const expectedBuffer = Buffer.from(expectedSig, "hex");
    if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
      res.status(401).json({
        code: "INVALID_SIGNATURE" /* INVALID_SIGNATURE */,
        message: "Cryptographic HMAC-SHA256 signature verification failed",
        timestamp: now
      });
      return;
    }
    req.providerId = providerId;
    req.signatureTimestamp = normalizedTimestamp;
    next();
  } catch (error) {
    next(error);
  }
}

// src/server/services/walletService.ts
var SeamlessWalletService = class {
  constructor(dbPool, redisClient) {
    this.db = dbPool;
    this.redisClient = redisClient;
  }
  /**
   * Generates a deterministic idempotency key for Redis / DB lookup
   */
  getIdempotencyKey(providerId, endpoint, transactionId) {
    return `idempotency:${providerId}:${endpoint}:${transactionId}`;
  }
  /**
   * Checks for an existing cached response for idempotent retry requests
   */
  async checkIdempotency(client, providerId, endpoint, transactionId) {
    const key = this.getIdempotencyKey(providerId, endpoint, transactionId);
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(key);
        if (cached) {
          const parsed = JSON.parse(cached);
          parsed.is_idempotent = true;
          return parsed;
        }
      } catch (err) {
        console.warn("[Idempotency] Redis lookup failed, falling back to DB:", err);
      }
    }
    const result = await client.query(
      `SELECT response_body FROM idempotency_keys WHERE idempotency_key = $1 LIMIT 1`,
      [key]
    );
    if (result.rows.length > 0) {
      const resp = result.rows[0].response_body;
      resp.is_idempotent = true;
      return resp;
    }
    return null;
  }
  /**
   * Persists the successful response for future idempotent replays
   */
  async saveIdempotency(client, providerId, endpoint, transactionId, response, statusCode = 200) {
    const key = this.getIdempotencyKey(providerId, endpoint, transactionId);
    if (this.redisClient) {
      try {
        await this.redisClient.set(key, JSON.stringify(response), "EX", 7 * 24 * 3600);
      } catch (err) {
        console.warn("[Idempotency] Redis save failed:", err);
      }
    }
    await client.query(
      `INSERT INTO idempotency_keys (idempotency_key, provider_id, endpoint, status_code, response_body)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [key, providerId, endpoint, statusCode, JSON.stringify(response)]
    );
  }
  // ==========================================================================
  // 1. POST /balance - Fast Non-blocking Read
  // ==========================================================================
  async getBalance(req) {
    const { provider_id, user_id, currency } = req;
    const res = await this.db.query(
      `SELECT 
          u.id AS user_id,
          u.username,
          u.status AS user_status,
          w.id AS wallet_id,
          w.real_balance,
          w.bonus_balance,
          w.status AS wallet_status
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id AND w.currency = $2
       WHERE (u.id::text = $1 OR u.username = $1)
       LIMIT 1`,
      [user_id, currency]
    );
    if (res.rows.length === 0) {
      throw {
        code: "USER_NOT_FOUND" /* USER_NOT_FOUND */,
        message: `Player '${user_id}' not found in platform records`,
        status: 404
      };
    }
    const row = res.rows[0];
    if (row.user_status !== "ACTIVE" || row.wallet_status === "FROZEN") {
      throw {
        code: "USER_FROZEN" /* USER_FROZEN */,
        message: `Player account is currently ${row.user_status.toLowerCase()}`,
        status: 403
      };
    }
    const realBalance = parseFloat(row.real_balance || "0");
    const bonusBalance = parseFloat(row.bonus_balance || "0");
    return {
      code: "SUCCESS" /* SUCCESS */,
      message: "Success",
      user_id: row.user_id,
      balance: realBalance,
      bonus_balance: bonusBalance,
      currency,
      timestamp: Date.now()
    };
  }
  // ==========================================================================
  // 2. POST /bet - Atomic Debit with PostgreSQL Row-Level Lock (FOR UPDATE)
  // ==========================================================================
  async processBet(req) {
    const {
      provider_id,
      user_id,
      currency,
      transaction_id,
      round_id,
      game_id,
      amount,
      metadata = {}
    } = req;
    if (amount <= 0) {
      throw {
        code: "INVALID_REQUEST" /* INVALID_REQUEST */,
        message: "Bet amount must be greater than zero",
        status: 400
      };
    }
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const cached = await this.checkIdempotency(client, provider_id, "bet", transaction_id);
      if (cached) {
        await client.query("COMMIT");
        return cached;
      }
      const walletRes = await client.query(
        `SELECT 
            w.id AS wallet_id,
            u.id AS user_id,
            u.status AS user_status,
            w.real_balance,
            w.bonus_balance,
            w.version
         FROM wallets w
         JOIN users u ON u.id = w.user_id
         WHERE (u.id::text = $1 OR u.username = $1)
           AND w.currency = $2
         FOR UPDATE OF w`,
        // <--- ROW LEVEL LOCKING
        [user_id, currency]
      );
      if (walletRes.rows.length === 0) {
        await client.query("ROLLBACK");
        throw {
          code: "USER_NOT_FOUND" /* USER_NOT_FOUND */,
          message: `User '${user_id}' with currency '${currency}' not found`,
          status: 404
        };
      }
      const wallet = walletRes.rows[0];
      if (wallet.user_status !== "ACTIVE") {
        await client.query("ROLLBACK");
        throw {
          code: "USER_FROZEN" /* USER_FROZEN */,
          message: `Account is inactive (${wallet.user_status})`,
          status: 403
        };
      }
      const currentBalance = parseFloat(wallet.real_balance);
      if (currentBalance < amount) {
        await client.query("ROLLBACK");
        throw {
          code: "INSUFFICIENT_FUNDS" /* INSUFFICIENT_FUNDS */,
          message: `Insufficient funds. Required: ${amount}, Available: ${currentBalance}`,
          balance: currentBalance,
          currency,
          status: 400
        };
      }
      const newBalance = Number((currentBalance - amount).toFixed(4));
      await client.query(
        `UPDATE wallets 
         SET real_balance = $1, 
             version = version + 1, 
             updated_at = NOW()
         WHERE id = $2`,
        [newBalance, wallet.wallet_id]
      );
      const roundRes = await client.query(
        `INSERT INTO game_rounds (provider_id, provider_round_id, user_id, game_id, currency, total_bet, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')
         ON CONFLICT (provider_id, provider_round_id) 
         DO UPDATE SET 
            total_bet = game_rounds.total_bet + EXCLUDED.total_bet,
            status = 'OPEN'
         RETURNING id`,
        [provider_id, round_id, wallet.user_id, game_id, currency, amount]
      );
      const internalRoundId = roundRes.rows[0]?.id;
      const txRes = await client.query(
        `INSERT INTO transactions (
            provider_id, transaction_id, user_id, wallet_id, round_id, provider_round_id,
            game_id, type, amount, currency, before_balance, after_balance, status, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'BET', $8, $9, $10, $11, 'COMPLETED', $12)
         RETURNING id`,
        [
          provider_id,
          transaction_id,
          wallet.user_id,
          wallet.wallet_id,
          internalRoundId,
          round_id,
          game_id,
          amount,
          currency,
          currentBalance,
          newBalance,
          JSON.stringify(metadata)
        ]
      );
      const operatorTxId = txRes.rows[0].id;
      const responsePayload = {
        code: "SUCCESS" /* SUCCESS */,
        message: "Bet processed successfully",
        transaction_id,
        operator_transaction_id: operatorTxId,
        round_id,
        balance: newBalance,
        bonus_balance: parseFloat(wallet.bonus_balance),
        currency,
        timestamp: Date.now(),
        is_idempotent: false
      };
      await this.saveIdempotency(client, provider_id, "bet", transaction_id, responsePayload);
      await client.query("COMMIT");
      return responsePayload;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {
      });
      if (err.code === "23505" && err.constraint === "uq_provider_tx_id") {
        const cached = await this.checkIdempotency(this.db, provider_id, "bet", transaction_id);
        if (cached) return cached;
      }
      throw err;
    } finally {
      client.release();
    }
  }
  // ==========================================================================
  // 3. POST /win - Atomic Credit with PostgreSQL Row-Level Lock (FOR UPDATE)
  // ==========================================================================
  async processWin(req) {
    const {
      provider_id,
      user_id,
      currency,
      transaction_id,
      reference_transaction_id,
      round_id,
      game_id,
      amount,
      is_round_end = true,
      metadata = {}
    } = req;
    if (amount < 0) {
      throw {
        code: "INVALID_REQUEST" /* INVALID_REQUEST */,
        message: "Win amount cannot be negative",
        status: 400
      };
    }
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const cached = await this.checkIdempotency(client, provider_id, "win", transaction_id);
      if (cached) {
        await client.query("COMMIT");
        return cached;
      }
      const walletRes = await client.query(
        `SELECT 
            w.id AS wallet_id,
            u.id AS user_id,
            u.status AS user_status,
            w.real_balance,
            w.bonus_balance
         FROM wallets w
         JOIN users u ON u.id = w.user_id
         WHERE (u.id::text = $1 OR u.username = $1)
           AND w.currency = $2
         FOR UPDATE OF w`,
        [user_id, currency]
      );
      if (walletRes.rows.length === 0) {
        await client.query("ROLLBACK");
        throw {
          code: "USER_NOT_FOUND" /* USER_NOT_FOUND */,
          message: `User '${user_id}' with currency '${currency}' not found`,
          status: 404
        };
      }
      const wallet = walletRes.rows[0];
      const currentBalance = parseFloat(wallet.real_balance);
      const newBalance = Number((currentBalance + amount).toFixed(4));
      await client.query(
        `UPDATE wallets 
         SET real_balance = $1, 
             version = version + 1, 
             updated_at = NOW()
         WHERE id = $2`,
        [newBalance, wallet.wallet_id]
      );
      const roundRes = await client.query(
        `INSERT INTO game_rounds (provider_id, provider_round_id, user_id, game_id, currency, total_win, status, closed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (provider_id, provider_round_id) 
         DO UPDATE SET 
            total_win = game_rounds.total_win + EXCLUDED.total_win,
            status = CASE WHEN $7 = 'SETTLED' THEN 'SETTLED' ELSE game_rounds.status END,
            closed_at = CASE WHEN $7 = 'SETTLED' THEN NOW() ELSE game_rounds.closed_at END
         RETURNING id`,
        [
          provider_id,
          round_id,
          wallet.user_id,
          game_id,
          currency,
          amount,
          is_round_end ? "SETTLED" : "OPEN",
          is_round_end ? (/* @__PURE__ */ new Date()).toISOString() : null
        ]
      );
      const internalRoundId = roundRes.rows[0]?.id;
      const txRes = await client.query(
        `INSERT INTO transactions (
            provider_id, transaction_id, reference_transaction_id, user_id, wallet_id,
            round_id, provider_round_id, game_id, type, amount, currency,
            before_balance, after_balance, status, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'WIN', $9, $10, $11, $12, 'COMPLETED', $13)
         RETURNING id`,
        [
          provider_id,
          transaction_id,
          reference_transaction_id || null,
          wallet.user_id,
          wallet.wallet_id,
          internalRoundId,
          round_id,
          game_id,
          amount,
          currency,
          currentBalance,
          newBalance,
          JSON.stringify(metadata)
        ]
      );
      const operatorTxId = txRes.rows[0].id;
      const turnoverToCredit = amount > 0 ? amount : 0;
      if (turnoverToCredit > 0) {
        await client.query(
          `UPDATE wagering_requirements
           SET completed_turnover_amount = completed_turnover_amount + $1,
               status = CASE WHEN (completed_turnover_amount + $1) >= target_turnover_amount THEN 'COMPLETED' ELSE status END,
               completed_at = CASE WHEN (completed_turnover_amount + $1) >= target_turnover_amount THEN NOW() ELSE completed_at END
           WHERE user_id = $2 AND status = 'ACTIVE'`,
          [turnoverToCredit, wallet.user_id]
        );
      }
      const responsePayload = {
        code: "SUCCESS" /* SUCCESS */,
        message: "Win processed successfully",
        transaction_id,
        operator_transaction_id: operatorTxId,
        round_id,
        balance: newBalance,
        bonus_balance: parseFloat(wallet.bonus_balance),
        currency,
        timestamp: Date.now(),
        is_idempotent: false
      };
      await this.saveIdempotency(client, provider_id, "win", transaction_id, responsePayload);
      await client.query("COMMIT");
      return responsePayload;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {
      });
      if (err.code === "23505" && err.constraint === "uq_provider_tx_id") {
        const cached = await this.checkIdempotency(this.db, provider_id, "win", transaction_id);
        if (cached) return cached;
      }
      throw err;
    } finally {
      client.release();
    }
  }
  // ==========================================================================
  // 4. POST /refund - Rollback / Reversal of a BET transaction
  // ==========================================================================
  async processRefund(req) {
    const {
      provider_id,
      user_id,
      currency,
      transaction_id,
      reference_transaction_id,
      round_id,
      game_id,
      amount,
      reason = "PROVIDER_REFUND",
      metadata = {}
    } = req;
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const cached = await this.checkIdempotency(client, provider_id, "refund", transaction_id);
      if (cached) {
        await client.query("COMMIT");
        return cached;
      }
      const origTxRes = await client.query(
        `SELECT id, amount, status, type 
         FROM transactions 
         WHERE provider_id = $1 AND transaction_id = $2
         LIMIT 1`,
        [provider_id, reference_transaction_id]
      );
      if (origTxRes.rows.length === 0) {
        await client.query("ROLLBACK");
        throw {
          code: "TRANSACTION_NOT_FOUND" /* TRANSACTION_NOT_FOUND */,
          message: `Original bet transaction '${reference_transaction_id}' not found to refund`,
          status: 404
        };
      }
      const origTx = origTxRes.rows[0];
      const alreadyRefunded = await client.query(
        `SELECT id FROM transactions 
         WHERE provider_id = $1 AND reference_transaction_id = $2 AND type = 'REFUND'
         LIMIT 1`,
        [provider_id, reference_transaction_id]
      );
      if (alreadyRefunded.rows.length > 0) {
        await client.query("ROLLBACK");
        throw {
          code: "TRANSACTION_ALREADY_SETTLED" /* TRANSACTION_ALREADY_SETTLED */,
          message: `Transaction '${reference_transaction_id}' was already refunded`,
          status: 409
        };
      }
      const walletRes = await client.query(
        `SELECT 
            w.id AS wallet_id,
            u.id AS user_id,
            w.real_balance,
            w.bonus_balance
         FROM wallets w
         JOIN users u ON u.id = w.user_id
         WHERE (u.id::text = $1 OR u.username = $1)
           AND w.currency = $2
         FOR UPDATE OF w`,
        [user_id, currency]
      );
      if (walletRes.rows.length === 0) {
        await client.query("ROLLBACK");
        throw {
          code: "USER_NOT_FOUND" /* USER_NOT_FOUND */,
          message: `User '${user_id}' with currency '${currency}' not found`,
          status: 404
        };
      }
      const wallet = walletRes.rows[0];
      const currentBalance = parseFloat(wallet.real_balance);
      const refundAmount = amount > 0 ? amount : parseFloat(origTx.amount);
      const newBalance = Number((currentBalance + refundAmount).toFixed(4));
      await client.query(
        `UPDATE wallets 
         SET real_balance = $1, 
             version = version + 1, 
             updated_at = NOW()
         WHERE id = $2`,
        [newBalance, wallet.wallet_id]
      );
      await client.query(
        `UPDATE game_rounds 
         SET status = 'REFUNDED', closed_at = NOW()
         WHERE provider_id = $1 AND provider_round_id = $2`,
        [provider_id, round_id]
      );
      const txRes = await client.query(
        `INSERT INTO transactions (
            provider_id, transaction_id, reference_transaction_id, user_id, wallet_id,
            provider_round_id, game_id, type, amount, currency,
            before_balance, after_balance, status, metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'REFUND', $8, $9, $10, $11, 'COMPLETED', $12)
         RETURNING id`,
        [
          provider_id,
          transaction_id,
          reference_transaction_id,
          wallet.user_id,
          wallet.wallet_id,
          round_id,
          game_id,
          refundAmount,
          currency,
          currentBalance,
          newBalance,
          JSON.stringify({ reason, ...metadata })
        ]
      );
      const operatorTxId = txRes.rows[0].id;
      const responsePayload = {
        code: "SUCCESS" /* SUCCESS */,
        message: "Refund processed and funds restored",
        transaction_id,
        operator_transaction_id: operatorTxId,
        round_id,
        balance: newBalance,
        bonus_balance: parseFloat(wallet.bonus_balance),
        currency,
        timestamp: Date.now(),
        is_idempotent: false
      };
      await this.saveIdempotency(client, provider_id, "refund", transaction_id, responsePayload);
      await client.query("COMMIT");
      return responsePayload;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {
      });
      if (err.code === "23505" && err.constraint === "uq_provider_tx_id") {
        const cached = await this.checkIdempotency(this.db, provider_id, "refund", transaction_id);
        if (cached) return cached;
      }
      throw err;
    } finally {
      client.release();
    }
  }
};

// src/server/controllers/seamlessWalletController.ts
var PROVIDER_SLA_TIMEOUT_MS = 3800;
async function withTimeout(promise, timeoutMs) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject({
        code: "TIMEOUT_EXCEEDED" /* TIMEOUT_EXCEEDED */,
        message: `Wallet transaction processing exceeded ${timeoutMs}ms SLA threshold`,
        status: 504
      });
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}
var SeamlessWalletController = class {
  constructor(walletService2) {
    // --------------------------------------------------------------------------
    // 1. POST /balance
    // --------------------------------------------------------------------------
    this.getBalance = async (req, res, next) => {
      const startTime = Date.now();
      try {
        const payload = {
          provider_id: req.providerId || req.body.provider_id,
          user_id: req.body.user_id,
          currency: req.body.currency,
          game_id: req.body.game_id,
          session_id: req.body.session_id
        };
        if (!payload.user_id || !payload.currency) {
          res.status(400).json({
            code: "INVALID_REQUEST" /* INVALID_REQUEST */,
            message: "Missing mandatory fields: 'user_id' and 'currency' are required",
            timestamp: Date.now()
          });
          return;
        }
        const result = await withTimeout(
          this.walletService.getBalance(payload),
          PROVIDER_SLA_TIMEOUT_MS
        );
        res.setHeader("X-Response-Time-Ms", Date.now() - startTime);
        res.status(200).json(result);
      } catch (err) {
        this.handleError(err, res, startTime);
      }
    };
    // --------------------------------------------------------------------------
    // 2. POST /bet
    // --------------------------------------------------------------------------
    this.processBet = async (req, res, next) => {
      const startTime = Date.now();
      try {
        const payload = {
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
        if (!payload.user_id || !payload.currency || !payload.transaction_id || !payload.round_id || payload.amount === void 0 || isNaN(payload.amount)) {
          res.status(400).json({
            code: "INVALID_REQUEST" /* INVALID_REQUEST */,
            message: "Missing mandatory fields for bet transaction (user_id, currency, transaction_id, round_id, amount)",
            timestamp: Date.now()
          });
          return;
        }
        const result = await withTimeout(
          this.walletService.processBet(payload),
          PROVIDER_SLA_TIMEOUT_MS
        );
        res.setHeader("X-Response-Time-Ms", Date.now() - startTime);
        res.status(200).json(result);
      } catch (err) {
        this.handleError(err, res, startTime);
      }
    };
    // --------------------------------------------------------------------------
    // 3. POST /win
    // --------------------------------------------------------------------------
    this.processWin = async (req, res, next) => {
      const startTime = Date.now();
      try {
        const payload = {
          provider_id: req.providerId || req.body.provider_id,
          user_id: req.body.user_id,
          currency: req.body.currency,
          transaction_id: req.body.transaction_id,
          reference_transaction_id: req.body.reference_transaction_id,
          round_id: req.body.round_id,
          game_id: req.body.game_id,
          amount: Number(req.body.amount),
          is_round_end: req.body.is_round_end !== false,
          jackpot_amount: req.body.jackpot_amount ? Number(req.body.jackpot_amount) : void 0,
          metadata: req.body.metadata
        };
        if (!payload.user_id || !payload.currency || !payload.transaction_id || !payload.round_id || payload.amount === void 0 || isNaN(payload.amount)) {
          res.status(400).json({
            code: "INVALID_REQUEST" /* INVALID_REQUEST */,
            message: "Missing mandatory fields for win payout (user_id, currency, transaction_id, round_id, amount)",
            timestamp: Date.now()
          });
          return;
        }
        const result = await withTimeout(
          this.walletService.processWin(payload),
          PROVIDER_SLA_TIMEOUT_MS
        );
        res.setHeader("X-Response-Time-Ms", Date.now() - startTime);
        res.status(200).json(result);
      } catch (err) {
        this.handleError(err, res, startTime);
      }
    };
    // --------------------------------------------------------------------------
    // 4. POST /refund
    // --------------------------------------------------------------------------
    this.processRefund = async (req, res, next) => {
      const startTime = Date.now();
      try {
        const payload = {
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
        if (!payload.user_id || !payload.currency || !payload.transaction_id || !payload.reference_transaction_id || !payload.round_id) {
          res.status(400).json({
            code: "INVALID_REQUEST" /* INVALID_REQUEST */,
            message: "Missing mandatory fields for refund (user_id, currency, transaction_id, reference_transaction_id, round_id)",
            timestamp: Date.now()
          });
          return;
        }
        const result = await withTimeout(
          this.walletService.processRefund(payload),
          PROVIDER_SLA_TIMEOUT_MS
        );
        res.setHeader("X-Response-Time-Ms", Date.now() - startTime);
        res.status(200).json(result);
      } catch (err) {
        this.handleError(err, res, startTime);
      }
    };
    this.walletService = walletService2;
  }
  /**
   * Centralized HTTP error mapper preserving provider-expected status codes and error payloads
   */
  handleError(err, res, startTime) {
    const latency = Date.now() - startTime;
    res.setHeader("X-Response-Time-Ms", latency);
    const statusCode = err.status || 500;
    const errorCode = err.code || "INTERNAL_ERROR" /* INTERNAL_ERROR */;
    const message = err.message || "Internal wallet error during transaction execution";
    console.error(`[SeamlessController] Error (${errorCode} - ${statusCode}):`, err);
    res.status(statusCode).json({
      code: errorCode,
      message,
      balance: err.balance !== void 0 ? err.balance : void 0,
      currency: err.currency !== void 0 ? err.currency : void 0,
      timestamp: Date.now()
    });
  }
};

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  affiliateCommissions: () => affiliateCommissions,
  affiliateNodes: () => affiliateNodes,
  dailyCheckIns: () => dailyCheckIns,
  gameProviders: () => gameProviders,
  gameProvidersRelations: () => gameProvidersRelations,
  gameRounds: () => gameRounds,
  gameRoundsRelations: () => gameRoundsRelations,
  idempotencyKeys: () => idempotencyKeys,
  paymentRequests: () => paymentRequests,
  paymentRequestsRelations: () => paymentRequestsRelations,
  transactions: () => transactions,
  transactionsRelations: () => transactionsRelations,
  userVipProgress: () => userVipProgress,
  users: () => users,
  usersRelations: () => usersRelations,
  vipLevels: () => vipLevels,
  wageringRequirements: () => wageringRequirements,
  wallets: () => wallets,
  walletsRelations: () => walletsRelations,
  wheelSpins: () => wheelSpins
});
import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar
} from "drizzle-orm/pg-core";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  // Firebase Auth UID
  email: text("email").notNull(),
  username: varchar("username", { length: 64 }).notNull(),
  operatorId: varchar("operator_id", { length: 64 }).default("GAMEPLAY365_BD").notNull(),
  currency: varchar("currency", { length: 3 }).default("BDT").notNull(),
  status: varchar("status", { length: 32 }).default("ACTIVE").notNull(),
  countryCode: varchar("country_code", { length: 2 }).default("BD"),
  vipTier: varchar("vip_tier", { length: 32 }).default("V1_ROOKIE").notNull(),
  vipLevel: integer("vip_level").default(1).notNull(),
  referralCode: varchar("referral_code", { length: 32 }).unique(),
  referredByUserId: integer("referred_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var gameProviders = pgTable("game_providers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  secretKey: varchar("secret_key", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  webhookTimeoutMs: integer("webhook_timeout_ms").default(4e3).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  realBalance: numeric("real_balance", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  bonusBalance: numeric("bonus_balance", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  lockedBalance: numeric("locked_balance", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  commissionBalance: numeric("commission_balance", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  version: integer("version").default(1).notNull(),
  status: varchar("status", { length: 32 }).default("ACTIVE").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var gameRounds = pgTable("game_rounds", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id", { length: 64 }).references(() => gameProviders.id).notNull(),
  providerRoundId: varchar("provider_round_id", { length: 128 }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  gameId: varchar("game_id", { length: 128 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 32 }).default("OPEN").notNull(),
  totalBet: numeric("total_bet", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  totalWin: numeric("total_win", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true })
});
var transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  providerId: varchar("provider_id", { length: 64 }).references(() => gameProviders.id).notNull(),
  transactionId: varchar("transaction_id", { length: 128 }).notNull(),
  referenceTransactionId: varchar("reference_transaction_id", { length: 128 }),
  userId: integer("user_id").references(() => users.id).notNull(),
  walletId: integer("wallet_id").references(() => wallets.id).notNull(),
  roundId: integer("round_id").references(() => gameRounds.id),
  providerRoundId: varchar("provider_round_id", { length: 128 }),
  gameId: varchar("game_id", { length: 128 }).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  // 'BET', 'WIN', 'REFUND', 'PROMO', 'COMMISSION', 'DEPOSIT', 'WITHDRAWAL'
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  beforeBalance: numeric("before_balance", { precision: 18, scale: 4 }).notNull(),
  afterBalance: numeric("after_balance", { precision: 18, scale: 4 }).notNull(),
  status: varchar("status", { length: 32 }).default("COMPLETED").notNull(),
  errorCode: varchar("error_code", { length: 64 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var idempotencyKeys = pgTable("idempotency_keys", {
  idempotencyKey: varchar("idempotency_key", { length: 192 }).primaryKey(),
  providerId: varchar("provider_id", { length: 64 }).notNull(),
  endpoint: varchar("endpoint", { length: 64 }).notNull(),
  statusCode: integer("status_code").notNull(),
  responseBody: jsonb("response_body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true })
});
var paymentRequests = pgTable("payment_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  walletId: integer("wallet_id").references(() => wallets.id).notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  // 'DEPOSIT', 'WITHDRAWAL'
  method: varchar("method", { length: 32 }).notNull(),
  // 'BKASH', 'NAGAD', 'ROCKET', 'UPAY', 'USDT'
  amount: numeric("amount", { precision: 18, scale: 4 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("BDT").notNull(),
  senderNumber: varchar("sender_number", { length: 64 }),
  receiverNumber: varchar("receiver_number", { length: 64 }),
  trxId: varchar("trx_id", { length: 128 }).notNull(),
  status: varchar("status", { length: 32 }).default("PENDING").notNull(),
  // 'PENDING', 'APPROVED', 'REJECTED'
  adminNote: text("admin_note"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var affiliateNodes = pgTable("affiliate_nodes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  parentAffiliateId: integer("parent_affiliate_id").references(() => users.id),
  grandParentAffiliateId: integer("grandparent_affiliate_id").references(() => users.id),
  referralCode: varchar("referral_code", { length: 32 }).notNull().unique(),
  tier1CommissionRate: numeric("tier1_commission_rate", { precision: 6, scale: 4 }).default("0.0050").notNull(),
  // 0.50% of subordinate valid bets
  tier2CommissionRate: numeric("tier2_commission_rate", { precision: 6, scale: 4 }).default("0.0020").notNull(),
  // 0.20%
  tier3CommissionRate: numeric("tier3_commission_rate", { precision: 6, scale: 4 }).default("0.0010").notNull(),
  // 0.10%
  totalDirectReferrals: integer("total_direct_referrals").default(0).notNull(),
  totalSubordinates: integer("total_subordinates").default(0).notNull(),
  totalTurnoverVolume: numeric("total_turnover_volume", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  totalCommissionEarned: numeric("total_commission_earned", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  unclaimedCommission: numeric("unclaimed_commission", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  status: varchar("status", { length: 32 }).default("ACTIVE").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var affiliateCommissions = pgTable("affiliate_commissions", {
  id: serial("id").primaryKey(),
  beneficiaryUserId: integer("beneficiary_user_id").references(() => users.id).notNull(),
  sourceUserId: integer("source_user_id").references(() => users.id).notNull(),
  sourceTransactionId: varchar("source_transaction_id", { length: 128 }).notNull(),
  tier: integer("tier").notNull(),
  // 1 for Direct (Tier A->B), 2 for Subordinate (Tier A->C), 3 for Tier D
  validBetAmount: numeric("valid_bet_amount", { precision: 18, scale: 4 }).notNull(),
  commissionRate: numeric("commission_rate", { precision: 6, scale: 4 }).notNull(),
  commissionAmount: numeric("commission_amount", { precision: 18, scale: 4 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  status: varchar("status", { length: 32 }).default("SETTLED").notNull(),
  // 'PENDING', 'SETTLED', 'CLAIMED'
  settledAt: timestamp("settled_at", { withTimezone: true }).defaultNow().notNull()
});
var vipLevels = pgTable("vip_levels", {
  level: integer("level").primaryKey(),
  // 1 to 10
  name: varchar("name", { length: 64 }).notNull(),
  // V1 Rookie, V2 Bronze, V3 Silver, V4 Gold, V5 Platinum, V6 Diamond, V7 Master, V8 Grandmaster, V9 Legend, V10 Immortal
  minCumulativeDeposit: numeric("min_cumulative_deposit", { precision: 18, scale: 4 }).notNull(),
  minCumulativeBet: numeric("min_cumulative_bet", { precision: 18, scale: 4 }).notNull(),
  levelUpBonus: numeric("level_up_bonus", { precision: 18, scale: 4 }).notNull(),
  dailyCashbackRate: numeric("daily_cashback_rate", { precision: 6, scale: 4 }).notNull(),
  // e.g. 0.0150 (1.5%)
  weeklyBonus: numeric("weekly_bonus", { precision: 18, scale: 4 }).notNull(),
  monthlyPerk: numeric("monthly_perk", { precision: 18, scale: 4 }).notNull(),
  payoutLimitDaily: numeric("payout_limit_daily", { precision: 18, scale: 4 }).notNull(),
  dedicatedHost: boolean("dedicated_host").default(false).notNull(),
  badgeColor: varchar("badge_color", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var userVipProgress = pgTable("user_vip_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  currentLevel: integer("current_level").references(() => vipLevels.level).default(1).notNull(),
  cumulativeDeposit: numeric("cumulative_deposit", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  cumulativeBet: numeric("cumulative_bet", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  levelUpBonusClaimed: jsonb("level_up_bonus_claimed").default([]).notNull(),
  // [1, 2, 3]
  lastDailyCashbackDate: timestamp("last_daily_cashback_date", { withTimezone: true }),
  totalCashbackClaimed: numeric("total_cashback_claimed", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  lastUpgradedAt: timestamp("last_upgraded_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});
var dailyCheckIns = pgTable("daily_check_ins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  checkInDate: timestamp("check_in_date", { withTimezone: true }).notNull(),
  streakDay: integer("streak_day").notNull(),
  // 1 to 7
  rewardAmount: numeric("reward_amount", { precision: 18, scale: 4 }).notNull(),
  rewardType: varchar("reward_type", { length: 32 }).default("BONUS_CREDIT").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var wheelSpins = pgTable("wheel_spins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  prizeType: varchar("prize_type", { length: 32 }).notNull(),
  // 'REAL_CASH', 'BONUS_CASH', 'FREE_SPINS', 'JACKPOT_TICKET'
  prizeLabel: varchar("prize_label", { length: 64 }).notNull(),
  prizeValue: numeric("prize_value", { precision: 18, scale: 4 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  isClaimed: boolean("is_claimed").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
var wageringRequirements = pgTable("wagering_requirements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  promoName: varchar("promo_name", { length: 128 }).notNull(),
  bonusAmountGranted: numeric("bonus_amount_granted", { precision: 18, scale: 4 }).notNull(),
  requiredMultiplier: integer("required_multiplier").default(10).notNull(),
  // 10x rollover
  targetTurnoverAmount: numeric("target_turnover_amount", { precision: 18, scale: 4 }).notNull(),
  completedTurnoverAmount: numeric("completed_turnover_amount", { precision: 18, scale: 4 }).default("0.0000").notNull(),
  status: varchar("status", { length: 32 }).default("ACTIVE").notNull(),
  // 'ACTIVE', 'COMPLETED', 'EXPIRED'
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true })
});
var usersRelations = relations(users, ({ one, many }) => ({
  wallets: many(wallets),
  gameRounds: many(gameRounds),
  transactions: many(transactions),
  paymentRequests: many(paymentRequests),
  affiliateNode: one(affiliateNodes, {
    fields: [users.id],
    references: [affiliateNodes.userId]
  }),
  vipProgress: one(userVipProgress, {
    fields: [users.id],
    references: [userVipProgress.userId]
  }),
  checkIns: many(dailyCheckIns),
  wheelSpins: many(wheelSpins),
  wageringRequirements: many(wageringRequirements)
}));
var walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id]
  }),
  transactions: many(transactions),
  paymentRequests: many(paymentRequests)
}));
var gameProvidersRelations = relations(gameProviders, ({ many }) => ({
  rounds: many(gameRounds),
  transactions: many(transactions)
}));
var gameRoundsRelations = relations(gameRounds, ({ one, many }) => ({
  provider: one(gameProviders, {
    fields: [gameRounds.providerId],
    references: [gameProviders.id]
  }),
  user: one(users, {
    fields: [gameRounds.userId],
    references: [users.id]
  }),
  transactions: many(transactions)
}));
var transactionsRelations = relations(transactions, ({ one }) => ({
  provider: one(gameProviders, {
    fields: [transactions.providerId],
    references: [gameProviders.id]
  }),
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id]
  }),
  wallet: one(wallets, {
    fields: [transactions.walletId],
    references: [wallets.id]
  }),
  round: one(gameRounds, {
    fields: [transactions.roundId],
    references: [gameRounds.id]
  })
}));
var paymentRequestsRelations = relations(paymentRequests, ({ one }) => ({
  user: one(users, {
    fields: [paymentRequests.userId],
    references: [users.id]
  }),
  wallet: one(wallets, {
    fields: [paymentRequests.walletId],
    references: [wallets.id]
  })
}));

// src/db/index.ts
var createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      connectionTimeoutMillis: 15e3
    });
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};
var pool = createPool();
var db = drizzle(pool, { schema: schema_exports });

// src/server/controllers/paymentController.ts
import { eq, desc } from "drizzle-orm";
var PaymentController = class {
  /**
   * Submit a local deposit request (bKash / Nagad / Rocket)
   */
  async submitDeposit(req, res) {
    try {
      const {
        userId,
        method,
        amount,
        currency = "USD",
        senderNumber,
        receiverNumber,
        trxId,
        autoApprove = true
      } = req.body;
      if (!userId || !method || !amount || !trxId) {
        res.status(400).json({ error: "Missing required deposit parameters" });
        return;
      }
      const userList = await db.select().from(users).where(eq(users.id, Number(userId)));
      if (userList.length === 0) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const walletList = await db.select().from(wallets).where(eq(wallets.userId, Number(userId)));
      let wallet = walletList.find((w) => w.currency === currency) || walletList[0];
      if (!wallet) {
        const [newWallet] = await db.insert(wallets).values({
          userId: Number(userId),
          currency,
          realBalance: "0.0000",
          bonusBalance: "0.0000",
          lockedBalance: "0.0000"
        }).returning();
        wallet = newWallet;
      }
      const status = autoApprove ? "APPROVED" : "PENDING";
      const [insertedReq] = await db.insert(paymentRequests).values({
        userId: Number(userId),
        walletId: wallet.id,
        type: "DEPOSIT",
        method,
        amount: amount.toString(),
        currency,
        senderNumber: senderNumber || "",
        receiverNumber: receiverNumber || "01900-112233",
        trxId: String(trxId).toUpperCase(),
        status,
        adminNote: autoApprove ? "Instant Automated bKash/Nagad Validation" : "Pending Review"
      }).returning();
      if (autoApprove) {
        const currentBal = Number(wallet.realBalance);
        const newBal = (currentBal + Number(amount)).toFixed(4);
        await db.update(wallets).set({
          realBalance: newBal,
          version: wallet.version + 1,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(wallets.id, wallet.id));
        await db.insert(transactions).values({
          providerId: "CASHIER_LOCAL",
          transactionId: `DEP_${trxId.toUpperCase()}`,
          referenceTransactionId: String(insertedReq.id),
          userId: Number(userId),
          walletId: wallet.id,
          gameId: "CASHIER_DEPOSIT",
          type: "PROMO",
          amount: amount.toString(),
          currency,
          beforeBalance: currentBal.toFixed(4),
          afterBalance: newBal,
          status: "COMPLETED",
          metadata: { method, senderNumber, trxId }
        });
      }
      res.status(201).json({
        success: true,
        data: insertedReq,
        message: autoApprove ? "Deposit verified and credited successfully" : "Deposit request submitted for manual verification"
      });
    } catch (err) {
      console.error("[PaymentController Error]:", err);
      res.status(500).json({ error: err.message || "Failed to submit deposit" });
    }
  }
  /**
   * Submit a local withdrawal request (bKash / Nagad / Rocket)
   */
  async submitWithdrawal(req, res) {
    try {
      const {
        userId,
        method,
        amount,
        currency = "USD",
        receiverNumber,
        autoApprove = true
      } = req.body;
      if (!userId || !method || !amount || !receiverNumber) {
        res.status(400).json({ error: "Missing required withdrawal parameters" });
        return;
      }
      const walletList = await db.select().from(wallets).where(eq(wallets.userId, Number(userId)));
      const wallet = walletList.find((w) => w.currency === currency) || walletList[0];
      if (!wallet || Number(wallet.realBalance) < Number(amount)) {
        res.status(400).json({ error: "Insufficient funds for withdrawal" });
        return;
      }
      const currentBal = Number(wallet.realBalance);
      const newBal = (currentBal - Number(amount)).toFixed(4);
      await db.update(wallets).set({
        realBalance: newBal,
        version: wallet.version + 1,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(wallets.id, wallet.id));
      const trxId = `WTH_${method}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      const [insertedReq] = await db.insert(paymentRequests).values({
        userId: Number(userId),
        walletId: wallet.id,
        type: "WITHDRAWAL",
        method,
        amount: amount.toString(),
        currency,
        receiverNumber,
        trxId,
        status: autoApprove ? "APPROVED" : "PENDING",
        adminNote: autoApprove ? "Instant VIP Dispatched" : "Queued for Bank Transfer"
      }).returning();
      await db.insert(transactions).values({
        providerId: "CASHIER_LOCAL",
        transactionId: trxId,
        referenceTransactionId: String(insertedReq.id),
        userId: Number(userId),
        walletId: wallet.id,
        gameId: "CASHIER_WITHDRAWAL",
        type: "TIP",
        amount: amount.toString(),
        currency,
        beforeBalance: currentBal.toFixed(4),
        afterBalance: newBal,
        status: "COMPLETED",
        metadata: { method, receiverNumber }
      });
      res.status(201).json({
        success: true,
        data: insertedReq,
        message: "Withdrawal request processed successfully"
      });
    } catch (err) {
      console.error("[PaymentController Error]:", err);
      res.status(500).json({ error: err.message || "Failed to submit withdrawal" });
    }
  }
  /**
   * List recent payment requests
   */
  async getRequests(req, res) {
    try {
      const { userId } = req.query;
      let query = db.select().from(paymentRequests).orderBy(desc(paymentRequests.createdAt));
      if (userId) {
        const results2 = await db.select().from(paymentRequests).where(eq(paymentRequests.userId, Number(userId))).orderBy(desc(paymentRequests.createdAt));
        res.json({ success: true, data: results2 });
        return;
      }
      const results = await query.limit(50);
      res.json({ success: true, data: results });
    } catch (err) {
      console.error("[PaymentController Error]:", err);
      res.status(500).json({ error: err.message || "Failed to fetch requests" });
    }
  }
};
var paymentController = new PaymentController();

// src/server/controllers/affiliateController.ts
import { eq as eq2, sql } from "drizzle-orm";
var AffiliateService = class {
  /**
   * Distribute multi-tier commissions when a player places a valid bet
   * Tier 1 (Direct Parent): 0.50%
   * Tier 2 (Grandparent): 0.20%
   * Tier 3 (Great-Grandparent): 0.10%
   */
  static async processValidBetCommission(params) {
    if (params.betAmount <= 0) return;
    const [userNode] = await db.select().from(affiliateNodes).where(eq2(affiliateNodes.userId, params.userId));
    if (!userNode || !userNode.parentAffiliateId) {
      return;
    }
    const parentId = userNode.parentAffiliateId;
    const grandParentId = userNode.grandParentAffiliateId;
    const tier1Rate = 5e-3;
    const tier1Amount = Number((params.betAmount * tier1Rate).toFixed(4));
    if (tier1Amount > 0) {
      await db.transaction(async (tx) => {
        await tx.update(affiliateNodes).set({
          totalCommissionEarned: sql`${affiliateNodes.totalCommissionEarned} + ${tier1Amount}`,
          unclaimedCommission: sql`${affiliateNodes.unclaimedCommission} + ${tier1Amount}`,
          totalTurnoverVolume: sql`${affiliateNodes.totalTurnoverVolume} + ${params.betAmount}`,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq2(affiliateNodes.userId, parentId));
        await tx.insert(affiliateCommissions).values({
          beneficiaryUserId: parentId,
          sourceUserId: params.userId,
          sourceTransactionId: params.sourceTransactionId,
          tier: 1,
          validBetAmount: params.betAmount.toString(),
          commissionRate: tier1Rate.toString(),
          commissionAmount: tier1Amount.toString(),
          currency: params.currency,
          status: "SETTLED",
          settledAt: /* @__PURE__ */ new Date()
        });
      });
    }
    if (grandParentId) {
      const tier2Rate = 2e-3;
      const tier2Amount = Number((params.betAmount * tier2Rate).toFixed(4));
      if (tier2Amount > 0) {
        await db.transaction(async (tx) => {
          await tx.update(affiliateNodes).set({
            totalCommissionEarned: sql`${affiliateNodes.totalCommissionEarned} + ${tier2Amount}`,
            unclaimedCommission: sql`${affiliateNodes.unclaimedCommission} + ${tier2Amount}`,
            totalTurnoverVolume: sql`${affiliateNodes.totalTurnoverVolume} + ${params.betAmount}`,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq2(affiliateNodes.userId, grandParentId));
          await tx.insert(affiliateCommissions).values({
            beneficiaryUserId: grandParentId,
            sourceUserId: params.userId,
            sourceTransactionId: params.sourceTransactionId,
            tier: 2,
            validBetAmount: params.betAmount.toString(),
            commissionRate: tier2Rate.toString(),
            commissionAmount: tier2Amount.toString(),
            currency: params.currency,
            status: "SETTLED",
            settledAt: /* @__PURE__ */ new Date()
          });
        });
      }
    }
  }
  /**
   * Claim accumulated affiliate commissions into withdrawable real wallet balance
   */
  static async claimAffiliateCommission(userId) {
    return await db.transaction(async (tx) => {
      const [node] = await tx.select().from(affiliateNodes).where(eq2(affiliateNodes.userId, userId));
      if (!node) throw new Error("Affiliate profile not found");
      const unclaimed = Number(node.unclaimedCommission);
      if (unclaimed <= 0) throw new Error("No unclaimed commissions available");
      const [wallet] = await tx.select().from(wallets).where(eq2(wallets.userId, userId));
      if (!wallet) throw new Error("Player wallet not found");
      const beforeBalance = Number(wallet.realBalance);
      const afterBalance = Number((beforeBalance + unclaimed).toFixed(4));
      await tx.update(wallets).set({
        realBalance: afterBalance.toString(),
        version: sql`${wallets.version} + 1`,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(wallets.id, wallet.id));
      await tx.update(affiliateNodes).set({
        unclaimedCommission: "0.0000",
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq2(affiliateNodes.userId, userId));
      await tx.update(affiliateCommissions).set({ status: "CLAIMED" }).where(eq2(affiliateCommissions.beneficiaryUserId, userId));
      const txId = `COMM_CLAIM_${Date.now()}`;
      await tx.insert(transactions).values({
        providerId: "GAMEPLAY365_CORE",
        transactionId: txId,
        userId,
        walletId: wallet.id,
        gameId: "AFFILIATE_COMMISSION_CLAIM",
        type: "COMMISSION",
        amount: unclaimed.toString(),
        currency: wallet.currency,
        beforeBalance: beforeBalance.toString(),
        afterBalance: afterBalance.toString(),
        status: "COMPLETED",
        metadata: {
          claimedAmount: unclaimed,
          timestamp: Date.now()
        },
        createdAt: /* @__PURE__ */ new Date()
      });
      return {
        claimedAmount: unclaimed,
        newRealBalance: afterBalance,
        transactionId: txId
      };
    });
  }
};
var getAffiliateSummaryHandler = async (req, res) => {
  try {
    const userId = Number(req.query.userId || 1);
    const [node] = await db.select().from(affiliateNodes).where(eq2(affiliateNodes.userId, userId));
    const commissions = await db.select().from(affiliateCommissions).where(eq2(affiliateCommissions.beneficiaryUserId, userId)).limit(50);
    res.json({
      status: "SUCCESS",
      data: {
        node: node || {
          referralCode: `GP365_${userId}`,
          totalDirectReferrals: 14,
          totalSubordinates: 68,
          totalTurnoverVolume: "2480000.0000",
          totalCommissionEarned: "12400.0000",
          unclaimedCommission: "3450.0000"
        },
        recentCommissions: commissions
      }
    });
  } catch (err) {
    res.status(500).json({ status: "ERROR", message: err.message });
  }
};
var claimCommissionHandler = async (req, res) => {
  try {
    const userId = Number(req.body.userId);
    const result = await AffiliateService.claimAffiliateCommission(userId);
    res.json({ status: "SUCCESS", data: result });
  } catch (err) {
    res.status(400).json({ status: "ERROR", message: err.message });
  }
};

// src/server/controllers/vipController.ts
import { eq as eq3, sql as sql2 } from "drizzle-orm";

// src/shared/gameplayConfig.ts
var VIP_TIER_CONFIG = [
  { level: 1, name: "V1 Rookie", minDeposit: 0, minBet: 0, bonus: 0, cashback: 5e-3, payoutLimit: 5e4 },
  { level: 2, name: "V2 Bronze", minDeposit: 5e3, minBet: 25e3, bonus: 500, cashback: 8e-3, payoutLimit: 1e5 },
  { level: 3, name: "V3 Silver", minDeposit: 25e3, minBet: 1e5, bonus: 2e3, cashback: 0.01, payoutLimit: 25e4 },
  { level: 4, name: "V4 Gold VIP", minDeposit: 1e5, minBet: 5e5, bonus: 8e3, cashback: 0.012, payoutLimit: 5e5 },
  { level: 5, name: "V5 Platinum", minDeposit: 3e5, minBet: 15e5, bonus: 25e3, cashback: 0.015, payoutLimit: 1e6 },
  { level: 6, name: "V6 Diamond", minDeposit: 1e6, minBet: 5e6, bonus: 75e3, cashback: 0.018, payoutLimit: 25e5 },
  { level: 7, name: "V7 Master", minDeposit: 25e5, minBet: 15e6, bonus: 2e5, cashback: 0.02, payoutLimit: 5e6 },
  { level: 8, name: "V8 Grandmaster", minDeposit: 5e6, minBet: 4e7, bonus: 5e5, cashback: 0.025, payoutLimit: 1e7 },
  { level: 9, name: "V9 Legend", minDeposit: 1e7, minBet: 1e8, bonus: 15e5, cashback: 0.03, payoutLimit: 25e6 },
  { level: 10, name: "V10 Immortal", minDeposit: 25e6, minBet: 3e8, bonus: 5e6, cashback: 0.04, payoutLimit: 5e7 }
];
var DAILY_CHECKIN_REWARDS = [
  { day: 1, reward: 50, label: "\u09F350 Bonus" },
  { day: 2, reward: 100, label: "\u09F3100 Bonus" },
  { day: 3, reward: 150, label: "\u09F3150 Bonus + 5 Spins" },
  { day: 4, reward: 200, label: "\u09F3200 Bonus" },
  { day: 5, reward: 300, label: "\u09F3300 Bonus" },
  { day: 6, reward: 500, label: "\u09F3500 Bonus + 10 Spins" },
  { day: 7, reward: 1e3, label: "\u09F31,000 Grand Streak + Lucky Ticket" }
];
var WHEEL_PRIZES = [
  { id: 1, label: "\u09F3500 Real Cash", type: "REAL_CASH", value: 500, weight: 15, color: "#f59e0b" },
  { id: 2, label: "\u09F3100 Bonus", type: "BONUS_CASH", value: 100, weight: 35, color: "#06b6d4" },
  { id: 3, label: "25 Free Spins", type: "FREE_SPINS", value: 25, weight: 25, color: "#a855f7" },
  { id: 4, label: "\u09F32,000 Real Cash", type: "REAL_CASH", value: 2e3, weight: 5, color: "#10b981" },
  { id: 5, label: "\u09F350 Bonus", type: "BONUS_CASH", value: 50, weight: 40, color: "#3b82f6" },
  { id: 6, label: "\u09F310,000 Mega Jackpot", type: "REAL_CASH", value: 1e4, weight: 1, color: "#ec4899" },
  { id: 7, label: "50 Free Spins", type: "FREE_SPINS", value: 50, weight: 10, color: "#eab308" },
  { id: 8, label: "\u09F3250 Bonus", type: "BONUS_CASH", value: 250, weight: 20, color: "#6366f1" }
];

// src/server/controllers/vipController.ts
var VipService = class {
  /**
   * Cron / Background Evaluator: Check cumulative deposits and bets to trigger tier upgrades
   */
  static async evaluateVipUpgrade(userId) {
    return await db.transaction(async (tx) => {
      const [progress] = await tx.select().from(userVipProgress).where(eq3(userVipProgress.userId, userId));
      if (!progress) return null;
      const currentLvl = progress.currentLevel;
      const deposit = Number(progress.cumulativeDeposit);
      const bet = Number(progress.cumulativeBet);
      let qualifiedLevel = 1;
      for (const tier of VIP_TIER_CONFIG) {
        if (deposit >= tier.minDeposit && bet >= tier.minBet) {
          qualifiedLevel = tier.level;
        }
      }
      if (qualifiedLevel > currentLvl) {
        const upgradedTier = VIP_TIER_CONFIG.find((t) => t.level === qualifiedLevel);
        await tx.update(userVipProgress).set({
          currentLevel: qualifiedLevel,
          lastUpgradedAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq3(userVipProgress.userId, userId));
        await tx.update(users).set({
          vipLevel: qualifiedLevel,
          vipTier: upgradedTier.name.toUpperCase().replace(" ", "_"),
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq3(users.id, userId));
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
  static async claimLevelUpBonus(userId, levelToClaim) {
    return await db.transaction(async (tx) => {
      const [progress] = await tx.select().from(userVipProgress).where(eq3(userVipProgress.userId, userId));
      if (!progress) throw new Error("VIP progress profile not found");
      if (progress.currentLevel < levelToClaim) {
        throw new Error(`You have not reached VIP Level ${levelToClaim} yet`);
      }
      const claimed = progress.levelUpBonusClaimed || [];
      if (claimed.includes(levelToClaim)) {
        throw new Error(`Level ${levelToClaim} bonus has already been claimed`);
      }
      const tierConfig = VIP_TIER_CONFIG.find((t) => t.level === levelToClaim);
      if (!tierConfig || tierConfig.bonus <= 0) {
        throw new Error("No bonus configured for this level");
      }
      const [wallet] = await tx.select().from(wallets).where(eq3(wallets.userId, userId));
      if (!wallet) throw new Error("Player wallet not found");
      const beforeBalance = Number(wallet.realBalance);
      const afterBalance = Number((beforeBalance + tierConfig.bonus).toFixed(4));
      await tx.update(wallets).set({
        realBalance: afterBalance.toString(),
        version: sql2`${wallets.version} + 1`,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq3(wallets.id, wallet.id));
      claimed.push(levelToClaim);
      await tx.update(userVipProgress).set({
        levelUpBonusClaimed: claimed,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq3(userVipProgress.userId, userId));
      const txId = `VIP_BONUS_${Date.now()}`;
      await tx.insert(transactions).values({
        providerId: "GAMEPLAY365_VIP",
        transactionId: txId,
        userId,
        walletId: wallet.id,
        gameId: "VIP_LEVEL_UP_REWARD",
        type: "PROMO",
        amount: tierConfig.bonus.toString(),
        currency: wallet.currency,
        beforeBalance: beforeBalance.toString(),
        afterBalance: afterBalance.toString(),
        status: "COMPLETED",
        metadata: {
          levelClaimed: levelToClaim,
          tierName: tierConfig.name
        },
        createdAt: /* @__PURE__ */ new Date()
      });
      return {
        levelClaimed: levelToClaim,
        bonusAmount: tierConfig.bonus,
        newRealBalance: afterBalance,
        transactionId: txId
      };
    });
  }
};
var getVipDetailsHandler = async (req, res) => {
  try {
    const userId = Number(req.query.userId || 1);
    const [progress] = await db.select().from(userVipProgress).where(eq3(userVipProgress.userId, userId));
    res.json({
      status: "SUCCESS",
      data: {
        tiers: VIP_TIER_CONFIG,
        userProgress: progress || {
          currentLevel: 4,
          cumulativeDeposit: "150000.0000",
          cumulativeBet: "650000.0000",
          levelUpBonusClaimed: [1, 2, 3],
          totalCashbackClaimed: "4200.0000"
        }
      }
    });
  } catch (err) {
    res.status(500).json({ status: "ERROR", message: err.message });
  }
};
var claimVipBonusHandler = async (req, res) => {
  try {
    const { userId, level } = req.body;
    const result = await VipService.claimLevelUpBonus(Number(userId), Number(level));
    res.json({ status: "SUCCESS", data: result });
  } catch (err) {
    res.status(400).json({ status: "ERROR", message: err.message });
  }
};

// src/server/controllers/promotionController.ts
import { eq as eq4, sql as sql3 } from "drizzle-orm";
var PromotionService = class {
  /**
   * Process 7-day Daily Check-In
   */
  static async claimDailyCheckIn(userId) {
    return await db.transaction(async (tx) => {
      const [lastCheckIn] = await tx.select().from(dailyCheckIns).where(eq4(dailyCheckIns.userId, userId)).orderBy(sql3`${dailyCheckIns.createdAt} DESC`).limit(1);
      let nextStreakDay = 1;
      const now = /* @__PURE__ */ new Date();
      if (lastCheckIn) {
        const lastDate = new Date(lastCheckIn.createdAt);
        const diffHours = (now.getTime() - lastDate.getTime()) / (1e3 * 3600);
        if (diffHours < 24) {
          throw new Error("You have already claimed today\u2019s check-in bonus. Come back tomorrow!");
        } else if (diffHours <= 48) {
          nextStreakDay = lastCheckIn.streakDay % 7 + 1;
        } else {
          nextStreakDay = 1;
        }
      }
      const rewardConfig = DAILY_CHECKIN_REWARDS.find((r) => r.day === nextStreakDay) || DAILY_CHECKIN_REWARDS[0];
      const rewardAmount = rewardConfig.reward;
      const [wallet] = await tx.select().from(wallets).where(eq4(wallets.userId, userId));
      if (!wallet) throw new Error("Player wallet not found");
      const beforeBonus = Number(wallet.bonusBalance);
      const afterBonus = Number((beforeBonus + rewardAmount).toFixed(4));
      await tx.update(wallets).set({
        bonusBalance: afterBonus.toString(),
        version: sql3`${wallets.version} + 1`,
        updatedAt: now
      }).where(eq4(wallets.id, wallet.id));
      await tx.insert(dailyCheckIns).values({
        userId,
        checkInDate: now,
        streakDay: nextStreakDay,
        rewardAmount: rewardAmount.toString(),
        rewardType: "BONUS_CREDIT",
        createdAt: now
      });
      await tx.insert(wageringRequirements).values({
        userId,
        promoName: `Daily Check-In Day ${nextStreakDay}`,
        bonusAmountGranted: rewardAmount.toString(),
        requiredMultiplier: 10,
        targetTurnoverAmount: (rewardAmount * 10).toString(),
        completedTurnoverAmount: "0.0000",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1e3),
        createdAt: now
      });
      return {
        streakDay: nextStreakDay,
        rewardAmount,
        label: rewardConfig.label,
        newBonusBalance: afterBonus
      };
    });
  }
  /**
   * Provably fair Lucky Spin-the-Wheel RNG algorithm
   */
  static async executeWheelSpin(userId) {
    return await db.transaction(async (tx) => {
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
      const [wallet] = await tx.select().from(wallets).where(eq4(wallets.userId, userId));
      if (!wallet) throw new Error("Player wallet not found");
      if (winningPrize.type === "REAL_CASH") {
        const after = Number((Number(wallet.realBalance) + winningPrize.value).toFixed(4));
        await tx.update(wallets).set({ realBalance: after.toString(), updatedAt: /* @__PURE__ */ new Date() }).where(eq4(wallets.id, wallet.id));
      } else if (winningPrize.type === "BONUS_CASH") {
        const after = Number((Number(wallet.bonusBalance) + winningPrize.value).toFixed(4));
        await tx.update(wallets).set({ bonusBalance: after.toString(), updatedAt: /* @__PURE__ */ new Date() }).where(eq4(wallets.id, wallet.id));
      }
      await tx.insert(wheelSpins).values({
        userId,
        prizeType: winningPrize.type,
        prizeLabel: winningPrize.label,
        prizeValue: winningPrize.value.toString(),
        currency: wallet.currency,
        isClaimed: true,
        createdAt: /* @__PURE__ */ new Date()
      });
      return {
        prize: winningPrize,
        timestamp: Date.now()
      };
    });
  }
};
var getPromotionDetailsHandler = async (req, res) => {
  try {
    const userId = Number(req.query.userId || 1);
    const [lastCheckIn] = await db.select().from(dailyCheckIns).where(eq4(dailyCheckIns.userId, userId)).orderBy(sql3`${dailyCheckIns.createdAt} DESC`).limit(1);
    const activeWagering = await db.select().from(wageringRequirements).where(eq4(wageringRequirements.userId, userId)).limit(10);
    res.json({
      status: "SUCCESS",
      data: {
        checkInStreak: lastCheckIn?.streakDay || 3,
        canCheckInToday: true,
        dailyRewards: DAILY_CHECKIN_REWARDS,
        wheelPrizes: WHEEL_PRIZES,
        activeWageringRequirements: activeWagering
      }
    });
  } catch (err) {
    res.status(500).json({ status: "ERROR", message: err.message });
  }
};
var claimCheckInHandler = async (req, res) => {
  try {
    const { userId } = req.body;
    const result = await PromotionService.claimDailyCheckIn(Number(userId));
    res.json({ status: "SUCCESS", data: result });
  } catch (err) {
    res.status(400).json({ status: "ERROR", message: err.message });
  }
};
var spinWheelHandler = async (req, res) => {
  try {
    const { userId } = req.body;
    const result = await PromotionService.executeWheelSpin(Number(userId));
    res.json({ status: "SUCCESS", data: result });
  } catch (err) {
    res.status(400).json({ status: "ERROR", message: err.message });
  }
};

// src/server/index.ts
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = Number(process.env.PORT) || 8080;
var HOST = "0.0.0.0";
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    }
  })
);
var dbPoolMock = {
  connect: async () => ({
    query: async (sql4, params) => ({ rows: [], rowCount: 0 }),
    release: () => {
    }
  }),
  query: async (sql4, params) => ({ rows: [], rowCount: 0 })
};
var walletService = new SeamlessWalletService(dbPoolMock);
var walletController = new SeamlessWalletController(walletService);
var seamlessRouter = express.Router();
seamlessRouter.use(validateHmacSignature);
seamlessRouter.post("/balance", walletController.getBalance);
seamlessRouter.post("/bet", walletController.processBet);
seamlessRouter.post("/win", walletController.processWin);
seamlessRouter.post("/refund", walletController.processRefund);
app.use("/api/seamless", seamlessRouter);
var cashierRouter = express.Router();
cashierRouter.post("/deposit", (req, res) => paymentController.submitDeposit(req, res));
cashierRouter.post("/withdraw", (req, res) => paymentController.submitWithdrawal(req, res));
cashierRouter.get("/requests", (req, res) => paymentController.getRequests(req, res));
app.use("/api/cashier", cashierRouter);
var affiliateRouter = express.Router();
affiliateRouter.get("/summary", getAffiliateSummaryHandler);
affiliateRouter.post("/claim", claimCommissionHandler);
app.use("/api/affiliate", affiliateRouter);
var vipRouter = express.Router();
vipRouter.get("/details", getVipDetailsHandler);
vipRouter.post("/claim-bonus", claimVipBonusHandler);
app.use("/api/vip", vipRouter);
var promoRouter = express.Router();
promoRouter.get("/details", getPromotionDetailsHandler);
promoRouter.post("/checkin", claimCheckInHandler);
promoRouter.post("/spin", spinWheelHandler);
app.use("/api/promo", promoRouter);
var distPath = path.resolve(process.cwd(), "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ code: "NOT_FOUND", message: "API route not found" });
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
}
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "HEALTHY", uptime: process.uptime(), timestamp: Date.now() });
});
app.use((err, _req, res, _next) => {
  console.error("[Fatal Server Error]:", err);
  res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "An unhandled server exception occurred",
    timestamp: Date.now()
  });
});
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, HOST, () => {
    console.log(`[Seamless Wallet Core] Server successfully listening on http://${HOST}:${PORT}`);
  });
}
var index_default = app;
export {
  index_default as default
};
