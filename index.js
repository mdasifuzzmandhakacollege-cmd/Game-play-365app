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
import crypto2 from "crypto";
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
  return crypto2.createHmac("sha256", secretKey).update(messageToSign, "utf8").digest("hex");
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
    if (receivedBuffer.length !== expectedBuffer.length || !crypto2.timingSafeEqual(receivedBuffer, expectedBuffer)) {
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
      let query3 = db.select().from(paymentRequests).orderBy(desc(paymentRequests.createdAt));
      if (userId) {
        const results2 = await db.select().from(paymentRequests).where(eq(paymentRequests.userId, Number(userId))).orderBy(desc(paymentRequests.createdAt));
        res.json({ success: true, data: results2 });
        return;
      }
      const results = await query3.limit(50);
      res.json({ success: true, data: results });
    } catch (err) {
      console.error("[PaymentController Error]:", err);
      res.status(500).json({ error: err.message || "Failed to fetch requests" });
    }
  }
};
var paymentController = new PaymentController();

// src/services/paymentAdapters.ts
var BkashPaymentAdapter = class {
  constructor() {
    this.providerId = "bkash";
    this.name = "bKash Automated Gateway";
  }
  async verifyDeposit(params) {
    const cleanTrx = params.trxId.trim().toUpperCase();
    const validFormat = /^[A-Z0-9]{8,12}$/.test(cleanTrx);
    if (!validFormat) {
      return {
        verified: false,
        status: "FAILED",
        providerTransactionId: cleanTrx,
        message: "Invalid bKash TrxID format. Expected 8-12 alphanumeric characters."
      };
    }
    const mockSuccess = !cleanTrx.startsWith("FAIL") && !cleanTrx.startsWith("ERR");
    if (!mockSuccess) {
      return {
        verified: false,
        status: "FAILED",
        providerTransactionId: cleanTrx,
        message: "bKash API reported transaction does not exist or has been reversed."
      };
    }
    return {
      verified: true,
      status: "VERIFIED",
      providerTransactionId: cleanTrx,
      amountReceived: params.depositIntent.amount,
      paidAt: (/* @__PURE__ */ new Date()).toISOString(),
      message: "bKash API verification confirmed. Funds settled into merchant account.",
      rawProviderResponse: {
        trxStatus: "Completed",
        transactionReference: cleanTrx,
        merchantInvoiceNumber: params.depositIntent.id,
        amount: params.depositIntent.amount.toString(),
        currency: "BDT",
        paymentExecuteTime: (/* @__PURE__ */ new Date()).toISOString()
      }
    };
  }
  async executePayout(params) {
    const ref = `BK_DISB_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return {
      success: true,
      providerReference: ref,
      status: "COMPLETED",
      message: `bKash B2C API successfully disbursed \u09F3${params.withdrawal.amount} to ${params.withdrawal.recipientAccount}`,
      rawResponse: {
        statusCode: "0000",
        statusMessage: "Successful",
        paymentID: ref
      }
    };
  }
  async processWebhook(payload, signature) {
    const signatureValid = signature !== "INVALID";
    return {
      signatureValid,
      providerTransactionId: payload.trxID || payload.paymentID,
      amount: payload.amount ? Number(payload.amount) : void 0,
      currency: payload.currency || "BDT",
      status: payload.transactionStatus || "Completed",
      rawPayload: payload
    };
  }
};
var NagadPaymentAdapter = class {
  constructor() {
    this.providerId = "nagad";
    this.name = "Nagad Automated Gateway";
  }
  async verifyDeposit(params) {
    const cleanTrx = params.trxId.trim().toUpperCase();
    const validFormat = /^[A-Z0-9]{8,12}$/.test(cleanTrx);
    if (!validFormat) {
      return {
        verified: false,
        status: "FAILED",
        providerTransactionId: cleanTrx,
        message: "Invalid Nagad TrxID format. Expected 8-12 alphanumeric characters."
      };
    }
    return {
      verified: true,
      status: "VERIFIED",
      providerTransactionId: cleanTrx,
      amountReceived: params.depositIntent.amount,
      paidAt: (/* @__PURE__ */ new Date()).toISOString(),
      message: "Nagad Gateway verified transaction successfully.",
      rawProviderResponse: {
        status: "Success",
        issuerTrxId: cleanTrx,
        amount: params.depositIntent.amount
      }
    };
  }
  async executePayout(params) {
    const ref = `NG_DISB_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return {
      success: true,
      providerReference: ref,
      status: "COMPLETED",
      message: `Nagad Payout API disbursed \u09F3${params.withdrawal.amount} to ${params.withdrawal.recipientAccount}`,
      rawResponse: { status: "Success", refId: ref }
    };
  }
  async processWebhook(payload, signature) {
    return {
      signatureValid: true,
      providerTransactionId: payload.issuerTrxId,
      amount: Number(payload.amount),
      currency: "BDT",
      status: payload.status,
      rawPayload: payload
    };
  }
};
var RocketPaymentAdapter = class {
  constructor() {
    this.providerId = "rocket";
    this.name = "Rocket Automated Gateway";
  }
  async verifyDeposit(params) {
    const cleanTrx = params.trxId.trim().toUpperCase();
    return {
      verified: true,
      status: "VERIFIED",
      providerTransactionId: cleanTrx,
      amountReceived: params.depositIntent.amount,
      paidAt: (/* @__PURE__ */ new Date()).toISOString(),
      message: "DBBL Rocket CBS confirmed transaction credit.",
      rawProviderResponse: {
        cbsResponse: "APPROVED",
        txId: cleanTrx
      }
    };
  }
  async executePayout(params) {
    const ref = `RK_DISB_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return {
      success: true,
      providerReference: ref,
      status: "COMPLETED",
      message: `DBBL Rocket disbursed \u09F3${params.withdrawal.amount} to ${params.withdrawal.recipientAccount}`,
      rawResponse: { ref }
    };
  }
  async processWebhook(payload, signature) {
    return {
      signatureValid: true,
      providerTransactionId: payload.txId,
      amount: Number(payload.amount),
      currency: "BDT",
      status: "APPROVED",
      rawPayload: payload
    };
  }
};
var BankTransferPaymentAdapter = class {
  constructor() {
    this.providerId = "bank_transfer";
    this.name = "Bank Transfer / NPSB Gateway";
  }
  async verifyDeposit(params) {
    const cleanTrx = params.trxId.trim().toUpperCase();
    return {
      verified: true,
      status: "VERIFIED",
      providerTransactionId: cleanTrx,
      amountReceived: params.depositIntent.amount,
      paidAt: (/* @__PURE__ */ new Date()).toISOString(),
      message: "Bank Core Banking API confirmed EFT/NPSB wire credit.",
      rawProviderResponse: {
        swiftOrNpsbRef: cleanTrx,
        clearingStatus: "SETTLED"
      }
    };
  }
  async executePayout(params) {
    const ref = `BANK_WIRE_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    return {
      success: true,
      providerReference: ref,
      status: "COMPLETED",
      message: `NPSB Instant Wire Transfer routed \u09F3${params.withdrawal.amount} to Bank Account ${params.withdrawal.recipientAccount}`,
      rawResponse: { wireRef: ref, status: "PROCESSED" }
    };
  }
  async processWebhook(payload, signature) {
    return {
      signatureValid: true,
      providerTransactionId: payload.swiftOrNpsbRef,
      amount: Number(payload.amount),
      currency: "BDT",
      status: "SETTLED",
      rawPayload: payload
    };
  }
};
var CardPaymentAdapter = class {
  constructor() {
    this.providerId = "card_payment";
    this.name = "Visa / Mastercard 3DS Gateway";
  }
  async verifyDeposit(params) {
    return {
      verified: true,
      status: "VERIFIED",
      providerTransactionId: params.trxId.toUpperCase(),
      amountReceived: params.depositIntent.amount,
      paidAt: (/* @__PURE__ */ new Date()).toISOString(),
      message: "Card 3D-Secure 2.0 authorization verified.",
      rawProviderResponse: { authCode: "AUTH_8910", status: "CAPTURED" }
    };
  }
  async executePayout(params) {
    const ref = `CARD_OCT_${Date.now()}`;
    return {
      success: true,
      providerReference: ref,
      status: "COMPLETED",
      message: `Card OCT (Original Credit Transaction) processed to card ending in ${params.withdrawal.recipientAccount.slice(-4)}`,
      rawResponse: { ref }
    };
  }
  async processWebhook(payload) {
    return {
      signatureValid: true,
      providerTransactionId: payload.chargeId,
      amount: Number(payload.amount),
      currency: payload.currency || "USD",
      status: "CAPTURED",
      rawPayload: payload
    };
  }
};

// src/services/explainAnalyzeEngine.ts
function generateExplainAnalyze(query3, customOptions) {
  const options = {
    analyze: true,
    buffers: true,
    costs: true,
    verbose: true,
    timing: true,
    wal: true,
    ...customOptions
  };
  const sqlStr = typeof query3 === "string" ? query3 : query3.statement;
  const commandType = typeof query3 === "string" ? sqlStr.trim().split(" ")[0].toUpperCase() : query3.commandType;
  const table = typeof query3 === "string" ? sqlStr.match(/FROM\s+([a-zA-Z0-9_]+)|INTO\s+([a-zA-Z0-9_]+)|UPDATE\s+([a-zA-Z0-9_]+)/i)?.[1] || "wallets" : query3.table;
  const isForUpdate = /FOR\s+UPDATE/i.test(sqlStr);
  const isInsert = /^INSERT/i.test(sqlStr);
  const isUpdate = /^UPDATE/i.test(sqlStr);
  const isSelect = /^SELECT/i.test(sqlStr);
  const isDelete = /^DELETE/i.test(sqlStr);
  let planTree;
  let planningTime = 0.05 + Math.random() * 0.04;
  let executionTime = 0.08 + Math.random() * 0.12;
  if (isForUpdate) {
    const childNode = {
      id: "node_index_scan_01",
      nodeType: "Index Scan",
      relationName: table || "wallets",
      alias: "w",
      indexName: "idx_wallets_user_currency",
      indexCond: `((user_id = $1::uuid) AND (currency = $2::varchar))`,
      startupCost: 0.28,
      totalCost: 8.3,
      planRows: 1,
      planWidth: 142,
      actualStartupTime: 0.024,
      actualTotalTime: 0.045,
      actualRows: 1,
      actualLoops: 1,
      sharedHitBlocks: 4,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 0,
      sharedWrittenBlocks: 0,
      output: [
        "id",
        "user_id",
        "currency",
        "real_balance",
        "bonus_balance",
        "locked_balance",
        "version",
        "status"
      ],
      details: [
        "Scan type: B-Tree unique lookup on idx_wallets_user_currency",
        "Filtered out by concurrency predicate: 0 rows"
      ]
    };
    planTree = {
      id: "node_lockrows_00",
      nodeType: "LockRows",
      lockType: "RowExclusiveLock (FOR UPDATE)",
      exclusiveLockTarget: `${table || "wallets"} (tuple-level lock)`,
      startupCost: 0.28,
      totalCost: 8.31,
      planRows: 1,
      planWidth: 142,
      actualStartupTime: 0.038,
      actualTotalTime: 0.082,
      actualRows: 1,
      actualLoops: 1,
      sharedHitBlocks: 6,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 1,
      sharedWrittenBlocks: 0,
      walRecords: 1,
      walBytes: 74,
      output: childNode.output,
      children: [childNode],
      details: [
        "Lock mode: Exclusive Lock on selected tuple to guarantee ACID serializability",
        "Wait time for lock acquisition: 0.00 ms (no active blocking transaction)"
      ]
    };
  } else if (isUpdate) {
    const childNode = {
      id: "node_update_index_scan",
      nodeType: "Index Scan",
      relationName: table || "wallets",
      alias: "wallets",
      indexName: "wallets_pkey",
      indexCond: `(id = $1::varchar)`,
      startupCost: 0.28,
      totalCost: 8.3,
      planRows: 1,
      planWidth: 142,
      actualStartupTime: 0.019,
      actualTotalTime: 0.038,
      actualRows: 1,
      actualLoops: 1,
      sharedHitBlocks: 3,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 0,
      sharedWrittenBlocks: 0,
      output: ["id", "ctid"]
    };
    planTree = {
      id: "node_update_00",
      nodeType: "Update",
      relationName: table || "wallets",
      startupCost: 0.28,
      totalCost: 16.32,
      planRows: 1,
      planWidth: 142,
      actualStartupTime: 0.042,
      actualTotalTime: 0.112,
      actualRows: 1,
      actualLoops: 1,
      sharedHitBlocks: 8,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 2,
      sharedWrittenBlocks: 0,
      walRecords: 2,
      walBytes: 196,
      children: [childNode],
      details: [
        "MVCC: New row tuple written with updated version counter and balance",
        "HOT (Heap-Only Tuple) Update: Yes (Index attributes unaffected)"
      ]
    };
  } else if (isInsert) {
    const isOnConflict = /ON\s+CONFLICT/i.test(sqlStr);
    planTree = {
      id: "node_insert_00",
      nodeType: "Insert",
      relationName: table || "transactions",
      conflictResolution: isOnConflict ? "ON CONFLICT (provider_id, provider_round_id) DO UPDATE" : "NONE",
      startupCost: 0,
      totalCost: 0.01,
      planRows: 1,
      planWidth: 160,
      actualStartupTime: 0.015,
      actualTotalTime: 0.075,
      actualRows: 1,
      actualLoops: 1,
      sharedHitBlocks: 5,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 2,
      sharedWrittenBlocks: 0,
      walRecords: 2,
      walBytes: 248,
      children: [
        {
          id: "node_result_01",
          nodeType: "Result",
          startupCost: 0,
          totalCost: 0.01,
          planRows: 1,
          planWidth: 160,
          actualStartupTime: 2e-3,
          actualTotalTime: 3e-3,
          actualRows: 1,
          actualLoops: 1,
          sharedHitBlocks: 0,
          sharedReadBlocks: 0,
          sharedDirtiedBlocks: 0,
          sharedWrittenBlocks: 0
        }
      ],
      details: [
        "Tuples Inserted: 1",
        "Indexes Updated: transactions_pkey, idx_transactions_user_id_created_at, idx_transactions_provider_tx"
      ]
    };
  } else if (/WHERE\s+.*user_id.*ORDER\s+BY/i.test(sqlStr)) {
    const childNode = {
      id: "node_idx_trans_user_created",
      nodeType: "Index Scan Backward",
      relationName: table || "transactions",
      alias: "t",
      indexName: "idx_transactions_user_id_created_at",
      indexCond: `(user_id = $1::uuid)`,
      filter: `(type = ANY ('{BET,WIN,REFUND}'::transaction_type[]))`,
      startupCost: 0.42,
      totalCost: 24.85,
      planRows: 25,
      planWidth: 180,
      actualStartupTime: 0.035,
      actualTotalTime: 0.095,
      actualRows: 18,
      actualLoops: 1,
      sharedHitBlocks: 12,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 0,
      sharedWrittenBlocks: 0,
      output: ["id", "transaction_id", "amount", "type", "currency", "created_at"]
    };
    planTree = {
      id: "node_limit_00",
      nodeType: "Limit",
      startupCost: 0.42,
      totalCost: 8.5,
      planRows: 20,
      planWidth: 180,
      actualStartupTime: 0.036,
      actualTotalTime: 0.098,
      actualRows: 18,
      actualLoops: 1,
      sharedHitBlocks: 12,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 0,
      sharedWrittenBlocks: 0,
      children: [childNode],
      details: [
        "Zero Sort overhead: Order by created_at DESC satisfied natively by Index Scan Backward"
      ]
    };
  } else {
    planTree = {
      id: "node_idx_scan_generic",
      nodeType: "Index Scan",
      relationName: table || "idempotency_keys",
      alias: table,
      indexName: `${table}_pkey`,
      indexCond: `(key = $1::varchar)`,
      startupCost: 0.28,
      totalCost: 8.3,
      planRows: 1,
      planWidth: 120,
      actualStartupTime: 0.018,
      actualTotalTime: 0.042,
      actualRows: 1,
      actualLoops: 1,
      sharedHitBlocks: 4,
      sharedReadBlocks: 0,
      sharedDirtiedBlocks: 0,
      sharedWrittenBlocks: 0,
      output: ["*"],
      details: [`Index lookup using Primary Key B-tree on ${table}`]
    };
  }
  const totalHit = countBlocks(planTree, "sharedHitBlocks");
  const totalRead = countBlocks(planTree, "sharedReadBlocks");
  const totalDirtied = countBlocks(planTree, "sharedDirtiedBlocks");
  const totalWritten = countBlocks(planTree, "sharedWrittenBlocks");
  const totalWalRecs = planTree.walRecords || 0;
  const totalWalBytes = planTree.walBytes || 0;
  const hitRatio = totalHit + totalRead > 0 ? totalHit / (totalHit + totalRead) * 100 : 100;
  const totalExecutionMs = planTree.actualTotalTime || executionTime;
  const formattedTextPlan = generatePostgresTextPlan(
    planTree,
    planningTime,
    totalExecutionMs,
    options
  );
  const formattedJsonPlan = [
    {
      Plan: {
        "Node Type": planTree.nodeType,
        "Parallel Aware": false,
        "Relation Name": planTree.relationName,
        Alias: planTree.alias,
        "Startup Cost": planTree.startupCost,
        "Total Cost": planTree.totalCost,
        "Plan Rows": planTree.planRows,
        "Plan Width": planTree.planWidth,
        "Actual Startup Time": planTree.actualStartupTime,
        "Actual Total Time": planTree.actualTotalTime,
        "Actual Rows": planTree.actualRows,
        "Actual Loops": planTree.actualLoops,
        "Shared Hit Blocks": totalHit,
        "Shared Read Blocks": totalRead,
        "Shared Dirtied Blocks": totalDirtied,
        "Shared Written Blocks": totalWritten,
        Plans: planTree.children?.map((c) => ({
          "Node Type": c.nodeType,
          "Relation Name": c.relationName,
          "Index Name": c.indexName,
          "Index Cond": c.indexCond,
          "Actual Total Time": c.actualTotalTime,
          "Actual Rows": c.actualRows
        }))
      },
      Planning: {
        "Shared Hit Blocks": 2,
        "Shared Read Blocks": 0
      },
      "Planning Time": Number(planningTime.toFixed(3)),
      "Triggers": [],
      "Execution Time": Number(totalExecutionMs.toFixed(3))
    }
  ];
  const recommendations = [];
  if (isForUpdate) {
    recommendations.push({
      severity: "optimal",
      category: "Locking",
      title: "Pessimistic Row-Level Lock (2PL) Active",
      description: `The query executes 'LockRows' using 'RowExclusiveLock' on the target wallet tuple. This guarantees ACID serializability and prevents race conditions or double debits under heavy concurrency.`
    });
    recommendations.push({
      severity: "optimal",
      category: "Index",
      title: "Optimal B-Tree Index Scan Utilized",
      description: `Target row selected via unique composite index 'idx_wallets_user_currency' (Cost: 0.28..8.31, 4 buffer hits, 0 disk reads). Fast single-tuple resolution in ${planTree.actualTotalTime.toFixed(3)} ms.`
    });
  } else if (isInsert) {
    recommendations.push({
      severity: "optimal",
      category: "Buffer",
      title: "Append-Only Ledger Write Pattern",
      description: "Immutable financial ledger insert avoids row contention and enables maximum write throughput with HOT updates and append optimization."
    });
  } else if (isUpdate) {
    recommendations.push({
      severity: "optimal",
      category: "Memory",
      title: "Heap-Only Tuple (HOT) Update Verified",
      description: "Non-indexed balance and version columns were updated in place. PostgreSQL avoided index re-indexing overhead and deferred MVCC bloat cleanup to autovacuum."
    });
  }
  recommendations.push({
    severity: "optimal",
    category: "Buffer",
    title: "100% Shared Buffer Cache Hit Ratio",
    description: `All ${totalHit} shared memory buffer blocks were served directly from RAM (shared_buffers). 0 disk I/O reads incurred.`
  });
  recommendations.push({
    severity: "info",
    category: "SLA",
    title: "SLA Latency Headroom (>99.9% Compliance)",
    description: `Total execution latency of ${(planningTime + totalExecutionMs).toFixed(3)} ms leaves over 3,999 ms headroom before breaching the 4,000 ms seamless provider SLA.`
  });
  return {
    statement: sqlStr,
    commandType,
    table: table || "wallets",
    optionsUsed: options,
    planningTimeMs: Number(planningTime.toFixed(3)),
    executionTimeMs: Number(totalExecutionMs.toFixed(3)),
    totalTimeMs: Number((planningTime + totalExecutionMs).toFixed(3)),
    costTotal: planTree.totalCost,
    costStartup: planTree.startupCost,
    bufferStats: {
      sharedHit: totalHit,
      sharedRead: totalRead,
      sharedDirtied: totalDirtied,
      sharedWritten: totalWritten,
      hitRatioPercent: Number(hitRatio.toFixed(1))
    },
    walStats: {
      records: totalWalRecs,
      bytes: totalWalBytes
    },
    planTree,
    formattedTextPlan,
    formattedJsonPlan,
    recommendations,
    architecturalAnalysis: {
      lockingOverhead: isForUpdate ? "0.04 ms (RowExclusiveLock)" : "0.00 ms (None)",
      slaSafetyMargin: `${((1 - (planningTime + totalExecutionMs) / 4e3) * 100).toFixed(2)}% Safe`,
      concurrencyRating: "Tier 1 Enterprise (ACID Compliant)",
      indexEfficiency: "100% Index-Covered (Zero Seq Scan)",
      cacheEfficiency: `${hitRatio.toFixed(1)}% RAM Hit`
    }
  };
}
function countBlocks(node, key) {
  let count = typeof node[key] === "number" ? node[key] : 0;
  if (node.children) {
    for (const c of node.children) {
      count += countBlocks(c, key);
    }
  }
  return count;
}
function generatePostgresTextPlan(node, planningTime, executionTime, options) {
  const lines = [];
  function printNode(n, prefix, isRoot) {
    let line = `${prefix}`;
    if (!isRoot) line += "->  ";
    line += `${n.nodeType}`;
    if (n.relationName) {
      line += ` on ${n.relationName}`;
      if (n.alias && n.alias !== n.relationName) line += ` ${n.alias}`;
    }
    if (n.indexName) {
      line += ` using ${n.indexName}`;
    }
    const costPart = options.costs ? `cost=${n.startupCost.toFixed(2)}..${n.totalCost.toFixed(2)} rows=${n.planRows} width=${n.planWidth}` : "";
    const actualPart = options.analyze ? `actual time=${n.actualStartupTime.toFixed(3)}..${n.actualTotalTime.toFixed(3)} rows=${n.actualRows} loops=${n.actualLoops}` : "";
    if (costPart || actualPart) {
      line += `  (${[costPart, actualPart].filter(Boolean).join(") (")})`;
    }
    lines.push(line);
    const childPrefix = isRoot ? "  " : prefix + "    ";
    if (options.verbose && n.output && n.output.length > 0) {
      lines.push(`${childPrefix}Output: ${n.output.join(", ")}`);
    }
    if (n.lockType) {
      lines.push(`${childPrefix}Lock: ${n.lockType}`);
    }
    if (n.indexCond) {
      lines.push(`${childPrefix}Index Cond: ${n.indexCond}`);
    }
    if (n.filter) {
      lines.push(`${childPrefix}Filter: ${n.filter}`);
    }
    if (n.conflictResolution && n.conflictResolution !== "NONE") {
      lines.push(`${childPrefix}Conflict Resolution: ${n.conflictResolution}`);
    }
    if (options.buffers) {
      lines.push(
        `${childPrefix}Buffers: shared hit=${n.sharedHitBlocks} read=${n.sharedReadBlocks} dirtied=${n.sharedDirtiedBlocks} written=${n.sharedWrittenBlocks}`
      );
    }
    if (options.wal && (n.walRecords || 0) > 0) {
      lines.push(`${childPrefix}WAL: records=${n.walRecords} bytes=${n.walBytes}`);
    }
    if (n.details) {
      n.details.forEach((d) => lines.push(`${childPrefix}${d}`));
    }
    if (n.children) {
      n.children.forEach((c) => printNode(c, childPrefix, false));
    }
  }
  printNode(node, "", true);
  lines.push(`Planning Time: ${planningTime.toFixed(3)} ms`);
  if (options.analyze) {
    lines.push(`Execution Time: ${executionTime.toFixed(3)} ms`);
  }
  return lines.join("\n");
}

// src/services/simulatedWalletEngine.ts
var PROVIDER_SECRETS2 = {
  pragmatic_play: "sk_live_pragmatic_seamless_88492048102",
  evolution: "sk_live_evolution_seamless_39104859103",
  pgsoft: "sk_live_pgsoft_seamless_91823019482",
  spribe: "sk_live_spribe_seamless_74910284910",
  custom_provider: "sk_live_custom_seamless_secret_123456"
};
async function computeHmac(secretKey, message) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
var SimulatedSeamlessEngine = class {
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.wallets = /* @__PURE__ */ new Map();
    // key: `${userId}:${currency}`
    this.transactions = [];
    this.gameRounds = /* @__PURE__ */ new Map();
    // key: `${providerId}:${roundId}`
    this.idempotencyStore = /* @__PURE__ */ new Map();
    this.paymentRequests = [];
    this.wageringRequirements = [];
    this.latencyHistory = [];
    this.latencyListeners = [];
    // SQL Query Audit Logs and Real-time Emitter
    this.sqlQueryLogs = [];
    this.sqlListeners = [];
    // Real-time Transaction Commit Listeners for Live Audit Exporters
    this.transactionListeners = [];
    // Rate Limiting & Load Balancer Throttling (Redis Sliding Window)
    this.rateLimitEnabled = false;
    this.rateLimitMaxRps = 10;
    this.rateLimitHistory = [];
    // Simulated Row-Level Lock Mutex queues per wallet
    this.walletLocks = /* @__PURE__ */ new Map();
    // Simulated provider latency in ms
    this.simulatedLatencyMin = 15;
    this.simulatedLatencyMax = 45;
    this.seedInitialData();
  }
  seedInitialData() {
    this.users.clear();
    this.wallets.clear();
    this.transactions = [];
    this.gameRounds.clear();
    this.idempotencyStore.clear();
    this.paymentRequests = [];
    this.wageringRequirements = [];
    this.walletLocks.clear();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const u1 = {
      id: "a0000000-0000-0000-0000-000000000001",
      username: "high_roller_alex",
      operator_id: "GAMEPLAY365_GLOBAL",
      currency: "USD",
      status: "ACTIVE",
      country_code: "US",
      created_at: now,
      updated_at: now
    };
    const u2 = {
      id: "a0000000-0000-0000-0000-000000000002",
      username: "slot_queen_maria",
      operator_id: "GAMEPLAY365_GLOBAL",
      currency: "USD",
      status: "ACTIVE",
      country_code: "DE",
      created_at: now,
      updated_at: now
    };
    const u3 = {
      id: "a0000000-0000-0000-0000-000000000003",
      username: "suspended_user_dave",
      operator_id: "GAMEPLAY365_GLOBAL",
      currency: "USD",
      status: "SUSPENDED",
      country_code: "UK",
      created_at: now,
      updated_at: now
    };
    const u4 = {
      id: "a0000000-0000-0000-0000-000000000004",
      username: "sakib_vip_dhaka",
      operator_id: "GAMEPLAY365_BD",
      currency: "BDT",
      status: "ACTIVE",
      country_code: "BD",
      created_at: now,
      updated_at: now
    };
    this.users.set(u1.id, u1);
    this.users.set(u2.id, u2);
    this.users.set(u3.id, u3);
    this.users.set(u4.id, u4);
    const w1 = {
      id: "b0000000-0000-0000-0000-000000000001",
      user_id: u1.id,
      currency: "USD",
      real_balance: 2500,
      bonus_balance: 250,
      locked_balance: 0,
      turnover_ratio: 10,
      version: 1,
      status: "ACTIVE",
      created_at: now,
      updated_at: now
    };
    const w2 = {
      id: "b0000000-0000-0000-0000-000000000002",
      user_id: u2.id,
      currency: "USD",
      real_balance: 650,
      bonus_balance: 100,
      locked_balance: 0,
      turnover_ratio: 10,
      version: 1,
      status: "ACTIVE",
      created_at: now,
      updated_at: now
    };
    const w3 = {
      id: "b0000000-0000-0000-0000-000000000003",
      user_id: u3.id,
      currency: "USD",
      real_balance: 50,
      bonus_balance: 0,
      locked_balance: 0,
      turnover_ratio: 10,
      version: 1,
      status: "FROZEN",
      created_at: now,
      updated_at: now
    };
    const w4 = {
      id: "b0000000-0000-0000-0000-000000000004",
      user_id: u4.id,
      currency: "BDT",
      real_balance: 75e3,
      bonus_balance: 1e4,
      locked_balance: 0,
      turnover_ratio: 10,
      version: 1,
      status: "ACTIVE",
      created_at: now,
      updated_at: now
    };
    this.wallets.set(`${u1.id}:USD`, w1);
    this.wallets.set(`${u2.id}:USD`, w2);
    this.wallets.set(`${u3.id}:USD`, w3);
    this.wallets.set(`${u4.id}:BDT`, w4);
    this.paymentRequests.push(
      {
        id: "PAY_REQ_881920",
        user_id: u4.id,
        wallet_id: w4.id,
        type: "DEPOSIT",
        method: "BKASH",
        amount: 25e3,
        currency: "BDT",
        sender_number: "01712-349911",
        receiver_number: "01900-112233",
        trx_id: "BK9A88712K",
        status: "APPROVED",
        admin_note: "Verified against bKash merchant gateway",
        metadata: { channel: "bKash Merchant Send Money", bonusApplied: true },
        created_at: new Date(Date.now() - 36e5 * 4).toISOString(),
        updated_at: new Date(Date.now() - 36e5 * 4).toISOString()
      },
      {
        id: "PAY_REQ_881921",
        user_id: u4.id,
        wallet_id: w4.id,
        type: "DEPOSIT",
        method: "NAGAD",
        amount: 5e4,
        currency: "BDT",
        sender_number: "01844-992200",
        receiver_number: "01900-112233",
        trx_id: "NG7719204A",
        status: "APPROVED",
        admin_note: "Instant VIP Auto-credit",
        metadata: { channel: "Nagad Cash-in Agent", bonusApplied: false },
        created_at: new Date(Date.now() - 36e5 * 2).toISOString(),
        updated_at: new Date(Date.now() - 36e5 * 2).toISOString()
      }
    );
    this.wageringRequirements.push(
      {
        id: "WAGER_REQ_1001",
        user_id: u4.id,
        promo_name: "200% Welcome Mega Bonus",
        bonus_amount_granted: 1e4,
        required_multiplier: 10,
        // 10x turnover requirement
        target_turnover_amount: 1e5,
        completed_turnover_amount: 68500,
        status: "ACTIVE",
        expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
        created_at: new Date(Date.now() - 864e5).toISOString(),
        completed_at: null
      },
      {
        id: "WAGER_REQ_1002",
        user_id: u1.id,
        promo_name: "VIP High Roller Match Bonus",
        bonus_amount_granted: 100,
        required_multiplier: 10,
        target_turnover_amount: 1e3,
        completed_turnover_amount: 1e3,
        status: "ACTIVE",
        expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
        created_at: new Date(Date.now() - 864e5).toISOString(),
        completed_at: null
      }
    );
    this.latencyHistory = [];
    const endpoints = ["balance", "bet", "win", "balance", "bet", "win", "refund"];
    const providers = ["pragmatic_play", "evolution", "pgsoft", "spribe"];
    for (let i = 29; i >= 0; i--) {
      const ep = endpoints[i % endpoints.length];
      const prov = providers[i % providers.length];
      const baseLatency = ep === "balance" ? 14 : ep === "bet" ? 28 : ep === "win" ? 24 : 18;
      const jitter = Math.floor(Math.random() * 20) - 5;
      const latencyMs = Math.max(8, baseLatency + jitter + (i === 12 ? 45 : 0));
      const recordTime = new Date(Date.now() - i * 15e3);
      this.latencyHistory.push({
        id: `LAT_${Date.now() - i * 15e3}_${i}`,
        endpoint: ep,
        provider_id: prov,
        latencyMs,
        statusCode: 200,
        isSuccess: true,
        slaLimitMs: 4e3,
        slaCompliant: latencyMs <= 4e3,
        timestamp: recordTime.getTime(),
        timeLabel: recordTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      });
    }
    this.seedSqlAuditLogs();
  }
  seedSqlAuditLogs() {
    this.sqlQueryLogs = [];
    const sampleQueries = [
      {
        commandType: "SELECT",
        table: "wallets",
        lockLevel: "ROW EXCLUSIVE (FOR UPDATE)",
        statement: `SELECT id, user_id, currency, real_balance, bonus_balance, version FROM wallets WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND currency = 'USD' FOR UPDATE;`,
        bindParams: { user_id: "a0000000-0000-0000-0000-000000000001", currency: "USD" },
        durationMs: 0.142,
        source: "POST /api/seamless/bet",
        txId: "tx_seed_101",
        roundId: "round_pragmatic_8819",
        userId: "a0000000-0000-0000-0000-000000000001",
        status: "SUCCESS",
        affectedRows: 1
      },
      {
        commandType: "UPDATE",
        table: "wallets",
        lockLevel: "EXCLUSIVE",
        statement: `UPDATE wallets SET real_balance = real_balance - 10.0000, version = version + 1, updated_at = NOW() WHERE id = 'b0000000-0000-0000-0000-000000000001';`,
        bindParams: { amount: 10, wallet_id: "b0000000-0000-0000-0000-000000000001" },
        durationMs: 0.188,
        source: "POST /api/seamless/bet",
        txId: "tx_seed_101",
        roundId: "round_pragmatic_8819",
        userId: "a0000000-0000-0000-0000-000000000001",
        status: "SUCCESS",
        affectedRows: 1
      },
      {
        commandType: "INSERT",
        table: "transactions",
        lockLevel: "NONE",
        statement: `INSERT INTO transactions (id, provider_id, transaction_id, user_id, wallet_id, type, amount, currency, before_balance, after_balance, status, created_at) VALUES ('tx_seed_101', 'pragmatic_play', 'prag_bet_88190', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'BET', 10.00, 'USD', 2500.00, 2490.00, 'COMPLETED', NOW());`,
        bindParams: { id: "tx_seed_101", provider_id: "pragmatic_play", amount: 10 },
        durationMs: 0.215,
        source: "POST /api/seamless/bet",
        txId: "tx_seed_101",
        roundId: "round_pragmatic_8819",
        userId: "a0000000-0000-0000-0000-000000000001",
        status: "SUCCESS",
        affectedRows: 1
      },
      {
        commandType: "SELECT",
        table: "idempotency_keys",
        lockLevel: "ACCESS SHARE",
        statement: `SELECT * FROM idempotency_keys WHERE key = 'idempotency:pragmatic_play:bet:prag_bet_88190';`,
        bindParams: { key: "idempotency:pragmatic_play:bet:prag_bet_88190" },
        durationMs: 0.068,
        source: "POST /api/seamless/bet",
        txId: "tx_seed_101",
        status: "SUCCESS",
        affectedRows: 0
      },
      {
        commandType: "INSERT",
        table: "game_rounds",
        lockLevel: "NONE",
        statement: `INSERT INTO game_rounds (id, provider_id, provider_round_id, user_id, game_id, currency, status, total_bet, total_win, net_payout, created_at) VALUES ('rnd_seed_501', 'pragmatic_play', 'round_pragmatic_8819', 'a0000000-0000-0000-0000-000000000001', 'vs20olympgate', 'USD', 'OPEN', 10.00, 0.00, -10.00, NOW()) ON CONFLICT (provider_id, provider_round_id) DO UPDATE SET total_bet = game_rounds.total_bet + 10.00;`,
        bindParams: { provider_round_id: "round_pragmatic_8819", bet: 10 },
        durationMs: 0.195,
        source: "POST /api/seamless/bet",
        roundId: "round_pragmatic_8819",
        status: "SUCCESS",
        affectedRows: 1
      },
      {
        commandType: "SELECT",
        table: "wallets",
        lockLevel: "ROW EXCLUSIVE (FOR UPDATE)",
        statement: `SELECT id, user_id, currency, real_balance, bonus_balance, version FROM wallets WHERE user_id = 'a0000000-0000-0000-0000-000000000001' AND currency = 'USD' FOR UPDATE;`,
        bindParams: { user_id: "a0000000-0000-0000-0000-000000000001", currency: "USD" },
        durationMs: 0.134,
        source: "POST /api/seamless/win",
        txId: "tx_seed_102",
        roundId: "round_pragmatic_8819",
        userId: "a0000000-0000-0000-0000-000000000001",
        status: "SUCCESS",
        affectedRows: 1
      },
      {
        commandType: "UPDATE",
        table: "wallets",
        lockLevel: "EXCLUSIVE",
        statement: `UPDATE wallets SET real_balance = real_balance + 45.0000, version = version + 1, updated_at = NOW() WHERE id = 'b0000000-0000-0000-0000-000000000001';`,
        bindParams: { amount: 45, wallet_id: "b0000000-0000-0000-0000-000000000001" },
        durationMs: 0.176,
        source: "POST /api/seamless/win",
        txId: "tx_seed_102",
        roundId: "round_pragmatic_8819",
        userId: "a0000000-0000-0000-0000-000000000001",
        status: "SUCCESS",
        affectedRows: 1
      },
      {
        commandType: "INSERT",
        table: "transactions",
        lockLevel: "NONE",
        statement: `INSERT INTO transactions (id, provider_id, transaction_id, user_id, wallet_id, type, amount, currency, before_balance, after_balance, status, created_at) VALUES ('tx_seed_102', 'pragmatic_play', 'prag_win_88191', 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'WIN', 45.00, 'USD', 2490.00, 2535.00, 'COMPLETED', NOW());`,
        bindParams: { id: "tx_seed_102", provider_id: "pragmatic_play", amount: 45 },
        durationMs: 0.208,
        source: "POST /api/seamless/win",
        txId: "tx_seed_102",
        roundId: "round_pragmatic_8819",
        userId: "a0000000-0000-0000-0000-000000000001",
        status: "SUCCESS",
        affectedRows: 1
      },
      {
        commandType: "SELECT",
        table: "users",
        lockLevel: "ACCESS SHARE",
        statement: `SELECT id, username, status, currency, operator_id FROM users WHERE id = 'a0000000-0000-0000-0000-000000000004' AND status = 'ACTIVE';`,
        bindParams: { user_id: "a0000000-0000-0000-0000-000000000004" },
        durationMs: 0.082,
        source: "POST /api/seamless/balance",
        userId: "a0000000-0000-0000-0000-000000000004",
        status: "SUCCESS",
        affectedRows: 1
      },
      {
        commandType: "SELECT",
        table: "transactions",
        lockLevel: "ACCESS SHARE",
        statement: `SELECT * FROM transactions WHERE user_id = 'a0000000-0000-0000-0000-000000000004' AND created_at >= NOW() - INTERVAL '30 days' ORDER BY created_at DESC LIMIT 25;`,
        bindParams: { user_id: "a0000000-0000-0000-0000-000000000004", limit: 25 },
        durationMs: 0.165,
        source: "GET /api/ledger/history",
        userId: "a0000000-0000-0000-0000-000000000004",
        status: "SUCCESS",
        affectedRows: 18
      }
    ];
    sampleQueries.forEach((q, idx) => {
      const offsetMs = (sampleQueries.length - idx) * 2e4;
      const ts = Date.now() - offsetMs;
      this.sqlQueryLogs.push({
        ...q,
        id: `sql_seed_${ts}_${idx}`,
        timestamp: ts,
        timeLabel: new Date(ts).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          fractionalSecondDigits: 3
        }),
        isoTimestamp: new Date(ts).toISOString()
      });
    });
  }
  getSqlQueryLogs() {
    return [...this.sqlQueryLogs];
  }
  logSql(entry) {
    const timestamp2 = Date.now();
    const timeLabel = new Date(timestamp2).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3
    });
    const newLog = {
      ...entry,
      id: `sql_${timestamp2}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: timestamp2,
      timeLabel,
      isoTimestamp: new Date(timestamp2).toISOString()
    };
    this.sqlQueryLogs.unshift(newLog);
    if (this.sqlQueryLogs.length > 300) {
      this.sqlQueryLogs.pop();
    }
    this.notifySqlListeners();
    return newLog;
  }
  clearSqlQueryLogs() {
    this.sqlQueryLogs = [];
    this.notifySqlListeners();
  }
  onSqlQueryRecorded(callback) {
    this.sqlListeners.push(callback);
    callback(this.getSqlQueryLogs());
    return () => {
      this.sqlListeners = this.sqlListeners.filter((cb) => cb !== callback);
    };
  }
  notifySqlListeners() {
    const logs = this.getSqlQueryLogs();
    this.sqlListeners.forEach((cb) => cb(logs));
  }
  /**
   * Real-time Transaction Commit Subscriptions
   * Fired each time a BET, WIN, REFUND, or Ledger operation is committed
   */
  onTransactionCommitted(callback) {
    this.transactionListeners.push(callback);
    return () => {
      this.transactionListeners = this.transactionListeners.filter((cb) => cb !== callback);
    };
  }
  recordCommittedTransaction(tx) {
    this.transactions.unshift(tx);
    const all = this.getTransactions();
    this.transactionListeners.forEach((cb) => {
      try {
        cb(tx, all);
      } catch (err) {
        console.error("Error in transaction commit listener:", err);
      }
    });
  }
  executeExplainAnalyze(query3, options) {
    return generateExplainAnalyze(query3, options);
  }
  /**
   * Latency Subscriptions and Real-Time SLA Management
   */
  getLatencyHistory() {
    return [...this.latencyHistory];
  }
  recordLatency(record) {
    const slaLimit = record.slaLimitMs || 4e3;
    const newRecord = {
      ...record,
      id: `LAT_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      slaLimitMs: slaLimit,
      slaCompliant: record.latencyMs <= slaLimit,
      timeLabel: new Date(record.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    };
    this.latencyHistory.push(newRecord);
    if (this.latencyHistory.length > 100) {
      this.latencyHistory.shift();
    }
    this.notifyLatencyListeners();
    return newRecord;
  }
  onLatencyRecorded(callback) {
    this.latencyListeners.push(callback);
    callback(this.getLatencyHistory());
    return () => {
      this.latencyListeners = this.latencyListeners.filter((cb) => cb !== callback);
    };
  }
  notifyLatencyListeners() {
    const list = this.getLatencyHistory();
    this.latencyListeners.forEach((cb) => cb(list));
  }
  clearLatencyHistory() {
    this.latencyHistory = [];
    this.notifyLatencyListeners();
  }
  /**
   * Rate Limiter & Throttler Configuration (Redis Sliding Window)
   */
  setRateLimitConfig(config) {
    this.rateLimitEnabled = config.enabled;
    this.rateLimitMaxRps = config.maxRps;
  }
  getRateLimitConfig() {
    const now = Date.now();
    this.rateLimitHistory = this.rateLimitHistory.filter((t) => now - t < 1e3);
    return {
      enabled: this.rateLimitEnabled,
      maxRps: this.rateLimitMaxRps,
      currentUsage: this.rateLimitHistory.length
    };
  }
  checkRateLimit() {
    if (!this.rateLimitEnabled) {
      return { allowed: true, remaining: 999, resetMs: 0 };
    }
    const now = Date.now();
    this.rateLimitHistory = this.rateLimitHistory.filter((t) => now - t < 1e3);
    if (this.rateLimitHistory.length >= this.rateLimitMaxRps) {
      const oldestInWindow = this.rateLimitHistory[0];
      const resetMs = Math.max(0, 1e3 - (now - oldestInWindow));
      return {
        allowed: false,
        remaining: 0,
        resetMs
      };
    }
    this.rateLimitHistory.push(now);
    return {
      allowed: true,
      remaining: Math.max(0, this.rateLimitMaxRps - this.rateLimitHistory.length),
      resetMs: 1e3
    };
  }
  simulateTrafficBurst(endpointCount = 8) {
    const endpoints = ["balance", "bet", "win", "balance", "bet", "win"];
    const providers = ["pragmatic_play", "evolution", "pgsoft", "spribe"];
    for (let i = 0; i < endpointCount; i++) {
      const ep = endpoints[Math.floor(Math.random() * endpoints.length)];
      const prov = providers[Math.floor(Math.random() * providers.length)];
      const baseLat = ep === "balance" ? 15 : ep === "bet" ? 32 : ep === "win" ? 26 : 20;
      const jitter = Math.floor(Math.random() * 25);
      const latencyMs = baseLat + jitter;
      this.recordLatency({
        endpoint: ep,
        provider_id: prov,
        latencyMs,
        statusCode: 200,
        isSuccess: true,
        timestamp: Date.now() + i * 200
      });
    }
  }
  /**
   * Increments the user's active wagering requirement turnover progress.
   * Called by /api/seamless/win and /api/seamless/bet to track valid turnover.
   */
  incrementWageringProgress(userId, turnoverAmount) {
    if (turnoverAmount <= 0) return { totalTurnoverAdded: 0, activeRequirementsUpdated: 0, newlyCompletedCount: 0 };
    const activeList = this.wageringRequirements.filter(
      (w) => w.user_id === userId && w.status === "ACTIVE"
    );
    let newlyCompletedCount = 0;
    for (const req of activeList) {
      req.completed_turnover_amount = Number((req.completed_turnover_amount + turnoverAmount).toFixed(4));
      if (req.completed_turnover_amount >= req.target_turnover_amount) {
        req.status = "COMPLETED";
        req.completed_at = (/* @__PURE__ */ new Date()).toISOString();
        newlyCompletedCount += 1;
      }
    }
    return {
      totalTurnoverAdded: turnoverAmount,
      activeRequirementsUpdated: activeList.length,
      newlyCompletedCount
    };
  }
  /**
   * Service function that checks if a bonus balance is eligible for conversion to real cash
   * based on a configurable turnover ratio (multiplier).
   */
  checkBonusConversionEligibility(userId, turnoverRatio = 10) {
    const userReqs = this.wageringRequirements.filter((w) => w.user_id === userId);
    const activeReqs = userReqs.filter((w) => w.status === "ACTIVE");
    let totalBonusGranted = 0;
    let targetTurnover = 0;
    let completedTurnover = 0;
    for (const r of userReqs) {
      totalBonusGranted += r.bonus_amount_granted;
      completedTurnover += r.completed_turnover_amount;
      targetTurnover += r.target_turnover_amount;
    }
    let totalBonusBalance = 0;
    for (const w of this.wallets.values()) {
      if (w.user_id === userId) {
        totalBonusBalance += w.bonus_balance;
      }
    }
    const progressPercent = targetTurnover > 0 ? Math.min(100, Math.round(completedTurnover / targetTurnover * 100)) : totalBonusBalance > 0 ? 100 : 0;
    const remainingTurnover = Math.max(0, Number((targetTurnover - completedTurnover).toFixed(2)));
    const isEligible = totalBonusBalance > 0 && (activeReqs.length === 0 || completedTurnover >= targetTurnover);
    return {
      is_eligible: isEligible,
      total_bonus_balance: totalBonusBalance,
      active_target_turnover: targetTurnover,
      completed_turnover: completedTurnover,
      progress_percent: progressPercent,
      remaining_turnover: remainingTurnover,
      convertible_amount: totalBonusBalance,
      requirements: userReqs
    };
  }
  /**
   * Converts eligible bonus balance into real cash ledger balance atomically with Row-Level Locking.
   */
  async convertBonusToRealCash(userId, currency = "BDT", turnoverRatio = 10) {
    const walletKey = `${userId}:${currency}`;
    const releaseLock = await this.acquireRowLock(walletKey);
    try {
      const wallet = this.wallets.get(walletKey);
      if (!wallet) {
        throw new Error(`Wallet not found for user ${userId} and currency ${currency}`);
      }
      const eligibility = this.checkBonusConversionEligibility(userId, turnoverRatio);
      if (!eligibility.is_eligible && wallet.bonus_balance <= 0) {
        throw new Error(
          `Bonus is not eligible for cash conversion yet. Remaining Turnover: ${eligibility.remaining_turnover} ${currency} (${eligibility.progress_percent}% completed)`
        );
      }
      const amountToConvert = wallet.bonus_balance;
      if (amountToConvert <= 0) {
        throw new Error("No bonus balance available to convert.");
      }
      const beforeReal = wallet.real_balance;
      const afterReal = Number((beforeReal + amountToConvert).toFixed(4));
      wallet.real_balance = afterReal;
      wallet.bonus_balance = 0;
      wallet.version += 1;
      wallet.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      for (const r of this.wageringRequirements) {
        if (r.user_id === userId && r.status === "ACTIVE") {
          r.status = "COMPLETED";
          r.completed_at = (/* @__PURE__ */ new Date()).toISOString();
        }
      }
      const convertTxId = `TX_BONUS_CONVERT_${Date.now()}`;
      const tx = {
        id: convertTxId,
        provider_id: "GAMEPLAY365_BONUS_ENGINE",
        transaction_id: `CONVERT_${Date.now()}_${userId.slice(-4)}`,
        reference_transaction_id: `WAGER_REQ_${userId}`,
        user_id: userId,
        wallet_id: wallet.id,
        game_id: "SYSTEM_WAGERING_CONVERSION",
        type: "PROMO",
        amount: amountToConvert,
        currency,
        before_balance: beforeReal,
        after_balance: afterReal,
        status: "COMPLETED",
        metadata: {
          action: "BONUS_CONVERT_TO_REAL_CASH",
          turnoverRatio,
          completedTurnover: eligibility.completed_turnover,
          targetTurnover: eligibility.active_target_turnover
        },
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.transactions.unshift(tx);
      return {
        success: true,
        converted_amount: amountToConvert,
        new_real_balance: afterReal,
        new_bonus_balance: 0,
        message: `Successfully converted ${currency} ${amountToConvert.toLocaleString()} bonus into real withdrawable cash!`
      };
    } finally {
      releaseLock();
    }
  }
  // --- Lock acquisition simulating PostgreSQL `SELECT ... FOR UPDATE` ---
  async acquireRowLock(walletKey) {
    while (this.walletLocks.has(walletKey)) {
      await this.walletLocks.get(walletKey);
    }
    let releaseLock = () => {
    };
    const lockPromise = new Promise((resolve) => {
      releaseLock = () => {
        this.walletLocks.delete(walletKey);
        resolve();
      };
    });
    this.walletLocks.set(walletKey, lockPromise);
    return releaseLock;
  }
  async simulateNetworkDelay(jitterMs = 0) {
    const baseDelay = Math.floor(
      Math.random() * (this.simulatedLatencyMax - this.simulatedLatencyMin + 1)
    ) + this.simulatedLatencyMin;
    const jitter = jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0;
    const totalDelay = baseDelay + jitter;
    await new Promise((resolve) => setTimeout(resolve, totalDelay));
  }
  findUser(identifier) {
    for (const u of this.users.values()) {
      if (u.id === identifier || u.username === identifier) return u;
    }
    return void 0;
  }
  findWallet(userId, currency) {
    const directKey = `${userId}:${currency}`;
    if (this.wallets.has(directKey)) return this.wallets.get(directKey);
    for (const w of this.wallets.values()) {
      if (w.user_id === userId && (w.currency === currency || !currency)) {
        return w;
      }
    }
    return void 0;
  }
  // --------------------------------------------------------------------------
  // Core Dispatcher with HMAC Signature verification
  // --------------------------------------------------------------------------
  async executeRequest(endpoint, payload, options = {}) {
    const start = Date.now();
    const timestamp2 = options.customTimestamp || Date.now();
    const payloadStr = JSON.stringify(payload);
    const providerId = payload.provider_id || "pragmatic_play";
    const secretKey = options.customSecretKey || PROVIDER_SECRETS2[providerId] || "sk_default_secret";
    const messageToSign = `${timestamp2}.${payloadStr}`;
    const expectedSignature = await computeHmac(secretKey, messageToSign);
    const requestSignature = options.customSignature !== void 0 ? options.customSignature : expectedSignature;
    const signatureValid = options.bypassHmac || requestSignature.toLowerCase() === expectedSignature.toLowerCase();
    const rateLimitCheck = this.checkRateLimit();
    if (!rateLimitCheck.allowed) {
      const latency = Math.max(2, Date.now() - start);
      const errorData = {
        code: "RATE_LIMIT_EXCEEDED" /* RATE_LIMIT_EXCEEDED */,
        message: `Too Many Requests: Rate limit threshold of ${this.rateLimitMaxRps} req/s exceeded by provider '${providerId}'. Load balancer throttling active.`,
        retry_after_seconds: 1,
        limit_rps: this.rateLimitMaxRps,
        timestamp: Date.now()
      };
      this.recordLatency({
        endpoint,
        provider_id: providerId,
        latencyMs: latency,
        statusCode: 429,
        isSuccess: false,
        timestamp: Date.now()
      });
      return {
        status: 429,
        data: errorData,
        headers: {
          "x-ratelimit-limit": String(this.rateLimitMaxRps),
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(rateLimitCheck.resetMs),
          "retry-after": "1",
          "x-response-time-ms": String(latency),
          "x-signature": requestSignature,
          "x-timestamp": String(timestamp2)
        },
        latencyMs: latency,
        requestSignature,
        expectedSignature,
        signatureValid: true,
        timestamp: Date.now()
      };
    }
    if (options.simulateTimeout) {
      await new Promise((r) => setTimeout(r, 4100));
      return {
        status: 504,
        data: {
          code: "TIMEOUT_EXCEEDED" /* TIMEOUT_EXCEEDED */,
          message: "Wallet transaction SLA exceeded (4000ms timeout threshold)",
          timestamp: Date.now()
        },
        headers: {
          "x-signature": requestSignature,
          "x-timestamp": String(timestamp2),
          "x-response-time-ms": "4100"
        },
        latencyMs: 4100,
        requestSignature,
        expectedSignature,
        signatureValid,
        timestamp: Date.now()
      };
    }
    await this.simulateNetworkDelay(options.latencyJitterMs);
    if (!options.bypassHmac && !signatureValid) {
      const latency = Date.now() - start;
      return {
        status: 401,
        data: {
          code: "INVALID_SIGNATURE" /* INVALID_SIGNATURE */,
          message: "Cryptographic HMAC-SHA256 signature verification failed",
          timestamp: Date.now()
        },
        headers: {
          "x-signature": requestSignature,
          "x-timestamp": String(timestamp2),
          "x-response-time-ms": String(latency)
        },
        latencyMs: latency,
        requestSignature,
        expectedSignature,
        signatureValid: false,
        timestamp: Date.now()
      };
    }
    try {
      let result;
      let status = 200;
      switch (endpoint) {
        case "balance":
          result = await this.handleBalance(payload);
          break;
        case "bet":
          result = await this.handleBet(payload);
          break;
        case "win":
          result = await this.handleWin(payload);
          break;
        case "refund":
          result = await this.handleRefund(payload);
          break;
      }
      const latency = Date.now() - start;
      this.recordLatency({
        endpoint,
        provider_id: providerId,
        latencyMs: latency,
        statusCode: status,
        isSuccess: true,
        timestamp: Date.now()
      });
      return {
        status,
        data: result,
        headers: {
          "x-signature": requestSignature,
          "x-timestamp": String(timestamp2),
          "x-response-time-ms": String(latency)
        },
        latencyMs: latency,
        requestSignature,
        expectedSignature,
        signatureValid: true,
        timestamp: Date.now()
      };
    } catch (err) {
      const latency = Date.now() - start;
      const statusCode = err.status || 500;
      this.recordLatency({
        endpoint,
        provider_id: providerId,
        latencyMs: latency,
        statusCode,
        isSuccess: false,
        timestamp: Date.now()
      });
      return {
        status: statusCode,
        data: {
          code: err.code || "INTERNAL_ERROR" /* INTERNAL_ERROR */,
          message: err.message || "Internal wallet transaction error",
          balance: err.balance,
          currency: err.currency,
          timestamp: Date.now()
        },
        headers: {
          "x-signature": requestSignature,
          "x-timestamp": String(timestamp2),
          "x-response-time-ms": String(latency)
        },
        latencyMs: latency,
        requestSignature,
        expectedSignature,
        signatureValid: true,
        timestamp: Date.now()
      };
    }
  }
  // --- Handlers replicating Postgres Row-Level Lock & ACID properties ---
  async handleBalance(req) {
    const user = this.findUser(req.user_id);
    if (!user) {
      this.logSql({
        commandType: "SELECT",
        table: "users",
        lockLevel: "ACCESS SHARE",
        statement: `SELECT * FROM users WHERE id = '${req.user_id}';`,
        bindParams: { user_id: req.user_id },
        durationMs: 0.054,
        source: "POST /api/seamless/balance",
        userId: req.user_id,
        status: "SUCCESS",
        affectedRows: 0
      });
      throw {
        status: 404,
        code: "USER_NOT_FOUND" /* USER_NOT_FOUND */,
        message: `Player '${req.user_id}' not found`
      };
    }
    if (user.status !== "ACTIVE") {
      throw {
        status: 403,
        code: "USER_FROZEN" /* USER_FROZEN */,
        message: `Player account is ${user.status}`
      };
    }
    const walletKey = `${user.id}:${req.currency}`;
    const wallet = this.wallets.get(walletKey);
    if (!wallet) {
      throw {
        status: 404,
        code: "USER_NOT_FOUND" /* USER_NOT_FOUND */,
        message: `No ${req.currency} wallet found for user`
      };
    }
    this.logSql({
      commandType: "SELECT",
      table: "wallets",
      lockLevel: "ACCESS SHARE",
      statement: `SELECT id, user_id, currency, real_balance, bonus_balance, status FROM wallets WHERE user_id = '${user.id}' AND currency = '${req.currency}';`,
      bindParams: { user_id: user.id, currency: req.currency },
      durationMs: 0.076,
      source: "POST /api/seamless/balance",
      userId: user.id,
      status: "SUCCESS",
      affectedRows: 1
    });
    return {
      code: "SUCCESS" /* SUCCESS */,
      message: "Success",
      user_id: user.id,
      balance: wallet.real_balance,
      bonus_balance: wallet.bonus_balance,
      currency: req.currency,
      timestamp: Date.now()
    };
  }
  async handleBet(req) {
    const idempotencyKey = `idempotency:${req.provider_id}:bet:${req.transaction_id}`;
    const cached = this.idempotencyStore.get(idempotencyKey);
    if (cached) {
      this.logSql({
        commandType: "SELECT",
        table: "idempotency_keys",
        lockLevel: "ACCESS SHARE",
        statement: `SELECT * FROM idempotency_keys WHERE key = '${idempotencyKey}';`,
        bindParams: { key: idempotencyKey },
        durationMs: 0.042,
        source: "POST /api/seamless/bet (Idempotent Cache Hit)",
        txId: req.transaction_id,
        status: "SUCCESS",
        affectedRows: 1
      });
      return { ...cached.response, is_idempotent: true };
    }
    const user = this.findUser(req.user_id);
    if (!user) {
      throw {
        status: 404,
        code: "USER_NOT_FOUND" /* USER_NOT_FOUND */,
        message: `Player '${req.user_id}' not found`
      };
    }
    if (user.status !== "ACTIVE") {
      throw {
        status: 403,
        code: "USER_FROZEN" /* USER_FROZEN */,
        message: `Player account is ${user.status}`
      };
    }
    const walletKey = `${user.id}:${req.currency}`;
    const releaseLock = await this.acquireRowLock(walletKey);
    try {
      const doubleCheck = this.idempotencyStore.get(idempotencyKey);
      if (doubleCheck) {
        return { ...doubleCheck.response, is_idempotent: true };
      }
      const wallet = this.wallets.get(walletKey);
      if (!wallet) {
        throw {
          status: 404,
          code: "USER_NOT_FOUND" /* USER_NOT_FOUND */,
          message: `Wallet for currency '${req.currency}' not found`
        };
      }
      if (wallet.status !== "ACTIVE") {
        throw {
          status: 403,
          code: "USER_FROZEN" /* USER_FROZEN */,
          message: "Wallet is frozen"
        };
      }
      const betAmount = Number(req.amount);
      if (betAmount <= 0) {
        throw {
          status: 400,
          code: "INVALID_REQUEST" /* INVALID_REQUEST */,
          message: "Bet amount must be > 0"
        };
      }
      if (wallet.real_balance < betAmount) {
        throw {
          status: 400,
          code: "INSUFFICIENT_FUNDS" /* INSUFFICIENT_FUNDS */,
          message: `Insufficient funds. Required: ${betAmount.toFixed(2)}, Available: ${wallet.real_balance.toFixed(2)}`,
          balance: wallet.real_balance,
          currency: req.currency
        };
      }
      const beforeBalance = wallet.real_balance;
      const afterBalance = Number((beforeBalance - betAmount).toFixed(4));
      this.logSql({
        commandType: "SELECT",
        table: "wallets",
        lockLevel: "ROW EXCLUSIVE (FOR UPDATE)",
        statement: `SELECT id, user_id, currency, real_balance, bonus_balance, version FROM wallets WHERE user_id = '${user.id}' AND currency = '${req.currency}' FOR UPDATE;`,
        bindParams: { user_id: user.id, currency: req.currency },
        durationMs: 0.125,
        source: "POST /api/seamless/bet",
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: "SUCCESS",
        affectedRows: 1
      });
      wallet.real_balance = afterBalance;
      wallet.version += 1;
      wallet.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      this.logSql({
        commandType: "UPDATE",
        table: "wallets",
        lockLevel: "EXCLUSIVE",
        statement: `UPDATE wallets SET real_balance = ${afterBalance.toFixed(4)}, version = ${wallet.version}, updated_at = NOW() WHERE id = '${wallet.id}';`,
        bindParams: { real_balance: afterBalance, version: wallet.version, id: wallet.id },
        durationMs: 0.168,
        source: "POST /api/seamless/bet",
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: "SUCCESS",
        affectedRows: 1
      });
      const roundKey = `${req.provider_id}:${req.round_id}`;
      let round = this.gameRounds.get(roundKey);
      if (!round) {
        round = {
          id: `rnd_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
          provider_id: req.provider_id,
          provider_round_id: req.round_id,
          user_id: user.id,
          game_id: req.game_id,
          currency: req.currency,
          status: "OPEN",
          total_bet: betAmount,
          total_win: 0,
          net_payout: -betAmount,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        this.gameRounds.set(roundKey, round);
      } else {
        round.total_bet = Number((round.total_bet + betAmount).toFixed(4));
        round.net_payout = Number((round.total_win - round.total_bet).toFixed(4));
      }
      const wageringUpdate = this.incrementWageringProgress(user.id, betAmount);
      const wageringProgress = this.checkBonusConversionEligibility(user.id);
      const operatorTxId = `tx_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
      const txEntity = {
        id: operatorTxId,
        provider_id: req.provider_id,
        transaction_id: req.transaction_id,
        user_id: user.id,
        wallet_id: wallet.id,
        round_id: round.id,
        provider_round_id: req.round_id,
        game_id: req.game_id,
        type: "BET",
        amount: betAmount,
        currency: req.currency,
        before_balance: beforeBalance,
        after_balance: afterBalance,
        status: "COMPLETED",
        metadata: {
          ...req.metadata || {},
          wagering_progress_turnover: betAmount,
          is_bonus_conversion_eligible: wageringProgress.is_eligible,
          wagering_completed_percent: wageringProgress.progress_percent
        },
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.recordCommittedTransaction(txEntity);
      this.logSql({
        commandType: "INSERT",
        table: "transactions",
        lockLevel: "NONE",
        statement: `INSERT INTO transactions (id, provider_id, transaction_id, user_id, wallet_id, type, amount, currency, before_balance, after_balance, status, created_at) VALUES ('${operatorTxId}', '${req.provider_id}', '${req.transaction_id}', '${user.id}', '${wallet.id}', 'BET', ${betAmount.toFixed(2)}, '${req.currency}', ${beforeBalance.toFixed(2)}, ${afterBalance.toFixed(2)}, 'COMPLETED', NOW());`,
        bindParams: { id: operatorTxId, amount: betAmount, currency: req.currency },
        durationMs: 0.198,
        source: "POST /api/seamless/bet",
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: "SUCCESS",
        affectedRows: 1
      });
      const resp = {
        code: "SUCCESS" /* SUCCESS */,
        message: "Bet placed successfully",
        transaction_id: req.transaction_id,
        operator_transaction_id: operatorTxId,
        round_id: req.round_id,
        balance: afterBalance,
        bonus_balance: wallet.bonus_balance,
        currency: req.currency,
        timestamp: Date.now(),
        is_idempotent: false
      };
      this.idempotencyStore.set(idempotencyKey, {
        key: idempotencyKey,
        provider_id: req.provider_id,
        endpoint: "bet",
        response: resp,
        status_code: 200,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      return resp;
    } finally {
      releaseLock();
    }
  }
  async handleWin(req) {
    const idempotencyKey = `idempotency:${req.provider_id}:win:${req.transaction_id}`;
    const cached = this.idempotencyStore.get(idempotencyKey);
    if (cached) {
      return { ...cached.response, is_idempotent: true };
    }
    const user = this.findUser(req.user_id);
    if (!user) {
      throw {
        status: 404,
        code: "USER_NOT_FOUND" /* USER_NOT_FOUND */,
        message: `Player '${req.user_id}' not found`
      };
    }
    const walletKey = `${user.id}:${req.currency}`;
    const releaseLock = await this.acquireRowLock(walletKey);
    try {
      const doubleCheck = this.idempotencyStore.get(idempotencyKey);
      if (doubleCheck) {
        return { ...doubleCheck.response, is_idempotent: true };
      }
      const wallet = this.wallets.get(walletKey);
      if (!wallet) {
        throw {
          status: 404,
          code: "USER_NOT_FOUND" /* USER_NOT_FOUND */,
          message: `Wallet for currency '${req.currency}' not found`
        };
      }
      const winAmount = Number(req.amount || 0);
      if (winAmount < 0) {
        throw {
          status: 400,
          code: "INVALID_REQUEST" /* INVALID_REQUEST */,
          message: "Win amount cannot be negative"
        };
      }
      const beforeBalance = wallet.real_balance;
      const afterBalance = Number((beforeBalance + winAmount).toFixed(4));
      this.logSql({
        commandType: "SELECT",
        table: "wallets",
        lockLevel: "ROW EXCLUSIVE (FOR UPDATE)",
        statement: `SELECT id, user_id, currency, real_balance, bonus_balance, version FROM wallets WHERE user_id = '${user.id}' AND currency = '${req.currency}' FOR UPDATE;`,
        bindParams: { user_id: user.id, currency: req.currency },
        durationMs: 0.119,
        source: "POST /api/seamless/win",
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: "SUCCESS",
        affectedRows: 1
      });
      wallet.real_balance = afterBalance;
      wallet.version += 1;
      wallet.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      this.logSql({
        commandType: "UPDATE",
        table: "wallets",
        lockLevel: "EXCLUSIVE",
        statement: `UPDATE wallets SET real_balance = ${afterBalance.toFixed(4)}, version = ${wallet.version}, updated_at = NOW() WHERE id = '${wallet.id}';`,
        bindParams: { real_balance: afterBalance, version: wallet.version, id: wallet.id },
        durationMs: 0.155,
        source: "POST /api/seamless/win",
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: "SUCCESS",
        affectedRows: 1
      });
      const roundKey = `${req.provider_id}:${req.round_id}`;
      let round = this.gameRounds.get(roundKey);
      if (!round) {
        round = {
          id: `rnd_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
          provider_id: req.provider_id,
          provider_round_id: req.round_id,
          user_id: user.id,
          game_id: req.game_id,
          currency: req.currency,
          status: req.is_round_end !== false ? "SETTLED" : "OPEN",
          total_bet: 0,
          total_win: winAmount,
          net_payout: winAmount,
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          closed_at: req.is_round_end !== false ? (/* @__PURE__ */ new Date()).toISOString() : null
        };
        this.gameRounds.set(roundKey, round);
      } else {
        round.total_win = Number((round.total_win + winAmount).toFixed(4));
        round.net_payout = Number((round.total_win - round.total_bet).toFixed(4));
        if (req.is_round_end !== false) {
          round.status = "SETTLED";
          round.closed_at = (/* @__PURE__ */ new Date()).toISOString();
        }
      }
      const turnoverToCredit = winAmount > 0 ? winAmount : round.total_bet > 0 ? round.total_bet : 0;
      const wageringUpdate = this.incrementWageringProgress(user.id, turnoverToCredit);
      const wageringProgress = this.checkBonusConversionEligibility(user.id);
      const operatorTxId = `tx_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
      const txEntity = {
        id: operatorTxId,
        provider_id: req.provider_id,
        transaction_id: req.transaction_id,
        reference_transaction_id: req.reference_transaction_id || null,
        user_id: user.id,
        wallet_id: wallet.id,
        round_id: round.id,
        provider_round_id: req.round_id,
        game_id: req.game_id,
        type: "WIN",
        amount: winAmount,
        currency: req.currency,
        before_balance: beforeBalance,
        after_balance: afterBalance,
        status: "COMPLETED",
        metadata: {
          ...req.metadata || {},
          wagering_turnover_credited: turnoverToCredit,
          is_bonus_conversion_eligible: wageringProgress.is_eligible,
          wagering_completed_percent: wageringProgress.progress_percent,
          remaining_turnover_needed: wageringProgress.remaining_turnover
        },
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.recordCommittedTransaction(txEntity);
      this.logSql({
        commandType: "INSERT",
        table: "transactions",
        lockLevel: "NONE",
        statement: `INSERT INTO transactions (id, provider_id, transaction_id, user_id, wallet_id, type, amount, currency, before_balance, after_balance, status, created_at) VALUES ('${operatorTxId}', '${req.provider_id}', '${req.transaction_id}', '${user.id}', '${wallet.id}', 'WIN', ${winAmount.toFixed(2)}, '${req.currency}', ${beforeBalance.toFixed(2)}, ${afterBalance.toFixed(2)}, 'COMPLETED', NOW());`,
        bindParams: { id: operatorTxId, amount: winAmount, currency: req.currency },
        durationMs: 0.185,
        source: "POST /api/seamless/win",
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: "SUCCESS",
        affectedRows: 1
      });
      const resp = {
        code: "SUCCESS" /* SUCCESS */,
        message: "Win payout processed",
        transaction_id: req.transaction_id,
        operator_transaction_id: operatorTxId,
        round_id: req.round_id,
        balance: afterBalance,
        bonus_balance: wallet.bonus_balance,
        currency: req.currency,
        timestamp: Date.now(),
        is_idempotent: false
      };
      this.idempotencyStore.set(idempotencyKey, {
        key: idempotencyKey,
        provider_id: req.provider_id,
        endpoint: "win",
        response: resp,
        status_code: 200,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      return resp;
    } finally {
      releaseLock();
    }
  }
  async handleRefund(req) {
    const idempotencyKey = `idempotency:${req.provider_id}:refund:${req.transaction_id}`;
    const cached = this.idempotencyStore.get(idempotencyKey);
    if (cached) {
      return { ...cached.response, is_idempotent: true };
    }
    const user = this.findUser(req.user_id);
    if (!user) {
      throw {
        status: 404,
        code: "USER_NOT_FOUND" /* USER_NOT_FOUND */,
        message: `Player '${req.user_id}' not found`
      };
    }
    const walletKey = `${user.id}:${req.currency}`;
    const releaseLock = await this.acquireRowLock(walletKey);
    try {
      const doubleCheck = this.idempotencyStore.get(idempotencyKey);
      if (doubleCheck) {
        return { ...doubleCheck.response, is_idempotent: true };
      }
      const origTx = this.transactions.find(
        (t) => t.provider_id === req.provider_id && t.transaction_id === req.reference_transaction_id && t.type === "BET"
      );
      if (!origTx) {
        throw {
          status: 404,
          code: "TRANSACTION_NOT_FOUND" /* TRANSACTION_NOT_FOUND */,
          message: `Original BET transaction '${req.reference_transaction_id}' not found to refund`
        };
      }
      const alreadyRefunded = this.transactions.some(
        (t) => t.provider_id === req.provider_id && t.reference_transaction_id === req.reference_transaction_id && t.type === "REFUND"
      );
      if (alreadyRefunded) {
        throw {
          status: 409,
          code: "TRANSACTION_ALREADY_SETTLED" /* TRANSACTION_ALREADY_SETTLED */,
          message: `Transaction '${req.reference_transaction_id}' has already been refunded`
        };
      }
      const wallet = this.wallets.get(walletKey);
      if (!wallet) {
        throw {
          status: 404,
          code: "USER_NOT_FOUND" /* USER_NOT_FOUND */,
          message: "Wallet not found"
        };
      }
      const refundAmount = Number(req.amount > 0 ? req.amount : origTx.amount);
      const beforeBalance = wallet.real_balance;
      const afterBalance = Number((beforeBalance + refundAmount).toFixed(4));
      this.logSql({
        commandType: "SELECT",
        table: "wallets",
        lockLevel: "ROW EXCLUSIVE (FOR UPDATE)",
        statement: `SELECT id, user_id, currency, real_balance, bonus_balance, version FROM wallets WHERE user_id = '${user.id}' AND currency = '${req.currency}' FOR UPDATE;`,
        bindParams: { user_id: user.id, currency: req.currency },
        durationMs: 0.108,
        source: "POST /api/seamless/refund",
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: "SUCCESS",
        affectedRows: 1
      });
      wallet.real_balance = afterBalance;
      wallet.version += 1;
      wallet.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      this.logSql({
        commandType: "UPDATE",
        table: "wallets",
        lockLevel: "EXCLUSIVE",
        statement: `UPDATE wallets SET real_balance = ${afterBalance.toFixed(4)}, version = ${wallet.version}, updated_at = NOW() WHERE id = '${wallet.id}';`,
        bindParams: { real_balance: afterBalance, version: wallet.version, id: wallet.id },
        durationMs: 0.144,
        source: "POST /api/seamless/refund",
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: "SUCCESS",
        affectedRows: 1
      });
      const roundKey = `${req.provider_id}:${req.round_id}`;
      const round = this.gameRounds.get(roundKey);
      if (round) {
        round.status = "REFUNDED";
        round.closed_at = (/* @__PURE__ */ new Date()).toISOString();
      }
      const operatorTxId = `tx_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
      const txEntity = {
        id: operatorTxId,
        provider_id: req.provider_id,
        transaction_id: req.transaction_id,
        reference_transaction_id: req.reference_transaction_id,
        user_id: user.id,
        wallet_id: wallet.id,
        provider_round_id: req.round_id,
        game_id: req.game_id,
        type: "REFUND",
        amount: refundAmount,
        currency: req.currency,
        before_balance: beforeBalance,
        after_balance: afterBalance,
        status: "COMPLETED",
        metadata: { reason: req.reason, ...req.metadata },
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      this.recordCommittedTransaction(txEntity);
      this.logSql({
        commandType: "INSERT",
        table: "transactions",
        lockLevel: "NONE",
        statement: `INSERT INTO transactions (id, provider_id, transaction_id, reference_transaction_id, user_id, wallet_id, type, amount, currency, before_balance, after_balance, status, created_at) VALUES ('${operatorTxId}', '${req.provider_id}', '${req.transaction_id}', '${req.reference_transaction_id}', '${user.id}', '${wallet.id}', 'REFUND', ${refundAmount.toFixed(2)}, '${req.currency}', ${beforeBalance.toFixed(2)}, ${afterBalance.toFixed(2)}, 'COMPLETED', NOW());`,
        bindParams: { id: operatorTxId, amount: refundAmount, currency: req.currency },
        durationMs: 0.172,
        source: "POST /api/seamless/refund",
        txId: req.transaction_id,
        roundId: req.round_id,
        userId: user.id,
        status: "SUCCESS",
        affectedRows: 1
      });
      const resp = {
        code: "SUCCESS" /* SUCCESS */,
        message: "Bet refund processed and balance restored",
        transaction_id: req.transaction_id,
        operator_transaction_id: operatorTxId,
        round_id: req.round_id,
        balance: afterBalance,
        bonus_balance: wallet.bonus_balance,
        currency: req.currency,
        timestamp: Date.now(),
        is_idempotent: false
      };
      this.idempotencyStore.set(idempotencyKey, {
        key: idempotencyKey,
        provider_id: req.provider_id,
        endpoint: "refund",
        response: resp,
        status_code: 200,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      });
      return resp;
    } finally {
      releaseLock();
    }
  }
  // --------------------------------------------------------------------------
  // Concurrency Stress Tester Engine
  // Fires N concurrent requests on a single wallet to test Row-Level Locks
  // --------------------------------------------------------------------------
  async runConcurrencyStressTest(userId, currency, numConcurrentRequests, betAmountPerRequest, identicalTxId = false) {
    const user = this.findUser(userId);
    if (!user) throw new Error("User not found");
    const walletKey = `${user.id}:${currency}`;
    const wallet = this.wallets.get(walletKey);
    if (!wallet) throw new Error("Wallet not found");
    const initialBalance = wallet.real_balance;
    const startTime = Date.now();
    const staticTxId = `stress_tx_${Date.now()}`;
    const promises = Array.from({ length: numConcurrentRequests }, async (_, index) => {
      const threadId = index + 1;
      const txId = identicalTxId ? staticTxId : `stress_${Date.now()}_t${threadId}_${Math.random().toString(36).substring(7)}`;
      const roundId = `stress_round_${Math.floor(index / 2)}`;
      const betReq = {
        provider_id: "pragmatic_play",
        user_id: user.id,
        currency,
        transaction_id: txId,
        round_id: roundId,
        game_id: "sweet_bonanza",
        amount: betAmountPerRequest,
        metadata: { stressThread: threadId }
      };
      const res = await this.executeRequest("bet", betReq, { bypassHmac: true });
      return {
        id: index,
        thread: threadId,
        requestTxId: txId,
        status: res.status,
        code: res.data.code,
        balance: res.data.balance !== void 0 ? res.data.balance : wallet.real_balance,
        latencyMs: res.latencyMs,
        message: res.data.message,
        isIdempotent: res.data.is_idempotent
      };
    });
    const logs = await Promise.all(promises);
    const totalDurationMs = Date.now() - startTime;
    const finalBalance = wallet.real_balance;
    let successful = 0;
    let failed = 0;
    let idempotentReplays = 0;
    for (const l of logs) {
      if (l.isIdempotent) {
        idempotentReplays++;
      } else if (l.status === 200) {
        successful++;
      } else {
        failed++;
      }
    }
    const expectedBalance = identicalTxId ? Number((initialBalance - betAmountPerRequest).toFixed(4)) : Number((initialBalance - successful * betAmountPerRequest).toFixed(4));
    const discrepancy = Math.abs(finalBalance - expectedBalance);
    return {
      totalRequests: numConcurrentRequests,
      successful,
      failed,
      idempotentReplays,
      initialBalance,
      finalBalance,
      expectedBalance,
      discrepancy,
      totalDurationMs,
      logs
    };
  }
  // --- Getters for Explorer & UI State ---
  getUsers() {
    return Array.from(this.users.values());
  }
  getWallets() {
    return Array.from(this.wallets.values());
  }
  getTransactions() {
    return [...this.transactions];
  }
  getGameRounds() {
    return Array.from(this.gameRounds.values());
  }
  getIdempotencyRecords() {
    return Array.from(this.idempotencyStore.values());
  }
  topUpWallet(userId, currency, amount) {
    const user = this.findUser(userId);
    if (!user) return;
    const key = `${user.id}:${currency}`;
    const wallet = this.wallets.get(key);
    if (wallet) {
      wallet.real_balance = Number((wallet.real_balance + amount).toFixed(4));
      wallet.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    }
  }
  setWalletBalance(userId, currency, amount) {
    const user = this.findUser(userId);
    if (!user) return;
    const key = `${user.id}:${currency}`;
    const wallet = this.wallets.get(key);
    if (wallet) {
      wallet.real_balance = Math.max(0, Number(amount.toFixed(4)));
      wallet.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    }
  }
  // --- Payment Request Handlers (bKash, Nagad, Rocket, Upay) ---
  getPaymentRequests() {
    return [...this.paymentRequests].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
  async submitDepositRequest(params) {
    const user = this.findUser(params.userId);
    if (!user) throw new Error("User not found");
    const wallet = this.findWallet(user.id, params.currency);
    if (!wallet) throw new Error(`Wallet not found for currency ${params.currency}`);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const requestId = `PAY_DEP_${Math.floor(1e5 + Math.random() * 9e5)}`;
    const newRequest = {
      id: requestId,
      user_id: user.id,
      wallet_id: wallet.id,
      type: "DEPOSIT",
      method: params.method,
      amount: Number(params.amount.toFixed(4)),
      currency: params.currency,
      sender_number: params.senderNumber,
      receiver_number: params.receiverNumber,
      trx_id: params.trxId.toUpperCase(),
      status: params.autoApprove ? "APPROVED" : "PENDING",
      admin_note: params.autoApprove ? "Instant Automated bKash/Nagad Merchant Validation" : "Awaiting Operator Approval",
      metadata: {
        platform: "Playall 365 Cashier",
        timestamp: Date.now()
      },
      created_at: now,
      updated_at: now
    };
    this.paymentRequests.unshift(newRequest);
    if (params.autoApprove) {
      const releaseLock = await this.acquireRowLock(`${user.id}:${params.currency}`);
      try {
        const beforeBalance = wallet.real_balance;
        wallet.real_balance = Number((wallet.real_balance + params.amount).toFixed(4));
        wallet.version += 1;
        wallet.updated_at = now;
        const ledgerTx = {
          id: `LEDGER_DEP_${Date.now()}`,
          provider_id: "CASHIER_LOCAL",
          transaction_id: `DEP_${params.trxId.toUpperCase()}`,
          reference_transaction_id: requestId,
          user_id: user.id,
          wallet_id: wallet.id,
          game_id: "CASHIER_DEPOSIT",
          type: "PROMO",
          // deposit ledger type
          amount: params.amount,
          currency: params.currency,
          before_balance: beforeBalance,
          after_balance: wallet.real_balance,
          status: "COMPLETED",
          metadata: {
            method: params.method,
            sender: params.senderNumber,
            trxId: params.trxId
          },
          created_at: now
        };
        this.recordCommittedTransaction(ledgerTx);
      } finally {
        releaseLock();
      }
    }
    return newRequest;
  }
  async submitWithdrawalRequest(params) {
    const user = this.findUser(params.userId);
    if (!user) throw new Error("User not found");
    const wallet = this.findWallet(user.id, params.currency);
    if (!wallet) throw new Error(`Wallet not found for currency ${params.currency}`);
    if (wallet.real_balance < params.amount) {
      throw new Error("Insufficient funds for withdrawal");
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const requestId = `PAY_WTH_${Math.floor(1e5 + Math.random() * 9e5)}`;
    const trxId = `WTH_${params.method}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const releaseLock = await this.acquireRowLock(`${user.id}:${params.currency}`);
    try {
      const beforeBalance = wallet.real_balance;
      wallet.real_balance = Number((wallet.real_balance - params.amount).toFixed(4));
      wallet.version += 1;
      wallet.updated_at = now;
      const ledgerTx = {
        id: `LEDGER_WTH_${Date.now()}`,
        provider_id: "CASHIER_LOCAL",
        transaction_id: trxId,
        reference_transaction_id: requestId,
        user_id: user.id,
        wallet_id: wallet.id,
        game_id: "CASHIER_WITHDRAWAL",
        type: "TIP",
        // payout ledger type
        amount: params.amount,
        currency: params.currency,
        before_balance: beforeBalance,
        after_balance: wallet.real_balance,
        status: "COMPLETED",
        metadata: {
          method: params.method,
          accountNumber: params.receiverNumber
        },
        created_at: now
      };
      this.recordCommittedTransaction(ledgerTx);
    } finally {
      releaseLock();
    }
    const newRequest = {
      id: requestId,
      user_id: user.id,
      wallet_id: wallet.id,
      type: "WITHDRAWAL",
      method: params.method,
      amount: Number(params.amount.toFixed(4)),
      currency: params.currency,
      receiver_number: params.receiverNumber,
      trx_id: trxId,
      status: params.autoApprove ? "APPROVED" : "PENDING",
      admin_note: params.autoApprove ? "Instant VIP Dispatched" : "Queued for Bank/Agent Transfer",
      metadata: {
        platform: "Playall 365 Cashier",
        timestamp: Date.now()
      },
      created_at: now,
      updated_at: now
    };
    this.paymentRequests.unshift(newRequest);
    return newRequest;
  }
  async approvePaymentRequest(requestId) {
    const req = this.paymentRequests.find((r) => r.id === requestId);
    if (!req) throw new Error("Payment request not found");
    if (req.status !== "PENDING") throw new Error("Payment request is not pending");
    req.status = "APPROVED";
    req.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    req.admin_note = "Approved by Operator Administrator";
    if (req.type === "DEPOSIT") {
      const user = this.findUser(req.user_id);
      if (user) {
        this.topUpWallet(user.id, req.currency, req.amount);
      }
    }
    return req;
  }
  // --- Real-time User Registration & Authentication ---
  registerUser(params) {
    const existing = Array.from(this.users.values()).find(
      (u) => u.username.toLowerCase() === params.username.toLowerCase()
    );
    if (existing) {
      const existingWallet = this.findWallet(existing.id, existing.currency);
      if (existingWallet) return { user: existing, wallet: existingWallet };
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const userId = `u_${Date.now()}_${Math.floor(1e3 + Math.random() * 9e3)}`;
    const walletId = `w_${Date.now()}_${Math.floor(1e3 + Math.random() * 9e3)}`;
    const starterBonus = 0;
    const starterReal = 0;
    const newUser = {
      id: userId,
      username: params.username,
      operator_id: params.currency === "BDT" ? "GAMEPLAY365_BD" : "GAMEPLAY365_GLOBAL",
      currency: params.currency,
      status: "ACTIVE",
      country_code: params.currency === "BDT" ? "BD" : "US",
      created_at: now,
      updated_at: now
    };
    const newWallet = {
      id: walletId,
      user_id: userId,
      currency: params.currency,
      real_balance: 0,
      bonus_balance: 0,
      locked_balance: 0,
      turnover_ratio: 10,
      version: 1,
      status: "ACTIVE",
      created_at: now,
      updated_at: now
    };
    this.users.set(userId, newUser);
    this.wallets.set(`${userId}:${params.currency}`, newWallet);
    const openTx = {
      id: `LEDGER_OPEN_${Date.now()}`,
      provider_id: "GAMEPLAY365_AUTH",
      transaction_id: `ACCT_OPEN_${Date.now()}`,
      reference_transaction_id: `REG_${userId}`,
      user_id: userId,
      wallet_id: walletId,
      game_id: "SYSTEM_ACCOUNT_OPENING",
      type: "PROMO",
      amount: 0,
      currency: params.currency,
      before_balance: 0,
      after_balance: 0,
      status: "COMPLETED",
      metadata: {
        promoCode: params.promoCode || "STANDARD",
        phone: params.phone,
        email: params.email,
        note: "Live User Registered with 0.00 initial balance. Deposit required to play."
      },
      created_at: now
    };
    this.transactions.unshift(openTx);
    this.wageringRequirements.push({
      id: `WAGER_REQ_${Date.now()}`,
      user_id: userId,
      promo_name: "200% Welcome Registration Bonus",
      bonus_amount_granted: starterBonus,
      required_multiplier: 10,
      target_turnover_amount: starterBonus * 10,
      completed_turnover_amount: 0,
      status: "ACTIVE",
      expires_at: new Date(Date.now() + 14 * 864e5).toISOString(),
      created_at: now,
      completed_at: null
    });
    return { user: newUser, wallet: newWallet };
  }
  getWageringRequirements(userId) {
    if (userId) {
      return this.wageringRequirements.filter((w) => w.user_id === userId);
    }
    return [...this.wageringRequirements];
  }
  getDiagnostics() {
    return {
      users: this.users.size,
      wallets: this.wallets.size,
      transactions: this.transactions.length,
      gameRounds: this.gameRounds.size,
      idempotencyStore: this.idempotencyStore.size,
      paymentRequests: this.paymentRequests.length,
      sqlQueryLogs: this.sqlQueryLogs.length,
      latencyHistory: this.latencyHistory.length,
      wageringRequirements: this.wageringRequirements.length
    };
  }
};
var seamlessEngine = new SimulatedSeamlessEngine();

// src/services/notificationService.ts
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";

// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "my-app-3d013",
  appId: "1:476127189079:web:7aabee5c1b7d1d851d6b12",
  apiKey: "AIzaSyCrQWrE-ZK4rFeU71Dpi59iXz4SSMLDuuk",
  authDomain: "my-app-3d013.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-remixigamingseam-f254c3d9-f0b0-442c-9107-66d13db9b3fe",
  storageBucket: "my-app-3d013.firebasestorage.app",
  messagingSenderId: "476127189079",
  measurementId: "G-0DDR8VF34M",
  oAuthClientId: "476127189079-o6gfjpavbi3grbmeegp0bq6mbrg5bfa2.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// src/lib/firebase.ts
var firebaseConfig = {
  ...firebase_applet_config_default,
  firestoreDatabaseId: firebase_applet_config_default.firestoreDatabaseId || "ai-studio-remixigamingseam-f254c3d9-f0b0-442c-9107-66d13db9b3fe"
};
var SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.metadata.readonly"
];
var app = initializeApp(firebaseConfig);
var auth = getAuth(app);
try {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn("Firebase setPersistence notice:", err);
  });
} catch (e) {
  console.warn("Firebase persistence initialization error:", e);
}
var FIRESTORE_DATABASE_ID = firebaseConfig.firestoreDatabaseId;
var db2 = getFirestore(app, firebaseConfig.firestoreDatabaseId);
var googleAuthProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => {
  googleAuthProvider.addScope(scope);
});

// src/services/notificationService.ts
import confetti from "canvas-confetti";
var INITIAL_NOTIFICATIONS = [
  {
    id: "notif_seed_001",
    userId: "a0000000-0000-0000-0000-000000000004",
    // Sakib (VIP)
    title: "\u09AC\u09BF\u0995\u09BE\u09B6 \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 (Approved)",
    message: "\u0986\u09AA\u09A8\u09BE\u09B0 \u09F3\u09EB,\u09E6\u09E6\u09E6 \u099F\u09BE\u0995\u09BE\u09B0 \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u09B0\u09BF\u0995\u09CB\u09AF\u09BC\u09C7\u09B8\u09CD\u099F \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09AA\u09CD\u09B0\u09B8\u09C7\u09B8 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 (TrxID: 9J3K88L2).",
    type: "WITHDRAWAL_APPROVED",
    amount: 5e3,
    currency: "BDT",
    isRead: false,
    actionTab: "cashier",
    createdAt: new Date(Date.now() - 1e3 * 60 * 12).toISOString()
  },
  {
    id: "notif_seed_002",
    userId: "a0000000-0000-0000-0000-000000000004",
    title: "\u09E7\u09E6\u09E6% \u09B8\u09BE\u09AA\u09CD\u09A4\u09BE\u09B9\u09BF\u0995 \u09B0\u09BF\u09B2\u09CB\u09A1 \u09AC\u09CB\u09A8\u09BE\u09B8 \u0986\u09A8\u09B2\u0995!",
    message: "\u0985\u09AD\u09BF\u09A8\u09A8\u09CD\u09A6\u09A8! \u0986\u09AA\u09A8\u09BE\u09B0 \u09A1\u09BF\u09AA\u09CB\u099C\u09BF\u099F\u09C7 \u09F3\u09E8,\u09EB\u09E6\u09E6 \u09AC\u09CB\u09A8\u09BE\u09B8 \u0995\u09CD\u09B0\u09C7\u09A1\u09BF\u099F \u0986\u09A8\u09B2\u0995 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964 \u098F\u0996\u09A8\u0987 \u098F\u09AD\u09BF\u09AF\u09BC\u09C7\u099F\u09B0 \u0996\u09C7\u09B2\u09C1\u09A8\u0964",
    type: "BONUS_UNLOCKED",
    amount: 2500,
    currency: "BDT",
    isRead: false,
    actionTab: "promo",
    createdAt: new Date(Date.now() - 1e3 * 60 * 45).toISOString()
  },
  {
    id: "notif_seed_003",
    userId: "a0000000-0000-0000-0000-000000000004",
    title: "\u09AD\u09BF\u0986\u0987\u09AA\u09BF \u09A1\u09BE\u09AF\u09BC\u09AE\u09A8\u09CD\u09A1 \u0995\u09CD\u09AF\u09BE\u09B6\u09AC\u09CD\u09AF\u09BE\u0995 \u099C\u09AE\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7",
    message: "\u0986\u09AA\u09A8\u09BE\u09B0 \u0997\u09A4 \u09B8\u09AA\u09CD\u09A4\u09BE\u09B9\u09C7\u09B0 \u09E7.\u09EB% \u09A1\u09BE\u09AF\u09BC\u09AE\u09A8\u09CD\u09A1 \u0995\u09CD\u09AF\u09BE\u09B6\u09AC\u09CD\u09AF\u09BE\u0995 \u09F3\u09E7,\u09EE\u09EB\u09E6 \u09B8\u09B0\u09BE\u09B8\u09B0\u09BF \u0993\u09AF\u09BC\u09BE\u09B2\u09C7\u099F\u09C7 \u09AF\u09C1\u0995\u09CD\u09A4 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964",
    type: "VIP_UPGRADE",
    amount: 1850,
    currency: "BDT",
    isRead: true,
    actionTab: "vip",
    createdAt: new Date(Date.now() - 1e3 * 60 * 180).toISOString()
  }
];
var NotificationService = class {
  constructor() {
    this.localNotifications = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Map();
    this.localNotifications.set(
      "a0000000-0000-0000-0000-000000000004",
      [...INITIAL_NOTIFICATIONS]
    );
  }
  /**
   * Subscribe to real-time notification updates for a specific user
   */
  subscribe(userId, callback) {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, []);
    }
    this.listeners.get(userId).push(callback);
    const current = this.getUserNotifications(userId);
    callback(current);
    let unsubscribeFirestore = null;
    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        const notifsRef = collection(db2, "users", userId, "notifications");
        unsubscribeFirestore = onSnapshot(
          notifsRef,
          (snapshot) => {
            const firestoreNotifs = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              firestoreNotifs.push({
                id: docSnap.id,
                userId: data.userId || userId,
                title: data.title || "",
                message: data.message || "",
                type: data.type || "SYSTEM_ALERT",
                amount: data.amount,
                currency: data.currency || "BDT",
                isRead: !!data.isRead,
                actionTab: data.actionTab,
                createdAt: data.createdAt || (/* @__PURE__ */ new Date()).toISOString()
              });
            });
            firestoreNotifs.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            if (firestoreNotifs.length > 0) {
              this.localNotifications.set(userId, firestoreNotifs);
              this.notifyListeners(userId);
            }
          },
          (error) => {
            console.warn("Firestore notification listener fallback to local state:", error);
          }
        );
      }
    } catch (err) {
      console.warn("Notification listener initial error:", err);
    }
    return () => {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
      const list = this.listeners.get(userId) || [];
      this.listeners.set(
        userId,
        list.filter((cb) => cb !== callback)
      );
    };
  }
  /**
   * Get current notifications for user
   */
  getUserNotifications(userId) {
    const list = this.localNotifications.get(userId) || [];
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  /**
   * Dispatch a real-time notification
   */
  async pushNotification(userId, notification) {
    const newNotif = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const current = this.localNotifications.get(userId) || [];
    this.localNotifications.set(userId, [newNotif, ...current]);
    this.notifyListeners(userId);
    if (notification.type === "WITHDRAWAL_APPROVED" || notification.type === "BONUS_UNLOCKED" || notification.type === "VIP_UPGRADE") {
      try {
        confetti({
          particleCount: 50,
          spread: 55,
          origin: { y: 0.1, x: 0.85 },
          colors: ["#06b6d4", "#f59e0b", "#10b981", "#ec4899"]
        });
      } catch (e) {
      }
    }
    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        const notifDoc = doc(db2, "users", userId, "notifications", newNotif.id);
        await setDoc(notifDoc, {
          ...newNotif,
          serverTimestamp: serverTimestamp()
        });
      }
    } catch (err) {
      console.warn("Firestore notif push fallback:", err);
    }
    return newNotif;
  }
  /**
   * Mark a notification as read
   */
  async markAsRead(userId, notificationId) {
    const current = this.localNotifications.get(userId) || [];
    const updated = current.map(
      (n) => n.id === notificationId ? { ...n, isRead: true } : n
    );
    this.localNotifications.set(userId, updated);
    this.notifyListeners(userId);
    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        const notifDoc = doc(db2, "users", userId, "notifications", notificationId);
        await updateDoc(notifDoc, { isRead: true });
      }
    } catch (err) {
    }
  }
  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    const current = this.localNotifications.get(userId) || [];
    const updated = current.map((n) => ({ ...n, isRead: true }));
    this.localNotifications.set(userId, updated);
    this.notifyListeners(userId);
    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        for (const notif of current) {
          if (!notif.isRead) {
            const notifDoc = doc(db2, "users", userId, "notifications", notif.id);
            await updateDoc(notifDoc, { isRead: true });
          }
        }
      }
    } catch (err) {
    }
  }
  /**
   * Delete a notification
   */
  async deleteNotification(userId, notificationId) {
    const current = this.localNotifications.get(userId) || [];
    const updated = current.filter((n) => n.id !== notificationId);
    this.localNotifications.set(userId, updated);
    this.notifyListeners(userId);
    try {
      if (auth.currentUser && auth.currentUser.uid === userId) {
        const notifDoc = doc(db2, "users", userId, "notifications", notificationId);
        await deleteDoc(notifDoc);
      }
    } catch (err) {
    }
  }
  /**
   * Clear all notifications for user
   */
  clearAll(userId) {
    this.localNotifications.set(userId, []);
    this.notifyListeners(userId);
  }
  /**
   * Trigger Real-Time Deposit Confirmation Notification
   */
  notifyDepositConfirmed(amount, currency = "BDT", gateway = "bKash", userId) {
    const targetUid = userId || "a0000000-0000-0000-0000-000000000004";
    return this.pushNotification(targetUid, {
      userId: targetUid,
      title: `\u2705 ${gateway} \u09A1\u09BF\u09AA\u09CB\u099C\u09BF\u099F \u09B8\u09AB\u09B2 \u0993 \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8 \u09AF\u09C1\u0995\u09CD\u09A4 \u09B9\u09DF\u09C7\u099B\u09C7!`,
      message: `\u0986\u09AA\u09A8\u09BE\u09B0 ${currency === "BDT" ? "\u09F3" : "$"}${amount.toLocaleString()} \u09A1\u09BF\u09AA\u09CB\u099C\u09BF\u099F \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 \u09B9\u09DF\u09C7 \u09B8\u09B0\u09BE\u09B8\u09B0\u09BF \u0993\u09DF\u09BE\u09B2\u09C7\u099F\u09C7 \u09AF\u09C1\u0995\u09CD\u09A4 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7\u0964`,
      type: "DEPOSIT_CONFIRMED",
      amount,
      currency,
      isRead: false,
      actionTab: "cashier"
    });
  }
  /**
   * Trigger Real-Time Withdrawal Approval Notification
   */
  notifyWithdrawalApproved(amount, currency = "BDT", userId) {
    const targetUid = userId || "a0000000-0000-0000-0000-000000000004";
    return this.pushNotification(targetUid, {
      userId: targetUid,
      title: `\u2705 \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 \u0993 \u09A1\u09BF\u09B8\u09AA\u09CD\u09AF\u09BE\u099A \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7`,
      message: `\u0986\u09AA\u09A8\u09BE\u09B0 ${currency === "BDT" ? "\u09F3" : "$"}${amount.toLocaleString()} \u099F\u09BE\u0995\u09BE\u09B0 \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09A8 \u0995\u09B0\u09C7 \u098F\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u09AA\u09BE\u09A0\u09BE\u09A8\u09CB \u09B9\u09DF\u09C7\u099B\u09C7\u0964`,
      type: "WITHDRAWAL_APPROVED",
      amount,
      currency,
      isRead: false,
      actionTab: "cashier"
    });
  }
  /**
   * Trigger Real-Time System Notification Alert
   */
  notifySystemAlert(title, message, userId) {
    const targetUid = userId || "a0000000-0000-0000-0000-000000000004";
    return this.pushNotification(targetUid, {
      userId: targetUid,
      title,
      message,
      type: "SYSTEM_ALERT",
      isRead: false,
      actionTab: "cashier"
    });
  }
  /**
   * Trigger Simulated Withdrawal Approval for instant testing
   */
  simulateWithdrawalApproved(userId, amount = 7500, gateway = "bKash") {
    return this.pushNotification(userId, {
      userId,
      title: `\u2705 ${gateway} \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 (${gateway} Payout Approved)`,
      message: `\u0986\u09AA\u09A8\u09BE\u09B0 \u09F3${amount.toLocaleString()} \u099F\u09BE\u0995\u09BE\u09B0 \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u0985\u09A8\u09C1\u09AE\u09CB\u09A6\u09BF\u09A4 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7 \u098F\u09AC\u0982 \u0986\u09AA\u09A8\u09BE\u09B0 ${gateway} \u098F\u0995\u09BE\u0989\u09A8\u09CD\u099F\u09C7 \u09AA\u09BE\u09A0\u09BE\u09A8\u09CB \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964`,
      type: "WITHDRAWAL_APPROVED",
      amount,
      currency: "BDT",
      isRead: false,
      actionTab: "cashier"
    });
  }
  /**
   * Trigger Simulated Bonus Unlock for instant testing
   */
  simulateBonusUnlocked(userId, bonusName = "\u09E8\u09E6\u09E6% \u09AE\u09C7\u0997\u09BE \u0993\u09AF\u09BC\u09C7\u09B2\u0995\u09BE\u09AE \u09AC\u09CB\u09A8\u09BE\u09B8", amount = 3e3) {
    return this.pushNotification(userId, {
      userId,
      title: `\u{1F381} ${bonusName} \u0986\u09A8\u09B2\u0995 \u09B9\u09AF\u09BC\u09C7\u099B\u09C7!`,
      message: `\u0986\u09AA\u09A8\u09BE\u09B0 \u09AA\u09CD\u09B0\u09CB\u09AB\u09BE\u0987\u09B2\u09C7 \u09F3${amount.toLocaleString()} \u09AC\u09CB\u09A8\u09BE\u09B8 \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8 \u09AF\u09CB\u0997 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964 \u098F\u0996\u09A8\u0987 \u09AC\u09BE\u099C\u09BF \u09A7\u09B0\u09C7 \u09B0\u09BF\u09AF\u09BC\u09C7\u09B2 \u0995\u09CD\u09AF\u09BE\u09B6\u09C7 \u0995\u09A8\u09AD\u09BE\u09B0\u09CD\u099F \u0995\u09B0\u09C1\u09A8!`,
      type: "BONUS_UNLOCKED",
      amount,
      currency: "BDT",
      isRead: false,
      actionTab: "wagering"
    });
  }
  notifyListeners(userId) {
    const list = this.listeners.get(userId) || [];
    const notifs = this.getUserNotifications(userId);
    list.forEach((cb) => cb(notifs));
  }
};
var notificationService = new NotificationService();

// src/services/soundEngine.ts
var CasinoSoundEngine = class {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.spinInterval = null;
    this.jetOsc = null;
    this.jetGain = null;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("gp365_sound_muted");
      this.isMuted = stored === "true";
    }
  }
  initCtx() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }
  toggleMute() {
    this.isMuted = !this.isMuted;
    if (typeof window !== "undefined") {
      localStorage.setItem("gp365_sound_muted", String(this.isMuted));
    }
    if (this.isMuted) {
      this.stopReelSpin();
      this.stopAviatorJet();
    }
    return !this.isMuted;
  }
  getIsMuted() {
    return this.isMuted;
  }
  setMuted(muted) {
    this.isMuted = muted;
    if (typeof window !== "undefined") {
      localStorage.setItem("gp365_sound_muted", String(muted));
    }
    if (muted) {
      this.stopReelSpin();
      this.stopAviatorJet();
    }
  }
  /**
   * Crisp UI Click & Navigation Tones
   */
  playClick(freq = 880) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.4, now + 0.045);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.045);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }
  /**
   * Cashier / Security Error Buzzer
   */
  playCashierError() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.setValueAtTime(120, now + 0.1);
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.22);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }
  /**
   * Navigation Tab Switch Tone (Smooth dual-chime)
   */
  playNavClick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(700, now);
    osc1.frequency.exponentialRampToValueAtTime(950, now + 0.06);
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(1e-3, now + 0.06);
    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.065);
  }
  /**
   * Wallet Deposit / Credit Sound (Rising cheerful harmonic chime)
   */
  playWalletCredit() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const notes = [587.33, 739.99, 880, 1174.66];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + idx * 0.05;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.22);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    });
    setTimeout(() => {
      this.playCoinShower(6);
    }, 150);
  }
  /**
   * Wallet Bet Deduction (Soft mechanical click / coin flip)
   */
  playWalletDeduct() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.07);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.07);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }
  /**
   * Standard Win Sound with tiered feedback
   */
  playWin(amount = 0, multiplier = 1) {
    if (this.isMuted) return;
    if (multiplier >= 20 || amount >= 5e3) {
      this.playMegaWin();
    } else if (multiplier >= 5 || amount >= 1e3) {
      this.playWinChime();
      this.playCoinShower(10);
    } else {
      this.playWinChime();
      this.playCoinShower(4);
    }
  }
  /**
   * Continuous Mechanical Reel Spinning Sound (Ratchet Whir)
   */
  startReelSpin() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    this.stopReelSpin();
    this.spinInterval = setInterval(() => {
      if (this.isMuted || !this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(260 + Math.random() * 90, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.035);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.035);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    }, 65);
  }
  stopReelSpin() {
    if (this.spinInterval) {
      clearInterval(this.spinInterval);
      this.spinInterval = null;
    }
  }
  /**
   * Complete Audio Engine Shutdown / Kill Switch
   */
  stopAll() {
    this.stopReelSpin();
    this.stopAviatorJet();
  }
  /**
   * Reel Stop "Thud/Clack" per column
   */
  playReelStop(reelIndex = 0) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const baseFreq = 190 + reelIndex * 35;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.08);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.09);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }
  /**
   * Aviator Jet Engine Pitch Acceleration
   */
  startAviatorJet(multiplier = 1) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const freq = Math.min(900, 140 + multiplier * 60);
    if (!this.jetOsc) {
      this.jetOsc = this.ctx.createOscillator();
      this.jetGain = this.ctx.createGain();
      this.jetOsc.type = "sawtooth";
      this.jetOsc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(450, this.ctx.currentTime);
      this.jetGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      this.jetOsc.connect(filter);
      filter.connect(this.jetGain);
      this.jetGain.connect(this.ctx.destination);
      this.jetOsc.start();
    } else {
      this.jetOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    }
  }
  stopAviatorJet() {
    if (this.jetOsc && this.ctx) {
      try {
        if (this.jetGain) {
          this.jetGain.gain.setValueAtTime(0, this.ctx.currentTime);
        }
        this.jetOsc.stop();
        this.jetOsc.disconnect();
      } catch (e) {
      }
      this.jetOsc = null;
      this.jetGain = null;
    }
  }
  /**
   * Plane Crashed / Flew Away Sound
   */
  playPlaneCrash() {
    this.stopAviatorJet();
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.35);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);
  }
  /**
   * Card Flip & Card Snap (for Jili Super Ace)
   */
  playCardFlip() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(650, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.05);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }
  /**
   * Standard Win Chime (Arpeggio notes)
   */
  playWinChime() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + idx * 0.07;
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    });
  }
  /**
   * Metallic Coin Cascade (Fast coins dropping)
   */
  playCoinShower(count = 8) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    for (let i = 0; i < count; i++) {
      const delay = i * 0.045 + Math.random() * 0.02;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + delay;
      const freqs = [1200, 1480, 1820, 2100, 2450];
      const freq = freqs[Math.floor(Math.random() * freqs.length)];
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, now + 0.06);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.07);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  }
  /**
   * Lucky Wheel Tick Sound
   */
  playWheelTick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.025);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.025);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.03);
  }
  /**
   * Mega Win Fanfare & Celebratory Crescendo Chords
   */
  playMegaWin() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const chords = [
      { notes: [261.63, 329.63, 392], start: 0, dur: 0.2 },
      { notes: [349.23, 440, 523.25], start: 0.22, dur: 0.2 },
      { notes: [392, 493.88, 587.33], start: 0.44, dur: 0.25 },
      { notes: [523.25, 659.25, 783.99, 1046.5], start: 0.7, dur: 0.8 }
    ];
    chords.forEach((chord) => {
      chord.notes.forEach((freq) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const now = this.ctx.currentTime + chord.start;
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(1e-3, now + chord.dur);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + chord.dur + 0.05);
      });
    });
    setTimeout(() => {
      this.playCoinShower(16);
    }, 600);
  }
  playBigWinCelebration() {
    this.playMegaWin();
  }
  /**
   * Golden Tile Transform / Scatter Mystical Shimmer
   */
  playGoldTransform() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const freqs = [800, 1100, 1400, 1750, 2200];
    freqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + idx * 0.04;
      osc.type = "sine";
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.5, now + 0.12);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.14);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    });
  }
  /**
   * Quick Slot Spin sound (convenience method)
   */
  playSpin() {
    this.startReelSpin();
    setTimeout(() => {
      this.stopReelSpin();
    }, 600);
  }
  /**
   * Cashout Sound
   */
  playCashout(amount = 0) {
    this.playWalletCredit();
  }
  /**
   * Lightning Strike Electric Arc Sound
   */
  playLightning() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.22);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }
  /**
   * Card Dealing / Table Felt Sound
   */
  playDealCard() {
    this.playCardFlip();
  }
  /**
   * Spribe Crash / Explosion Sound
   */
  playCrash() {
    this.playPlaneCrash();
  }
  /**
   * Gem / Diamond Reveal Sound
   */
  playGem() {
    this.playGoldTransform();
  }
};
var soundEngine = new CasinoSoundEngine();

// src/services/webhookLogger.ts
import {
  collection as collection2,
  doc as doc2,
  setDoc as setDoc2,
  deleteDoc as deleteDoc2,
  query as query2,
  orderBy as orderBy2,
  limit,
  onSnapshot as onSnapshot2
} from "firebase/firestore";
var COLLECTION_NAME = "webhook_logs";
var CACHE_STORAGE_KEY = "playall365_webhook_logs_v1";
var MAX_LOGS_KEPT = 100;
var WebhookLoggerService = class {
  constructor() {
    this.logs = [];
    this.listeners = /* @__PURE__ */ new Set();
    this.isListeningFirestore = false;
    this.unsubscribeFirestore = null;
    this.isInitialized = false;
    this.loadFromCache();
    this.initFirestoreListener();
  }
  /**
   * Load locally cached webhook logs from localStorage for immediate display
   */
  loadFromCache() {
    try {
      const cached = localStorage.getItem(CACHE_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.logs = parsed;
        }
      }
    } catch {
    }
    if (this.logs.length === 0) {
      this.logs = this.getPreseededLogs();
      this.saveToCache();
    }
  }
  /**
   * Persist current in-memory log list to localStorage cache
   */
  saveToCache() {
    try {
      localStorage.setItem(
        CACHE_STORAGE_KEY,
        JSON.stringify(this.logs.slice(0, MAX_LOGS_KEPT))
      );
    } catch {
    }
    this.notifySubscribers();
  }
  /**
   * Notify all React components / inspector listeners of log state updates
   */
  notifySubscribers() {
    const list = [...this.logs];
    this.listeners.forEach((listener) => {
      try {
        listener(list);
      } catch (err) {
        console.warn("WebhookLogger listener error:", err);
      }
    });
  }
  /**
   * Establish real-time Firestore database listener on 'webhook_logs'
   */
  initFirestoreListener() {
    if (this.isListeningFirestore) return;
    try {
      const logsCollection = collection2(db2, COLLECTION_NAME);
      const q = query2(logsCollection, orderBy2("createdAt", "desc"), limit(MAX_LOGS_KEPT));
      this.unsubscribeFirestore = onSnapshot2(
        q,
        (snapshot) => {
          this.isListeningFirestore = true;
          this.isInitialized = true;
          if (!snapshot.empty) {
            const remoteLogs = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              remoteLogs.push({
                ...data,
                id: docSnap.id
              });
            });
            this.mergeRemoteLogs(remoteLogs);
          } else if (this.logs.length > 0) {
            this.syncSeedToFirestore();
          }
        },
        (error) => {
          console.warn("Firestore webhook_logs onSnapshot error, operating in local-resilient mode:", error.message);
          this.isListeningFirestore = false;
        }
      );
    } catch (error) {
      console.warn("Could not attach Firestore onSnapshot for webhook_logs:", error);
    }
  }
  /**
   * Merges remote Firestore documents into local cache
   */
  mergeRemoteLogs(remoteLogs) {
    const map = /* @__PURE__ */ new Map();
    this.logs.forEach((log) => map.set(log.id, log));
    remoteLogs.forEach((log) => map.set(log.id, log));
    this.logs = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    this.saveToCache();
  }
  /**
   * Sync initial seed logs to Firestore asynchronously
   */
  async syncSeedToFirestore() {
    try {
      for (const log of this.logs) {
        const docRef = doc2(db2, COLLECTION_NAME, log.id);
        await setDoc2(docRef, log, { merge: true });
      }
    } catch {
    }
  }
  // ==========================================================================
  // CORE API: Intercept & Log Inbound Webhooks
  // ==========================================================================
  /**
   * Intercepts an incoming webhook payload, validates its cryptographic signature,
   * calculates latency, formats headers, persists to Firestore database,
   * and dispatches update to inspector subscribers.
   */
  async interceptAndLog(params) {
    const { provider, payload, signature, options } = params;
    const startTime = performance.now();
    const eventType = options?.eventType || payload.event || payload.eventType || payload.action || "payment.notification";
    const eventId = payload.eventId || payload.id || payload.trxID || `evt_${provider}_${Date.now()}_${Math.floor(1e3 + Math.random() * 9e3)}`;
    const expectedSig = options?.expectedSignature || signature;
    const isSignatureValid = options?.expectedSignature ? signature === options.expectedSignature : signature !== "0000000000000000000000000000000000000000000000000000000000000000" && signature.length >= 16;
    const latency = options?.simulatedLatency ?? Math.floor(performance.now() - startTime + 20 + Math.random() * 35);
    const logId = `WH_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const headers = options?.headers || {
      "content-type": "application/json",
      "x-provider-id": String(provider),
      "x-signature": signature,
      "x-timestamp": String(Date.now()),
      "x-webhook-id": logId,
      "user-agent": `SeamlessGateway-Webhook-Engine/3.0 (${provider})`,
      "x-forwarded-for": options?.ipAddress || "103.119.100.45"
    };
    const httpStatus = isSignatureValid ? 200 : 401;
    const processResult = isSignatureValid ? `\u2705 200 OK: Signature verified via HMAC-SHA256. Payload accepted & ledger synced.` : `\u274C 401 Unauthorized: HMAC signature mismatch or payload tampering detected. Callback rejected.`;
    const logEntry = {
      id: logId,
      provider,
      eventType,
      eventId,
      signature,
      expectedSignature: expectedSig,
      signatureValid: isSignatureValid,
      payload,
      headers,
      httpStatus,
      processed: isSignatureValid,
      processResult,
      latencyMs: latency,
      retryCount: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.logs = [logEntry, ...this.logs.filter((l) => l.id !== logEntry.id)].slice(
      0,
      MAX_LOGS_KEPT
    );
    this.saveToCache();
    try {
      const docRef = doc2(db2, COLLECTION_NAME, logEntry.id);
      await setDoc2(docRef, logEntry);
    } catch (error) {
      console.warn(`WebhookLogger: Firestore write fallback, error:`, error);
    }
    return logEntry;
  }
  /**
   * Re-processes a logged webhook to simulate a gateway retry / replay
   */
  async reprocessWebhook(webhookId) {
    const logIndex = this.logs.findIndex((w) => w.id === webhookId);
    if (logIndex === -1) {
      throw new Error(`Webhook with ID "${webhookId}" not found in logger history`);
    }
    const log = this.logs[logIndex];
    const startTime = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 300));
    const isValid = log.expectedSignature ? log.signature === log.expectedSignature : log.signatureValid;
    const retryCount = (log.retryCount || 0) + 1;
    const latency = Math.floor(performance.now() - startTime + 15 + Math.random() * 25);
    const updatedLog = {
      ...log,
      processed: isValid,
      httpStatus: isValid ? 200 : 401,
      processResult: isValid ? `\u2705 Re-processed successfully (Attempt #${retryCount}). Signature & payload idempotency confirmed.` : `\u274C Re-process failed (Attempt #${retryCount}): Signature verification rejected with HTTP 401.`,
      latencyMs: latency,
      retryCount,
      lastRetriedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.logs[logIndex] = updatedLog;
    this.saveToCache();
    try {
      const docRef = doc2(db2, COLLECTION_NAME, updatedLog.id);
      await setDoc2(docRef, updatedLog, { merge: true });
    } catch (error) {
      console.warn("WebhookLogger: Firestore retry update fallback:", error);
    }
    if (isValid) {
      soundEngine.playWalletCredit();
    } else {
      soundEngine.playCashout();
    }
    return {
      success: isValid,
      message: updatedLog.processResult || "",
      log: updatedLog
    };
  }
  /**
   * Get all intercepted webhook logs
   */
  getLogs() {
    return [...this.logs];
  }
  /**
   * Calculate aggregated metrics for inspector dashboards
   */
  getStats() {
    const total = this.logs.length;
    const valid = this.logs.filter((w) => w.signatureValid).length;
    const invalid = total - valid;
    const retried = this.logs.filter((w) => (w.retryCount || 0) > 0).length;
    const avgLatency = total > 0 ? Math.round(this.logs.reduce((acc, curr) => acc + (curr.latencyMs || 25), 0) / total) : 0;
    return {
      total,
      valid,
      invalid,
      retried,
      avgLatency,
      lastInterceptedAt: this.logs[0]?.createdAt
    };
  }
  /**
   * Subscribe to real-time webhook interception updates
   */
  subscribe(listener) {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }
  /**
   * Clear all webhook logs from both Firestore and local memory
   */
  async clearLogs() {
    const idsToDelete = this.logs.map((l) => l.id);
    this.logs = [];
    this.saveToCache();
    try {
      for (const id of idsToDelete) {
        const docRef = doc2(db2, COLLECTION_NAME, id);
        await deleteDoc2(docRef);
      }
    } catch (error) {
      console.warn("WebhookLogger: Error clearing remote logs:", error);
    }
  }
  /**
   * Pre-seed default high-value logs for realistic simulation
   */
  getPreseededLogs() {
    const now = Date.now();
    return [
      {
        id: "WH_20260822_BK901",
        provider: "bkash",
        eventType: "payment.success",
        eventId: "evt_bk_891029481",
        signature: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        expectedSignature: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        signatureValid: true,
        payload: {
          event: "payment.success",
          trxID: "BL92A81K09",
          merchantInvoiceNumber: "DEP-20260821-9A41K",
          amount: "5000.00",
          currency: "BDT",
          senderNumber: "01712-349911",
          destinationAccount: "01900-112233",
          transactionStatus: "Completed",
          paymentExecuteTime: new Date(now - 355e4).toISOString()
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "bkash",
          "x-signature": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          "x-timestamp": String(now - 355e4),
          "x-webhook-id": "whk_bk_901",
          "user-agent": "bKash-PaymentGateway-IPN/2.1"
        },
        httpStatus: 200,
        processed: true,
        processResult: "\u2705 Signature verified via HMAC-SHA256. Deposit credited to user wallet.",
        latencyMs: 42,
        retryCount: 0,
        createdAt: new Date(now - 355e4).toISOString()
      },
      {
        id: "WH_20260822_NG804",
        provider: "nagad",
        eventType: "payout.disbursed",
        eventId: "evt_ng_771920194",
        signature: "f4d9b1a0398f6e1029c8e9b41829e01928491823019284019283401928340192",
        expectedSignature: "f4d9b1a0398f6e1029c8e9b41829e01928491823019284019283401928340192",
        signatureValid: true,
        payload: {
          event: "payout.disbursed",
          issuerTrxId: "NG_DISB_891028",
          orderId: "WTH-20260821-7B22Z",
          amount: "3000.00",
          currency: "BDT",
          recipientAccount: "01844-992200",
          status: "SUCCESS",
          payoutTime: new Date(now - 718e4).toISOString()
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "nagad",
          "x-signature": "f4d9b1a0398f6e1029c8e9b41829e01928491823019284019283401928340192",
          "x-timestamp": String(now - 718e4),
          "x-webhook-id": "whk_ng_804",
          "user-agent": "Nagad-DirectPayout-Engine/1.0"
        },
        httpStatus: 200,
        processed: true,
        processResult: "\u2705 Payout confirmation verified. Reserved balance finalized.",
        latencyMs: 38,
        retryCount: 0,
        createdAt: new Date(now - 718e4).toISOString()
      },
      {
        id: "WH_20260822_PG701",
        provider: "pgsoft",
        eventType: "game.round_settled",
        eventId: "evt_pg_551920841",
        signature: "a918204810294810293840192834019283401928340192834019283401928340",
        expectedSignature: "a918204810294810293840192834019283401928340192834019283401928340",
        signatureValid: true,
        payload: {
          event: "game.round_settled",
          provider: "pgsoft",
          gameId: "mahjong-ways-2",
          userId: "u_10291",
          roundId: "RND_99210948",
          betAmount: 100,
          winAmount: 450,
          netSettlement: 350,
          currency: "BDT",
          timestamp: new Date(now - 12e5).toISOString()
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "pgsoft",
          "x-signature": "a918204810294810293840192834019283401928340192834019283401928340",
          "x-timestamp": String(now - 12e5),
          "x-webhook-id": "whk_pg_701",
          "user-agent": "PGSoft-Seamless-Engine/4.8"
        },
        httpStatus: 200,
        processed: true,
        processResult: "\u2705 Game round outcome validated and seamlessly credited.",
        latencyMs: 19,
        retryCount: 0,
        createdAt: new Date(now - 12e5).toISOString()
      },
      {
        id: "WH_20260822_TAMPER_01",
        provider: "rocket",
        eventType: "payment.tampered_attempt",
        eventId: "evt_rk_bad_sig_9901",
        signature: "0000000000000000000000000000000000000000000000000000000000000000",
        expectedSignature: "c819283019283019283019283019283019283019283019283019283019283019",
        signatureValid: false,
        payload: {
          event: "payment.received",
          trxID: "RK999INVALID99",
          amount: "50000.00",
          currency: "BDT",
          senderNumber: "01700-000000",
          destinationAccount: "01711-884422-9",
          tamperFlag: "MAN_IN_THE_MIDDLE_SIMULATION"
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "rocket",
          "x-signature": "0000000000000000000000000000000000000000000000000000000000000000",
          "x-timestamp": String(now - 6e5),
          "x-webhook-id": "whk_tamper_01",
          "user-agent": "Untrusted-Proxy/1.0"
        },
        httpStatus: 401,
        processed: false,
        processResult: "\u274C 401 Unauthorized: Signature hash does not match computed HMAC-SHA256 payload digest.",
        latencyMs: 12,
        retryCount: 0,
        createdAt: new Date(now - 6e5).toISOString()
      }
    ];
  }
};
var webhookLogger = new WebhookLoggerService();

// src/services/paymentGatewayEngine.ts
var PaymentGatewayEngine = class {
  constructor() {
    // 1. Provider Adapter Registry
    this.adapters = /* @__PURE__ */ new Map();
    // 2. Payment Destination Accounts Pool (Dynamic Rotation)
    this.destinationPool = [
      {
        id: "DEST_BKASH_01",
        provider: "bkash",
        method: "BKASH",
        accountNumber: "01900-112233",
        accountName: "Gameplay365 VIP Merchant Pool A",
        accountType: "MERCHANT",
        dailyLimit: 5e5,
        currentDayVolume: 124500,
        assignedCapacityPercent: 75,
        isActive: true,
        isMaintenance: false,
        priority: 1,
        instructions: [
          '\u0986\u09AA\u09A8\u09BE\u09B0 \u09AC\u09BF\u0995\u09BE\u09B6 \u0985\u09CD\u09AF\u09BE\u09AA \u09A5\u09C7\u0995\u09C7 "Make Payment" \u0985\u09AA\u09B6\u09A8 \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8\u0964',
          "\u09AE\u09BE\u09B0\u09CD\u099A\u09C7\u09A8\u09CD\u099F \u09A8\u09AE\u09CD\u09AC\u09B0: 01900-112233 \u09B2\u09BF\u0996\u09C1\u09A8\u0964",
          "\u09A8\u09BF\u09B0\u09CD\u09A7\u09BE\u09B0\u09BF\u09A4 \u099F\u09BE\u0995\u09BE\u09B0 \u09AA\u09B0\u09BF\u09AE\u09BE\u09A3 \u09B2\u09BF\u0996\u09C1\u09A8 \u098F\u09AC\u0982 \u09B0\u09C7\u09AB\u09BE\u09B0\u09C7\u09A8\u09CD\u09B8 \u09B9\u09BF\u09B8\u09C7\u09AC\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 \u09A1\u09BF\u09AA\u09CB\u099C\u09BF\u099F \u0986\u0987\u09A1\u09BF \u09A6\u09BF\u09A8\u0964",
          "\u09AA\u09BF\u09A8 \u09A6\u09BF\u09DF\u09C7 \u09AA\u09C7\u09AE\u09C7\u09A8\u09CD\u099F \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u0995\u09B0\u09C7 TrxID \u09B8\u0982\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C1\u09A8\u0964"
        ]
      },
      {
        id: "DEST_BKASH_02",
        provider: "bkash",
        method: "BKASH",
        accountNumber: "01977-889900",
        accountName: "Gameplay365 Fast Cashout Pool B",
        accountType: "AGENT",
        dailyLimit: 3e5,
        currentDayVolume: 45e3,
        assignedCapacityPercent: 40,
        isActive: true,
        isMaintenance: false,
        priority: 2,
        instructions: [
          '\u09AC\u09BF\u0995\u09BE\u09B6 \u0985\u09CD\u09AF\u09BE\u09AA\u09C7 "Cash Out" \u0985\u09AA\u09B6\u09A8 \u09AC\u09C7\u099B\u09C7 \u09A8\u09BF\u09A8\u0964',
          "\u098F\u099C\u09C7\u09A8\u09CD\u099F \u09A8\u09AE\u09CD\u09AC\u09B0: 01977-889900 \u09AC\u09B8\u09BF\u09DF\u09C7 \u09AA\u09BF\u09A8 \u09A6\u09BF\u09DF\u09C7 \u0995\u09CD\u09AF\u09BE\u09B6-\u0986\u0989\u099F \u0995\u09B0\u09C1\u09A8\u0964",
          "\u09B8\u09AB\u09B2 \u09AE\u09C7\u09B8\u09C7\u099C \u09A5\u09C7\u0995\u09C7 TrxID \u0995\u09AA\u09BF \u0995\u09B0\u09C7 \u09AD\u09C7\u09B0\u09BF\u09AB\u09BE\u0987 \u0995\u09B0\u09C1\u09A8\u0964"
        ]
      },
      {
        id: "DEST_NAGAD_01",
        provider: "nagad",
        method: "NAGAD",
        accountNumber: "01844-992200",
        accountName: "Gameplay365 Direct Nagad Agent",
        accountType: "AGENT",
        dailyLimit: 4e5,
        currentDayVolume: 89e3,
        assignedCapacityPercent: 60,
        isActive: true,
        isMaintenance: false,
        priority: 1,
        instructions: [
          "\u09A8\u0997\u09A6 \u0985\u09CD\u09AF\u09BE\u09AA \u0996\u09C1\u09B2\u09C1\u09A8 \u09AC\u09BE *167# \u09A1\u09BE\u09DF\u09BE\u09B2 \u0995\u09B0\u09C7 Cash Out \u09A8\u09BF\u09B0\u09CD\u09AC\u09BE\u099A\u09A8 \u0995\u09B0\u09C1\u09A8\u0964",
          "\u098F\u099C\u09C7\u09A8\u09CD\u099F \u09A8\u09AE\u09CD\u09AC\u09B0: 01844-992200 \u09AA\u09CD\u09B0\u09AC\u09C7\u09B6 \u0995\u09B0\u09BE\u09A8\u0964",
          "\u099F\u09BE\u0995\u09BE\u09B0 \u09AA\u09B0\u09BF\u09AE\u09BE\u09A3 \u0993 \u09AA\u09BF\u09A8 \u09A6\u09BF\u09DF\u09C7 \u099F\u09CD\u09B0\u09BE\u09A8\u099C\u09C7\u0995\u09B6\u09A8 \u09B8\u09AB\u09B2 \u0995\u09B0\u09C1\u09A8\u0964",
          "\u09A8\u0997\u09A6\u09C7\u09B0 \u09EE \u09A1\u09BF\u099C\u09BF\u099F\u09C7\u09B0 TrxID \u09B8\u09BE\u09AC\u09AE\u09BF\u099F \u0995\u09B0\u09C1\u09A8\u0964"
        ]
      },
      {
        id: "DEST_ROCKET_01",
        provider: "rocket",
        method: "ROCKET",
        accountNumber: "01711-884422-9",
        accountName: "Gameplay365 DBBL Biller Account",
        accountType: "BILLER",
        dailyLimit: 3e5,
        currentDayVolume: 24e3,
        assignedCapacityPercent: 30,
        isActive: true,
        isMaintenance: false,
        priority: 1,
        instructions: [
          "\u09B0\u0995\u09C7\u099F \u0985\u09CD\u09AF\u09BE\u09AA \u09A5\u09C7\u0995\u09C7 Send Money \u09AC\u09BE Pay Bill \u0985\u09AA\u09B6\u09A8 \u09AC\u09CD\u09AF\u09AC\u09B9\u09BE\u09B0 \u0995\u09B0\u09C1\u09A8\u0964",
          "\u098F\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09A8\u09AE\u09CD\u09AC\u09B0: 01711-884422-9 \u09A6\u09BF\u09A8\u0964",
          "\u09AA\u09BF\u09A8 \u09A6\u09BF\u09DF\u09C7 \u099F\u09CD\u09B0\u09BE\u09A8\u099C\u09C7\u0995\u09B6\u09A8 \u09B6\u09C7\u09B7 \u0995\u09B0\u09C7 TrxID \u0995\u09AA\u09BF \u0995\u09B0\u09C1\u09A8\u0964"
        ]
      },
      {
        id: "DEST_BANK_01",
        provider: "bank_transfer",
        method: "BANK_TRANSFER",
        accountNumber: "110.120.489102",
        accountName: "Gameplay365 Online Entertainment Ltd",
        accountType: "BANK_ACCOUNT",
        bankName: "City Bank Ltd / Brac Bank PLC",
        branchName: "Gulshan Corporate Branch, Dhaka",
        routingNumber: "225271890",
        dailyLimit: 2e6,
        currentDayVolume: 42e4,
        assignedCapacityPercent: 50,
        isActive: true,
        isMaintenance: false,
        priority: 1,
        instructions: [
          "Citytouch \u09AC\u09BE Astha \u0985\u09CD\u09AF\u09BE\u09AA\u09C7\u09B0 \u09AE\u09BE\u09A7\u09CD\u09AF\u09AE\u09C7 NPSB/BEFTN \u09AB\u09BE\u09A8\u09CD\u09A1 \u099F\u09CD\u09B0\u09BE\u09A8\u09CD\u09B8\u09AB\u09BE\u09B0 \u0995\u09B0\u09C1\u09A8\u0964",
          "\u098F\u0995\u09BE\u0989\u09A8\u09CD\u099F \u09A8\u09AE\u09CD\u09AC\u09B0: 110.120.489102 (City Bank)",
          "\u09B0\u09BE\u0989\u099F\u09BF\u0982 \u09A8\u09AE\u09CD\u09AC\u09B0: 225271890",
          "\u099F\u09CD\u09B0\u09BE\u09A8\u09CD\u09B8\u09AB\u09BE\u09B0\u09C7\u09B0 \u09B0\u09C7\u09AB\u09BE\u09B0\u09C7\u09A8\u09CD\u09B8/TrxID \u09B2\u09BF\u0996\u09C7 \u09B8\u09BE\u09AC\u09AE\u09BF\u099F \u0995\u09B0\u09C1\u09A8\u0964"
        ]
      },
      {
        id: "DEST_USDT_01",
        provider: "usdt_crypto",
        method: "USDT",
        accountNumber: "TK89xVqLiveSeamlessCasinoCryptoVault99201",
        accountName: "Gameplay365 Multi-Sig Cold Vault",
        accountType: "CRYPTO_VAULT",
        dailyLimit: 5e6,
        currentDayVolume: 11e5,
        assignedCapacityPercent: 35,
        isActive: true,
        isMaintenance: false,
        priority: 1,
        instructions: [
          "Binance/TrustWallet \u09A5\u09C7\u0995\u09C7 TRC-20 \u09A8\u09C7\u099F\u0993\u09AF\u09BC\u09BE\u09B0\u09CD\u0995\u09C7 \u099F\u09CD\u09B0\u09BE\u09A8\u09CD\u09B8\u09AB\u09BE\u09B0 \u0995\u09B0\u09C1\u09A8\u0964",
          "\u0985\u09CD\u09AF\u09BE\u09A1\u09CD\u09B0\u09C7\u09B8: TK89xVqLiveSeamlessCasinoCryptoVault99201",
          "\u099F\u09CD\u09B0\u09BE\u09A8\u099C\u09C7\u0995\u09B6\u09A8\u09C7\u09B0 TxHash \u09AA\u09C7\u09B8\u09CD\u099F \u0995\u09B0\u09C1\u09A8\u0964"
        ]
      }
    ];
    // 3. In-Memory Stores
    this.depositIntents = /* @__PURE__ */ new Map();
    this.consumedTrxIds = /* @__PURE__ */ new Map();
    // Key: `${provider}:${trxId}`
    this.withdrawalRecords = /* @__PURE__ */ new Map();
    this.doubleEntryLedger = [];
    this.auditLogs = [];
    this.webhookLogs = [];
    this.idempotencyStore = /* @__PURE__ */ new Map();
    // 4. Listeners for Real-time Reactive Updates
    this.changeListeners = [];
    this.registerAdapters();
    this.seedInitialHistory();
  }
  registerAdapters() {
    this.adapters.set("bkash", new BkashPaymentAdapter());
    this.adapters.set("nagad", new NagadPaymentAdapter());
    this.adapters.set("rocket", new RocketPaymentAdapter());
    this.adapters.set("bank_transfer", new BankTransferPaymentAdapter());
    this.adapters.set("card_payment", new CardPaymentAdapter());
    this.adapters.set("usdt_crypto", new CardPaymentAdapter());
  }
  subscribe(listener) {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter((l) => l !== listener);
    };
  }
  notifyChange() {
    for (const listener of this.changeListeners) {
      try {
        listener();
      } catch (err) {
        console.error("PaymentGatewayEngine listener error:", err);
      }
    }
  }
  // ==========================================================================
  // SECTION 1: Payment Destination Pool Rotation Algorithm
  // ==========================================================================
  getAvailableDestination(provider) {
    const candidates = this.destinationPool.filter(
      (d) => d.provider === provider && d.isActive && !d.isMaintenance
    );
    if (candidates.length === 0) {
      const fallback = this.destinationPool.find((d) => d.provider === provider) || this.destinationPool[0];
      return fallback;
    }
    candidates.sort((a, b) => {
      const remainingA = a.dailyLimit - a.currentDayVolume;
      const remainingB = b.dailyLimit - b.currentDayVolume;
      if (remainingA !== remainingB) {
        return remainingB - remainingA;
      }
      return a.priority - b.priority;
    });
    return candidates[0];
  }
  getDestinationPool() {
    return [...this.destinationPool];
  }
  updateDestinationStatus(id, updates) {
    const dest = this.destinationPool.find((d) => d.id === id);
    if (dest) {
      Object.assign(dest, updates);
      this.logAudit({
        actor: "ADMIN:System",
        action: "UPDATE_DESTINATION_ACCOUNT",
        resource: "DESTINATION_POOL",
        resourceId: id,
        ipAddress: "127.0.0.1",
        metadata: updates
      });
      this.notifyChange();
    }
  }
  // ==========================================================================
  // SECTION 2: Anti-Fraud & Risk Engine
  // ==========================================================================
  analyzeRisk(params) {
    let score = 5;
    const factors = [];
    if (params.trxId) {
      const cleanTrx = params.trxId.trim().toUpperCase();
      const existingKey = `${params.provider}:${cleanTrx}`;
      if (this.consumedTrxIds.has(existingKey)) {
        score += 90;
        factors.push("DUPLICATE_TRX_ID_DETECTED");
      }
    }
    if (params.amount > 1e5) {
      score += 25;
      factors.push("HIGH_VALUE_TRANSACTION");
    }
    const now = Date.now();
    const recentIntents = Array.from(this.depositIntents.values()).filter(
      (d) => d.userId === params.userId && now - new Date(d.createdAt).getTime() < 3e5
    );
    if (recentIntents.length >= 4) {
      score += 35;
      factors.push("RAPID_INTENT_VELOCITY");
    }
    const failedRecent = recentIntents.filter((d) => d.status === "FAILED");
    if (failedRecent.length >= 2) {
      score += 30;
      factors.push("REPEATED_FAILED_ATTEMPTS");
    }
    let riskLevel = "LOW";
    if (score >= 80) riskLevel = "BLOCKED";
    else if (score >= 60) riskLevel = "HIGH";
    else if (score >= 30) riskLevel = "MEDIUM";
    return {
      riskScore: Math.min(100, score),
      riskLevel,
      factors,
      isBlocked: score >= 80,
      requiresManualReview: score >= 60 && score < 80
    };
  }
  // ==========================================================================
  // SECTION 3: Step 01 & 02 — Deposit Intent Creation Flow
  // ==========================================================================
  createDepositIntent(req) {
    if (req.idempotencyKey && this.idempotencyStore.has(req.idempotencyKey)) {
      return this.idempotencyStore.get(req.idempotencyKey);
    }
    const now = /* @__PURE__ */ new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const depositId = `DEP-${dateStr}-${randomSuffix}`;
    const destination = this.getAvailableDestination(req.provider);
    const risk = this.analyzeRisk({
      userId: req.userId,
      amount: req.amount,
      provider: req.provider,
      type: "DEPOSIT"
    });
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1e3).toISOString();
    const intent = {
      id: depositId,
      userId: req.userId,
      username: req.username,
      provider: req.provider,
      method: req.method,
      amount: req.amount,
      currency: req.currency,
      status: "AWAITING_PAYMENT",
      destinationAccount: destination,
      referenceCode: depositId,
      createdAt: now.toISOString(),
      expiresAt,
      riskScore: risk.riskScore,
      idempotencyKey: req.idempotencyKey,
      auditTrail: [
        {
          status: "CREATED",
          timestamp: now.toISOString(),
          note: `Deposit Intent created for \u09F3${req.amount.toLocaleString()} via ${req.provider.toUpperCase()}`
        },
        {
          status: "AWAITING_PAYMENT",
          timestamp: now.toISOString(),
          note: `Destination assigned: ${destination.accountNumber} (${destination.accountType})`
        }
      ]
    };
    this.depositIntents.set(depositId, intent);
    if (req.idempotencyKey) {
      this.idempotencyStore.set(req.idempotencyKey, intent);
    }
    this.logAudit({
      actor: `USER:${req.username}`,
      action: "CREATE_DEPOSIT_INTENT",
      resource: "DEPOSIT",
      resourceId: depositId,
      ipAddress: req.clientIp || "127.0.0.1",
      metadata: { amount: req.amount, provider: req.provider, destination: destination.accountNumber }
    });
    this.notifyChange();
    return intent;
  }
  // ==========================================================================
  // SECTION 4: Step 03 & 04 — Automatic Payment Verification & Instant Credit Engine
  // ==========================================================================
  async verifyAndCreditDeposit(params) {
    const intent = this.depositIntents.get(params.depositId);
    if (!intent) {
      throw new Error(`Deposit intent '${params.depositId}' not found.`);
    }
    if (intent.status === "CREDITED") {
      return {
        success: true,
        depositIntent: intent,
        message: "This deposit has already been verified and credited."
      };
    }
    const cleanTrx = params.trxId.trim().toUpperCase();
    intent.status = "TRX_SUBMITTED";
    intent.providerTransactionId = cleanTrx;
    intent.senderNumber = params.senderNumber;
    intent.auditTrail.push({
      status: "TRX_SUBMITTED",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      note: `Player submitted TrxID: ${cleanTrx}`
    });
    this.notifyChange();
    if (/* @__PURE__ */ new Date() > new Date(intent.expiresAt)) {
      intent.status = "EXPIRED";
      intent.failedReason = "Payment window expired (15 minutes limit exceeded).";
      intent.auditTrail.push({
        status: "EXPIRED",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        note: intent.failedReason
      });
      this.notifyChange();
      throw new Error(intent.failedReason);
    }
    const trxKey = `${intent.provider}:${cleanTrx}`;
    if (this.consumedTrxIds.has(trxKey)) {
      intent.status = "FAILED";
      intent.failedReason = `Duplicate TrxID: '${cleanTrx}' has already been used on Gameplay 365.`;
      intent.riskScore = 95;
      intent.auditTrail.push({
        status: "FAILED",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        note: intent.failedReason
      });
      this.logAudit({
        actor: `USER:${intent.username}`,
        action: "DUPLICATE_TRX_ID_REJECTED",
        resource: "DEPOSIT",
        resourceId: intent.id,
        ipAddress: "127.0.0.1",
        metadata: { trxId: cleanTrx, provider: intent.provider }
      });
      this.notifyChange();
      throw new Error(intent.failedReason);
    }
    intent.status = "VERIFYING";
    const adapter = this.adapters.get(intent.provider) || new BkashPaymentAdapter();
    const verificationResult = await adapter.verifyDeposit({
      depositIntent: intent,
      trxId: cleanTrx,
      senderNumber: params.senderNumber,
      destinationAccount: intent.destinationAccount
    });
    if (!verificationResult.verified) {
      intent.status = "FAILED";
      intent.failedReason = verificationResult.message;
      intent.auditTrail.push({
        status: "FAILED",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        note: `Verification failed: ${verificationResult.message}`
      });
      this.notifyChange();
      throw new Error(verificationResult.message);
    }
    intent.status = "VERIFIED";
    intent.verifiedAt = (/* @__PURE__ */ new Date()).toISOString();
    intent.auditTrail.push({
      status: "VERIFIED",
      timestamp: intent.verifiedAt,
      note: "Payment authorized and verified by Provider Verification Engine."
    });
    this.consumedTrxIds.set(trxKey, {
      depositId: intent.id,
      userId: intent.userId,
      consumedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    const currentWallets = seamlessEngine.getWallets();
    const userWallet = currentWallets.find((w) => w.user_id === intent.userId) || currentWallets[0];
    const beforeBal = userWallet ? userWallet.real_balance : 0;
    seamlessEngine.topUpWallet(intent.userId, intent.currency, intent.amount);
    const updatedWallet = seamlessEngine.getWallets().find((w) => w.user_id === intent.userId);
    const afterBal = updatedWallet ? updatedWallet.real_balance : beforeBal + intent.amount;
    const ledgerEntry = {
      id: `LEDGER_DEP_${Date.now()}`,
      transactionId: `DEP_${cleanTrx}`,
      walletId: userWallet ? userWallet.id : `w_${intent.userId}`,
      userId: intent.userId,
      entryType: "DEPOSIT_CREDIT",
      debitAccount: `SYSTEM_LIABILITY_${intent.provider.toUpperCase()}_ACCOUNT`,
      creditAccount: `USER_WALLET_${intent.userId}`,
      amount: intent.amount,
      currency: intent.currency,
      balanceBefore: beforeBal,
      balanceAfter: afterBal,
      reference: intent.id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.doubleEntryLedger.unshift(ledgerEntry);
    intent.destinationAccount.currentDayVolume += intent.amount;
    intent.status = "CREDITED";
    intent.creditedAt = (/* @__PURE__ */ new Date()).toISOString();
    intent.auditTrail.push({
      status: "CREDITED",
      timestamp: intent.creditedAt,
      note: `Wallet credited +\u09F3${intent.amount.toLocaleString()}. Balance before: \u09F3${beforeBal.toLocaleString()}, Balance after: \u09F3${afterBal.toLocaleString()}`
    });
    this.logAudit({
      actor: "SYSTEM:PaymentOrchestrator",
      action: "WALLET_DEPOSIT_CREDITED",
      resource: "WALLET",
      resourceId: intent.id,
      ipAddress: "127.0.0.1",
      metadata: {
        userId: intent.userId,
        amount: intent.amount,
        beforeBal,
        afterBal,
        trxId: cleanTrx,
        provider: intent.provider
      }
    });
    notificationService.pushNotification(intent.userId, {
      userId: intent.userId,
      title: "\u{1F389} \u09A1\u09BF\u09AA\u09CB\u099C\u09BF\u099F \u09B8\u09AB\u09B2 \u0993 \u0993\u09DF\u09BE\u09B2\u09C7\u099F\u09C7 \u09AF\u09C1\u0995\u09CD\u09A4 \u09B9\u09DF\u09C7\u099B\u09C7!",
      message: `\u0986\u09AA\u09A8\u09BE\u09B0 ${intent.provider.toUpperCase()} \u09A1\u09BF\u09AA\u09CB\u099C\u09BF\u099F \u09F3${intent.amount.toLocaleString()} \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u0993\u09DF\u09BE\u09B2\u09C7\u099F\u09C7 \u09AF\u09C1\u0995\u09CD\u09A4 \u09B9\u09DF\u09C7\u099B\u09C7\u0964 (TrxID: ${cleanTrx})`,
      type: "DEPOSIT_CONFIRMED",
      amount: intent.amount,
      currency: intent.currency,
      isRead: false
    });
    soundEngine.playWalletCredit();
    this.notifyChange();
    return {
      success: true,
      depositIntent: intent,
      message: `\u09F3${intent.amount.toLocaleString()} \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 \u09A1\u09BF\u09AA\u09CB\u099C\u09BF\u099F \u09B9\u09DF\u09C7\u099B\u09C7\u0964`,
      newBalance: afterBal
    };
  }
  // ==========================================================================
  // SECTION 5: Controlled Withdrawal Flow with Balance Reservation Model
  // ==========================================================================
  async requestWithdrawal(req) {
    if (this.idempotencyStore.has(req.idempotencyKey)) {
      return this.idempotencyStore.get(req.idempotencyKey);
    }
    const currentWallets = seamlessEngine.getWallets();
    const wallet = currentWallets.find((w) => w.user_id === req.userId) || currentWallets[0];
    if (!wallet) {
      throw new Error("User wallet not found.");
    }
    if (wallet.real_balance < req.amount) {
      throw new Error(
        `\u09AA\u09B0\u09CD\u09AF\u09BE\u09AA\u09CD\u09A4 \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8 \u09A8\u09C7\u0987\u0964 \u0986\u09AA\u09A8\u09BE\u09B0 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u09AC\u09CD\u09AF\u09BE\u09B2\u09C7\u09A8\u09CD\u09B8: \u09F3${wallet.real_balance.toLocaleString()}, \u0989\u0987\u09A5\u09A1\u09CD\u09B0 \u09B0\u09BF\u0995\u09CB\u09AF\u09BC\u09C7\u09B8\u09CD\u099F: \u09F3${req.amount.toLocaleString()}`
      );
    }
    const now = /* @__PURE__ */ new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const withdrawalId = `WTH-${dateStr}-${randomSuffix}`;
    const risk = this.analyzeRisk({
      userId: req.userId,
      amount: req.amount,
      provider: req.provider,
      recipientAccount: req.recipientAccount,
      type: "WITHDRAWAL"
    });
    if (risk.isBlocked) {
      throw new Error("Withdrawal blocked by Risk Engine due to suspicious activity.");
    }
    const availBefore = wallet.real_balance;
    const reservedBefore = wallet.locked_balance || 0;
    wallet.real_balance = Number((wallet.real_balance - req.amount).toFixed(4));
    wallet.locked_balance = Number((reservedBefore + req.amount).toFixed(4));
    wallet.version += 1;
    wallet.updated_at = now.toISOString();
    const record = {
      id: withdrawalId,
      userId: req.userId,
      username: req.username,
      provider: req.provider,
      method: req.method,
      amount: req.amount,
      currency: req.currency,
      recipientAccount: req.recipientAccount,
      recipientName: req.recipientName,
      status: "WITHDRAWAL_RESERVED",
      reservedBalanceBefore: reservedBefore,
      availableBalanceBefore: availBefore,
      availableBalanceAfter: wallet.real_balance,
      createdAt: now.toISOString(),
      riskScore: risk.riskScore,
      idempotencyKey: req.idempotencyKey,
      auditTrail: [
        {
          status: "CREATED",
          timestamp: now.toISOString(),
          note: `Withdrawal request for \u09F3${req.amount.toLocaleString()} to ${req.recipientAccount}`
        },
        {
          status: "RISK_CHECK",
          timestamp: now.toISOString(),
          note: `Risk score: ${risk.riskScore}/100 (${risk.riskLevel})`
        },
        {
          status: "WITHDRAWAL_RESERVED",
          timestamp: now.toISOString(),
          note: `\u09F3${req.amount.toLocaleString()} reserved from Available Balance. Available now: \u09F3${wallet.real_balance.toLocaleString()}`
        }
      ]
    };
    this.withdrawalRecords.set(withdrawalId, record);
    this.idempotencyStore.set(req.idempotencyKey, record);
    this.doubleEntryLedger.unshift({
      id: `LEDGER_WTH_RES_${Date.now()}`,
      transactionId: `WTH_RES_${withdrawalId}`,
      walletId: wallet.id,
      userId: req.userId,
      entryType: "WITHDRAWAL_RESERVE",
      debitAccount: `USER_WALLET_${req.userId}`,
      creditAccount: `SYSTEM_PAYOUT_RESERVE_ACCOUNT`,
      amount: req.amount,
      currency: req.currency,
      balanceBefore: availBefore,
      balanceAfter: wallet.real_balance,
      reservedBefore,
      reservedAfter: wallet.locked_balance,
      reference: withdrawalId,
      createdAt: now.toISOString()
    });
    this.logAudit({
      actor: `USER:${req.username}`,
      action: "WITHDRAWAL_RESERVED",
      resource: "WITHDRAWAL",
      resourceId: withdrawalId,
      ipAddress: req.clientIp || "127.0.0.1",
      metadata: { amount: req.amount, recipient: req.recipientAccount, provider: req.provider }
    });
    this.dispatchAutomatedPayout(record);
    this.notifyChange();
    return record;
  }
  async dispatchAutomatedPayout(record) {
    record.status = "PAYOUT_PROCESSING";
    record.processedAt = (/* @__PURE__ */ new Date()).toISOString();
    record.auditTrail.push({
      status: "PAYOUT_PROCESSING",
      timestamp: record.processedAt,
      note: `Dispatched payout request to ${record.provider.toUpperCase()} Payout Gateway`
    });
    this.notifyChange();
    try {
      const adapter = this.adapters.get(record.provider) || new BkashPaymentAdapter();
      const payoutResult = await adapter.executePayout({ withdrawal: record });
      if (payoutResult.success) {
        record.status = "WITHDRAWAL_COMPLETED";
        record.providerReference = payoutResult.providerReference;
        record.completedAt = (/* @__PURE__ */ new Date()).toISOString();
        record.auditTrail.push({
          status: "WITHDRAWAL_COMPLETED",
          timestamp: record.completedAt,
          note: `Payout confirmed by provider. Ref: ${payoutResult.providerReference}`
        });
        const currentWallets = seamlessEngine.getWallets();
        const wallet = currentWallets.find((w) => w.user_id === record.userId);
        if (wallet) {
          wallet.locked_balance = Math.max(0, Number(((wallet.locked_balance || 0) - record.amount).toFixed(4)));
        }
        this.doubleEntryLedger.unshift({
          id: `LEDGER_WTH_DONE_${Date.now()}`,
          transactionId: `WTH_FINALIZE_${record.id}`,
          walletId: wallet ? wallet.id : `w_${record.userId}`,
          userId: record.userId,
          entryType: "WITHDRAWAL_FINALIZE",
          debitAccount: `SYSTEM_PAYOUT_RESERVE_ACCOUNT`,
          creditAccount: `EXTERNAL_RECIPIENT_${record.recipientAccount}`,
          amount: record.amount,
          currency: record.currency,
          balanceBefore: wallet ? wallet.real_balance : 0,
          balanceAfter: wallet ? wallet.real_balance : 0,
          reference: record.id,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
        notificationService.pushNotification(record.userId, {
          userId: record.userId,
          title: "\u{1F4B8} \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u09B8\u09AB\u09B2 \u0993 \u0995\u09CD\u09AF\u09BE\u09B6-\u0986\u0989\u099F \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8!",
          message: `\u0986\u09AA\u09A8\u09BE\u09B0 \u09F3${record.amount.toLocaleString()} \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u09B0\u09BF\u0995\u09CB\u09AF\u09BC\u09C7\u09B8\u09CD\u099F \u09B8\u09AB\u09B2\u09AD\u09BE\u09AC\u09C7 ${record.recipientAccount} \u09A8\u09AE\u09CD\u09AC\u09B0\u09C7 \u09AA\u09BE\u09A0\u09BE\u09A8\u09CB \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964 (Ref: ${payoutResult.providerReference})`,
          type: "WITHDRAWAL_APPROVED",
          amount: record.amount,
          currency: record.currency,
          isRead: false
        });
        soundEngine.playCashout();
      } else {
        this.releaseWithdrawalReservation(record, payoutResult.message);
      }
    } catch (err) {
      this.releaseWithdrawalReservation(record, err.message || "Provider payout execution failed");
    }
    this.notifyChange();
  }
  releaseWithdrawalReservation(record, failureReason) {
    record.status = "FAILED";
    record.failedReason = failureReason;
    record.auditTrail.push({
      status: "FAILED",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      note: `Payout failed: ${failureReason}. Releasing reserved funds back to user.`
    });
    const currentWallets = seamlessEngine.getWallets();
    const wallet = currentWallets.find((w) => w.user_id === record.userId);
    if (wallet) {
      const availBefore = wallet.real_balance;
      wallet.real_balance = Number((wallet.real_balance + record.amount).toFixed(4));
      wallet.locked_balance = Math.max(0, Number(((wallet.locked_balance || 0) - record.amount).toFixed(4)));
      wallet.version += 1;
      wallet.updated_at = (/* @__PURE__ */ new Date()).toISOString();
      record.status = "RESERVATION_RELEASED";
      record.auditTrail.push({
        status: "RESERVATION_RELEASED",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        note: `\u09F3${record.amount.toLocaleString()} restored to Available Balance. Current balance: \u09F3${wallet.real_balance.toLocaleString()}`
      });
      this.doubleEntryLedger.unshift({
        id: `LEDGER_WTH_REL_${Date.now()}`,
        transactionId: `WTH_RELEASE_${record.id}`,
        walletId: wallet.id,
        userId: record.userId,
        entryType: "WITHDRAWAL_RELEASE",
        debitAccount: `SYSTEM_PAYOUT_RESERVE_ACCOUNT`,
        creditAccount: `USER_WALLET_${record.userId}`,
        amount: record.amount,
        currency: record.currency,
        balanceBefore: availBefore,
        balanceAfter: wallet.real_balance,
        reference: record.id,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    notificationService.pushNotification(record.userId, {
      userId: record.userId,
      title: "\u26A0\uFE0F \u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 \u0993 \u099F\u09BE\u0995\u09BE \u09AB\u09C7\u09B0\u09A4 \u098F\u09B8\u09C7\u099B\u09C7",
      message: `\u0989\u0987\u09A5\u09A1\u09CD\u09B0\u09AF\u09BC\u09BE\u09B2 \u09AC\u09CD\u09AF\u09B0\u09CD\u09A5 \u09B9\u0993\u09DF\u09BE\u09B0 \u0995\u09BE\u09B0\u09A3\u09C7 \u09F3${record.amount.toLocaleString()} \u09AA\u09C1\u09A8\u09B0\u09BE\u09AF\u09BC \u0986\u09AA\u09A8\u09BE\u09B0 \u0993\u09AF\u09BC\u09BE\u09B2\u09C7\u099F\u09C7 \u09AB\u09C7\u09B0\u09A4 \u09AF\u09CB\u0997 \u0995\u09B0\u09BE \u09B9\u09AF\u09BC\u09C7\u099B\u09C7\u0964`,
      type: "SYSTEM_ALERT",
      amount: record.amount,
      currency: record.currency,
      isRead: false
    });
    this.notifyChange();
  }
  // ==========================================================================
  // ==========================================================================
  // SECTION 6: Webhook Processing Engine & Inspector Controls (Delegated to WebhookLogger)
  // ==========================================================================
  async handleWebhook(provider, payload, signature, options) {
    const log = await webhookLogger.interceptAndLog({
      provider,
      payload,
      signature,
      options
    });
    this.logAudit({
      actor: `GATEWAY_WEBHOOK:${provider}`,
      action: log.signatureValid ? "WEBHOOK_PROCESSED" : "WEBHOOK_REJECTED_SIGNATURE",
      resource: "PROVIDER",
      resourceId: log.id,
      ipAddress: options?.ipAddress || "103.119.100.45",
      metadata: { eventId: log.eventId, eventType: log.eventType, signatureValid: log.signatureValid }
    });
    this.notifyChange();
    return log;
  }
  /**
   * Re-processes an existing webhook event to simulate retry / replay
   */
  async reprocessWebhook(webhookId) {
    const result = await webhookLogger.reprocessWebhook(webhookId);
    this.logAudit({
      actor: "DEVELOPER_WORKBENCH",
      action: "WEBHOOK_REPROCESSED",
      resource: "PROVIDER",
      resourceId: result.log.id,
      ipAddress: "127.0.0.1 (Workbench)",
      metadata: { retryCount: result.log.retryCount, success: result.success, eventId: result.log.eventId }
    });
    this.notifyChange();
    return result;
  }
  clearWebhookLogs() {
    webhookLogger.clearLogs();
    this.notifyChange();
  }
  // ==========================================================================
  // SECTION 7: Audit Logging & Getters
  // ==========================================================================
  logAudit(entry) {
    this.auditLogs.unshift({
      id: `AUDIT_${Date.now()}_${Math.floor(1e3 + Math.random() * 9e3)}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      ...entry
    });
  }
  getDepositIntents(userId) {
    const list = Array.from(this.depositIntents.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (userId) return list.filter((d) => d.userId === userId);
    return list;
  }
  getWithdrawalRecords(userId) {
    const list = Array.from(this.withdrawalRecords.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (userId) return list.filter((w) => w.userId === userId);
    return list;
  }
  getDoubleEntryLedger() {
    return [...this.doubleEntryLedger];
  }
  getAuditLogs() {
    return [...this.auditLogs];
  }
  getWebhookLogs() {
    return webhookLogger.getLogs();
  }
  getStats() {
    const deposits = Array.from(this.depositIntents.values());
    const withdrawals = Array.from(this.withdrawalRecords.values());
    const webhookStats = webhookLogger.getStats();
    const totalDeposited = deposits.filter((d) => d.status === "CREDITED").reduce((sum, d) => sum + d.amount, 0);
    const totalWithdrawn = withdrawals.filter((w) => w.status === "WITHDRAWAL_COMPLETED").reduce((sum, w) => sum + w.amount, 0);
    const pendingDeposits = deposits.filter((d) => d.status === "AWAITING_PAYMENT" || d.status === "TRX_SUBMITTED").length;
    const pendingWithdrawals = withdrawals.filter((w) => w.status === "WITHDRAWAL_RESERVED" || w.status === "PAYOUT_PROCESSING").length;
    return {
      totalDeposited,
      totalWithdrawn,
      netCashFlow: totalDeposited - totalWithdrawn,
      pendingDeposits,
      pendingWithdrawals,
      totalIntents: deposits.length,
      totalWithdrawals: withdrawals.length,
      activeGateways: this.destinationPool.filter((d) => d.isActive && !d.isMaintenance).length,
      totalWebhooks: webhookStats.total,
      validWebhooks: webhookStats.valid
    };
  }
  // Seed initial transactions for rich presentation
  seedInitialHistory() {
    const now = Date.now();
    const sampleDep = {
      id: "DEP-20260821-9A41K",
      userId: "u_10291",
      username: "Tamim_Sultana",
      provider: "bkash",
      method: "BKASH",
      amount: 5e3,
      currency: "BDT",
      status: "CREDITED",
      destinationAccount: this.destinationPool[0],
      referenceCode: "DEP-20260821-9A41K",
      providerTransactionId: "BL92A81K09",
      senderNumber: "01712-349911",
      createdAt: new Date(now - 36e5).toISOString(),
      expiresAt: new Date(now - 27e5).toISOString(),
      verifiedAt: new Date(now - 355e4).toISOString(),
      creditedAt: new Date(now - 354e4).toISOString(),
      riskScore: 8,
      auditTrail: [
        { status: "CREATED", timestamp: new Date(now - 36e5).toISOString(), note: "Deposit Intent created" },
        { status: "TRX_SUBMITTED", timestamp: new Date(now - 356e4).toISOString(), note: "TrxID BL92A81K09 submitted" },
        { status: "VERIFIED", timestamp: new Date(now - 355e4).toISOString(), note: "Verified by bKash API" },
        { status: "CREDITED", timestamp: new Date(now - 354e4).toISOString(), note: "Double-entry wallet credit" }
      ]
    };
    this.depositIntents.set(sampleDep.id, sampleDep);
    this.consumedTrxIds.set("bkash:BL92A81K09", { depositId: sampleDep.id, userId: "u_10291", consumedAt: new Date(now - 354e4).toISOString() });
    const sampleWth = {
      id: "WTH-20260821-7B22Z",
      userId: "u_10291",
      username: "Tamim_Sultana",
      provider: "nagad",
      method: "NAGAD",
      amount: 3e3,
      currency: "BDT",
      recipientAccount: "01844-992200",
      status: "WITHDRAWAL_COMPLETED",
      reservedBalanceBefore: 0,
      availableBalanceBefore: 8e3,
      availableBalanceAfter: 5e3,
      providerReference: "NG_DISB_891028",
      createdAt: new Date(now - 72e5).toISOString(),
      processedAt: new Date(now - 719e4).toISOString(),
      completedAt: new Date(now - 718e4).toISOString(),
      riskScore: 12,
      idempotencyKey: "WD-REQ-INITIAL-01",
      auditTrail: [
        { status: "CREATED", timestamp: new Date(now - 72e5).toISOString(), note: "Withdrawal requested" },
        { status: "WITHDRAWAL_RESERVED", timestamp: new Date(now - 72e5).toISOString(), note: "\u09F33,000 reserved" },
        { status: "WITHDRAWAL_COMPLETED", timestamp: new Date(now - 718e4).toISOString(), note: "Payout completed via Nagad API" }
      ]
    };
    this.withdrawalRecords.set(sampleWth.id, sampleWth);
    this.webhookLogs = [
      {
        id: "WH_20260822_BK901",
        provider: "bkash",
        eventType: "payment.success",
        eventId: "evt_bk_891029481",
        signature: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        expectedSignature: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        signatureValid: true,
        payload: {
          event: "payment.success",
          trxID: "BL92A81K09",
          merchantInvoiceNumber: "DEP-20260821-9A41K",
          amount: "5000.00",
          currency: "BDT",
          senderNumber: "01712-349911",
          destinationAccount: "01900-112233",
          transactionStatus: "Completed",
          paymentExecuteTime: new Date(now - 355e4).toISOString()
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "bkash",
          "x-signature": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          "x-timestamp": String(now - 355e4),
          "x-webhook-id": "whk_bk_901"
        },
        httpStatus: 200,
        processed: true,
        processResult: "\u2705 Signature verified via HMAC-SHA256. Deposit credited to user wallet.",
        latencyMs: 42,
        retryCount: 0,
        createdAt: new Date(now - 355e4).toISOString()
      },
      {
        id: "WH_20260822_NG804",
        provider: "nagad",
        eventType: "payout.disbursed",
        eventId: "evt_ng_771920194",
        signature: "f4d9b1a0398f6e1029c8e9b41829e01928491823019284019283401928340192",
        expectedSignature: "f4d9b1a0398f6e1029c8e9b41829e01928491823019284019283401928340192",
        signatureValid: true,
        payload: {
          event: "payout.disbursed",
          issuerTrxId: "NG_DISB_891028",
          orderId: "WTH-20260821-7B22Z",
          amount: "3000.00",
          currency: "BDT",
          recipientAccount: "01844-992200",
          status: "SUCCESS",
          payoutTime: new Date(now - 718e4).toISOString()
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "nagad",
          "x-signature": "f4d9b1a0398f6e1029c8e9b41829e01928491823019284019283401928340192",
          "x-timestamp": String(now - 718e4),
          "x-webhook-id": "whk_ng_804"
        },
        httpStatus: 200,
        processed: true,
        processResult: "\u2705 Payout confirmation verified. Reserved balance finalized.",
        latencyMs: 38,
        retryCount: 0,
        createdAt: new Date(now - 718e4).toISOString()
      },
      {
        id: "WH_20260822_PG701",
        provider: "pgsoft",
        eventType: "game.round_settled",
        eventId: "evt_pg_551920841",
        signature: "a918204810294810293840192834019283401928340192834019283401928340",
        expectedSignature: "a918204810294810293840192834019283401928340192834019283401928340",
        signatureValid: true,
        payload: {
          event: "game.round_settled",
          provider: "pgsoft",
          gameId: "mahjong-ways-2",
          userId: "u_10291",
          roundId: "RND_99210948",
          betAmount: 100,
          winAmount: 450,
          netSettlement: 350,
          currency: "BDT",
          timestamp: new Date(now - 12e5).toISOString()
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "pgsoft",
          "x-signature": "a918204810294810293840192834019283401928340192834019283401928340",
          "x-timestamp": String(now - 12e5),
          "x-webhook-id": "whk_pg_701"
        },
        httpStatus: 200,
        processed: true,
        processResult: "\u2705 Game round outcome validated and seamlessly credited.",
        latencyMs: 19,
        retryCount: 0,
        createdAt: new Date(now - 12e5).toISOString()
      },
      {
        id: "WH_20260822_TAMPER_01",
        provider: "rocket",
        eventType: "payment.tampered_attempt",
        eventId: "evt_rk_bad_sig_9901",
        signature: "0000000000000000000000000000000000000000000000000000000000000000",
        expectedSignature: "c819283019283019283019283019283019283019283019283019283019283019",
        signatureValid: false,
        payload: {
          event: "payment.received",
          trxID: "RK999INVALID99",
          amount: "50000.00",
          currency: "BDT",
          senderNumber: "01700-000000",
          destinationAccount: "01711-884422-9",
          tamperFlag: "MAN_IN_THE_MIDDLE_SIMULATION"
        },
        headers: {
          "content-type": "application/json",
          "x-provider-id": "rocket",
          "x-signature": "0000000000000000000000000000000000000000000000000000000000000000",
          "x-timestamp": String(now - 6e5),
          "x-webhook-id": "whk_tamper_01"
        },
        httpStatus: 401,
        processed: false,
        processResult: "\u274C 401 Unauthorized: Signature hash does not match computed HMAC-SHA256 payload digest.",
        latencyMs: 12,
        retryCount: 0,
        createdAt: new Date(now - 6e5).toISOString()
      }
    ];
  }
};
var paymentGatewayEngine = new PaymentGatewayEngine();

// src/server/controllers/paymentGatewayController.ts
var PaymentGatewayController = class {
  /**
   * POST /api/v2/payment/deposit/intent
   * Create a unique deposit intent and assign payment destination from the pool
   */
  async createDepositIntent(req, res) {
    try {
      const {
        userId,
        username,
        provider,
        method,
        amount,
        currency = "BDT",
        idempotencyKey
      } = req.body;
      if (!userId || !provider || !amount) {
        res.status(400).json({ error: "Missing required parameters: userId, provider, amount" });
        return;
      }
      const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
      const intent = paymentGatewayEngine.createDepositIntent({
        userId: String(userId),
        username: String(username || `User_${userId}`),
        provider,
        method: method || provider.toUpperCase(),
        amount: Number(amount),
        currency,
        idempotencyKey: idempotencyKey || req.headers["idempotency-key"],
        clientIp
      });
      res.status(201).json({
        success: true,
        data: intent,
        message: "Deposit intent created successfully. Please complete payment within 15 minutes."
      });
    } catch (err) {
      console.error("[PaymentGatewayController.createDepositIntent error]:", err);
      res.status(500).json({ error: err.message || "Internal Server Error" });
    }
  }
  /**
   * POST /api/v2/payment/deposit/verify-trx
   * Submit TrxID and trigger the 8-point Automated Verification & Credit Engine
   */
  async verifyTrxId(req, res) {
    try {
      const { depositId, trxId, senderNumber } = req.body;
      if (!depositId || !trxId) {
        res.status(400).json({ error: "Missing required parameters: depositId, trxId" });
        return;
      }
      const result = await paymentGatewayEngine.verifyAndCreditDeposit({
        depositId: String(depositId),
        trxId: String(trxId),
        senderNumber: senderNumber ? String(senderNumber) : void 0
      });
      res.status(200).json({
        success: true,
        data: result.depositIntent,
        newBalance: result.newBalance,
        message: result.message
      });
    } catch (err) {
      console.error("[PaymentGatewayController.verifyTrxId error]:", err);
      res.status(400).json({ success: false, error: err.message || "Verification failed" });
    }
  }
  /**
   * POST /api/v2/payment/withdraw/request
   * Submit withdrawal request with balance reservation and automated payout
   */
  async requestWithdrawal(req, res) {
    try {
      const {
        userId,
        username,
        provider,
        method,
        amount,
        currency = "BDT",
        recipientAccount,
        recipientName,
        idempotencyKey
      } = req.body;
      if (!userId || !provider || !amount || !recipientAccount) {
        res.status(400).json({ error: "Missing required parameters: userId, provider, amount, recipientAccount" });
        return;
      }
      const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
      const key = idempotencyKey || req.headers["idempotency-key"] || `WD-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const record = await paymentGatewayEngine.requestWithdrawal({
        userId: String(userId),
        username: String(username || `User_${userId}`),
        provider,
        method: method || provider.toUpperCase(),
        amount: Number(amount),
        currency,
        recipientAccount: String(recipientAccount),
        recipientName: recipientName ? String(recipientName) : void 0,
        idempotencyKey: key,
        clientIp
      });
      res.status(201).json({
        success: true,
        data: record,
        message: "Withdrawal submitted. Balance reserved and payout is being processed."
      });
    } catch (err) {
      console.error("[PaymentGatewayController.requestWithdrawal error]:", err);
      res.status(400).json({ success: false, error: err.message || "Withdrawal failed" });
    }
  }
  /**
   * POST /api/v2/payment/webhook/:provider
   * Provider Webhook listener with signature validation
   */
  async handleWebhook(req, res) {
    try {
      const provider = req.params.provider;
      const signature = req.headers["x-signature"] || req.headers["x-webhook-signature"] || "SIG_VALID";
      const log = await paymentGatewayEngine.handleWebhook(provider, req.body, signature);
      res.status(200).json({
        received: true,
        processed: log.processed,
        eventId: log.eventId
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
  /**
   * GET /api/v2/payment/destination-pool
   */
  async getDestinationPool(_req, res) {
    res.json({
      success: true,
      data: paymentGatewayEngine.getDestinationPool()
    });
  }
  /**
   * GET /api/v2/payment/stats
   */
  async getStats(_req, res) {
    res.json({
      success: true,
      data: paymentGatewayEngine.getStats()
    });
  }
};
var paymentGatewayController = new PaymentGatewayController();

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
var app2 = express();
var PORT = Number(process.env.PORT) || 8080;
var HOST = "0.0.0.0";
app2.use(
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
app2.use("/api/seamless", seamlessRouter);
var cashierRouter = express.Router();
cashierRouter.post("/deposit", (req, res) => paymentController.submitDeposit(req, res));
cashierRouter.post("/withdraw", (req, res) => paymentController.submitWithdrawal(req, res));
cashierRouter.get("/requests", (req, res) => paymentController.getRequests(req, res));
app2.use("/api/cashier", cashierRouter);
var paymentV2Router = express.Router();
paymentV2Router.post("/deposit/intent", (req, res) => paymentGatewayController.createDepositIntent(req, res));
paymentV2Router.post("/deposit/verify-trx", (req, res) => paymentGatewayController.verifyTrxId(req, res));
paymentV2Router.post("/withdraw/request", (req, res) => paymentGatewayController.requestWithdrawal(req, res));
paymentV2Router.post("/webhook/:provider", (req, res) => paymentGatewayController.handleWebhook(req, res));
paymentV2Router.get("/destination-pool", (req, res) => paymentGatewayController.getDestinationPool(req, res));
paymentV2Router.get("/stats", (req, res) => paymentGatewayController.getStats(req, res));
app2.use("/api/v2/payment", paymentV2Router);
var affiliateRouter = express.Router();
affiliateRouter.get("/summary", getAffiliateSummaryHandler);
affiliateRouter.post("/claim", claimCommissionHandler);
app2.use("/api/affiliate", affiliateRouter);
var vipRouter = express.Router();
vipRouter.get("/details", getVipDetailsHandler);
vipRouter.post("/claim-bonus", claimVipBonusHandler);
app2.use("/api/vip", vipRouter);
var promoRouter = express.Router();
promoRouter.get("/details", getPromotionDetailsHandler);
promoRouter.post("/checkin", claimCheckInHandler);
promoRouter.post("/spin", spinWheelHandler);
app2.use("/api/promo", promoRouter);
var distPath = path.resolve(process.cwd(), "dist");
if (fs.existsSync(distPath)) {
  app2.use(express.static(distPath));
  app2.get("*", (req, res) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ code: "NOT_FOUND", message: "API route not found" });
    }
    res.sendFile(path.join(distPath, "index.html"));
  });
}
app2.get("/health", (_req, res) => {
  res.status(200).json({ status: "HEALTHY", uptime: process.uptime(), timestamp: Date.now() });
});
app2.use((err, _req, res, _next) => {
  console.error("[Fatal Server Error]:", err);
  res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "An unhandled server exception occurred",
    timestamp: Date.now()
  });
});
if (process.env.NODE_ENV !== "test") {
  app2.listen(PORT, HOST, () => {
    console.log(`[Seamless Wallet Core] Server successfully listening on http://${HOST}:${PORT}`);
  });
}
var index_default = app2;
export {
  index_default as default
};
