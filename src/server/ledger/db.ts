/**
 * @file db.ts
 * @description Parameterized Database Client and In-Memory ACID Transactional Engine for testing/local verification.
 * 
 * [SECURITY RULE]:
 * - Parameterized SQL queries only ($1, $2, etc.).
 * - Enforces transactional isolation and atomic rollback on failures.
 * - Supports PostgreSQL row-level locking semantics (SELECT ... FOR UPDATE).
 */

import { maskSensitiveData } from '../gateway/masking';

export interface IDbResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface ILedgerDbClient {
  query<T = any>(sql: string, params?: any[]): Promise<IDbResult<T>>;
  release(): void | Promise<void>;
}

export interface ILedgerDbPool {
  connect(): Promise<ILedgerDbClient>;
  query<T = any>(sql: string, params?: any[]): Promise<IDbResult<T>>;
}

/**
 * In-Memory ACID Ledger Database Engine for standalone testing and mock verification.
 * Simulates PostgreSQL row-level locks (SELECT ... FOR UPDATE), transactions (BEGIN/COMMIT/ROLLBACK),
 * table constraints, and unique indices with complete parameterization.
 */
export class InMemoryPostgresLedgerEngine implements ILedgerDbPool {
  private users: Map<string, any> = new Map();
  private wallets: Map<string, any> = new Map(); // key: `${userId}:${currency}`
  private ledgerEntries: Map<string, any> = new Map(); // key: id
  private idempotencyRecords: Map<string, any> = new Map(); // key: idempotencyKey
  private walletLocks: Map<string, Promise<void>> = new Map(); // Mutex per wallet for row locks
  private lockResolvers: Map<string, () => void> = new Map();

  constructor() {
    this.seedDefaultUsers();
  }

  private seedDefaultUsers() {
    this.users.set('test_player_01', {
      id: 'test_player_01',
      username: 'player_one',
      status: 'ACTIVE',
      currency: 'BDT'
    });
    this.wallets.set('test_player_01:BDT', {
      id: 'w_test_01_bdt',
      user_id: 'test_player_01',
      currency: 'BDT',
      balance_minor: 50000n, // 500.00 BDT
      version: 1n,
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  public async connect(): Promise<ILedgerDbClient> {
    const activeTxState = {
      inTransaction: false,
      acquiredLocks: new Set<string>(),
      stagedWallets: new Map<string, any>(),
      stagedEntries: new Map<string, any>(),
      stagedIdempotency: new Map<string, any>()
    };

    const client: ILedgerDbClient = {
      query: async <T = any>(sql: string, params: any[] = []): Promise<IDbResult<T>> => {
        const cleanSql = sql.trim().replace(/\s+/g, ' ');

        // 1. BEGIN
        if (cleanSql.toUpperCase() === 'BEGIN') {
          activeTxState.inTransaction = true;
          return { rows: [], rowCount: 0 };
        }

        // 2. COMMIT
        if (cleanSql.toUpperCase() === 'COMMIT') {
          if (activeTxState.inTransaction) {
            // Apply staged mutations to master storage
            for (const [k, v] of activeTxState.stagedWallets.entries()) {
              this.wallets.set(k, { ...v });
            }
            for (const [k, v] of activeTxState.stagedEntries.entries()) {
              this.ledgerEntries.set(k, { ...v });
            }
            for (const [k, v] of activeTxState.stagedIdempotency.entries()) {
              this.idempotencyRecords.set(k, { ...v });
            }
          }
          this.releaseLocks(activeTxState);
          activeTxState.inTransaction = false;
          return { rows: [], rowCount: 0 };
        }

        // 3. ROLLBACK
        if (cleanSql.toUpperCase() === 'ROLLBACK') {
          activeTxState.stagedWallets.clear();
          activeTxState.stagedEntries.clear();
          activeTxState.stagedIdempotency.clear();
          this.releaseLocks(activeTxState);
          activeTxState.inTransaction = false;
          return { rows: [], rowCount: 0 };
        }

        // 4. SELECT FROM idempotency_records WHERE idempotency_key = $1
        if (cleanSql.includes('FROM idempotency_records') && cleanSql.includes('idempotency_key = $1')) {
          const key = params[0];
          const record = this.idempotencyRecords.get(key) || activeTxState.stagedIdempotency.get(key);
          if (record) {
            return {
              rows: [{
                idempotency_key: record.idempotency_key,
                transaction_id: record.transaction_id,
                status_code: record.status_code,
                response_payload: record.response_payload,
                created_at: record.created_at
              } as any],
              rowCount: 1
            };
          }
          return { rows: [], rowCount: 0 };
        }

        // 5. SELECT FROM wallets WHERE user_id = $1 AND currency = $2 (FOR UPDATE)
        if (cleanSql.includes('FROM wallets') && cleanSql.includes('user_id = $1') && cleanSql.includes('currency = $2')) {
          const userId = params[0];
          const currency = params[1];
          const walletKey = `${userId}:${currency}`;

          if (cleanSql.toUpperCase().includes('FOR UPDATE')) {
            // Acquire row-level lock
            await this.acquireRowLock(walletKey, activeTxState);
          }

          const existing = activeTxState.stagedWallets.get(walletKey) || this.wallets.get(walletKey);
          if (!existing) {
            return { rows: [], rowCount: 0 };
          }

          return {
            rows: [{
              id: existing.id,
              user_id: existing.user_id,
              currency: existing.currency,
              balance_minor: existing.balance_minor.toString(),
              version: existing.version.toString(),
              status: existing.status,
              created_at: existing.created_at,
              updated_at: existing.updated_at
            } as any],
            rowCount: 1
          };
        }

        // 6. INSERT INTO wallets
        if (cleanSql.startsWith('INSERT INTO wallets')) {
          const id = params[0];
          const userId = params[1];
          const currency = params[2];
          const balanceMinor = BigInt(params[3]);
          const status = params[4] || 'ACTIVE';
          const walletKey = `${userId}:${currency}`;

          if (this.wallets.has(walletKey) || activeTxState.stagedWallets.has(walletKey)) {
            const err: any = new Error(`duplicate key value violates unique constraint "uq_wallet_user_currency"`);
            err.code = '23505';
            throw err;
          }

          const newWallet = {
            id,
            user_id: userId,
            currency,
            balance_minor: balanceMinor,
            version: 1n,
            status,
            created_at: new Date(),
            updated_at: new Date()
          };

          if (activeTxState.inTransaction) {
            activeTxState.stagedWallets.set(walletKey, newWallet);
          } else {
            this.wallets.set(walletKey, newWallet);
          }

          return { rows: [{ id } as any], rowCount: 1 };
        }

        // 7. UPDATE wallets SET balance_minor = $1, version = version + 1
        if (cleanSql.startsWith('UPDATE wallets')) {
          const balanceMinor = BigInt(params[0]);
          const walletId = params[1];

          // Find wallet
          let targetKey: string | null = null;
          let targetWallet: any = null;

          for (const [k, v] of (activeTxState.inTransaction ? activeTxState.stagedWallets : this.wallets).entries()) {
            if (v.id === walletId) {
              targetKey = k;
              targetWallet = v;
              break;
            }
          }

          if (!targetWallet) {
            for (const [k, v] of this.wallets.entries()) {
              if (v.id === walletId) {
                targetKey = k;
                targetWallet = v;
                break;
              }
            }
          }

          if (!targetWallet || !targetKey) {
            return { rows: [], rowCount: 0 };
          }

          // Check balance non-negative constraint
          if (balanceMinor < 0n) {
            const err: any = new Error(`check constraint "chk_wallet_balance_non_negative" failed`);
            err.code = '23514';
            throw err;
          }

          const updated = {
            ...targetWallet,
            balance_minor: balanceMinor,
            version: targetWallet.version + 1n,
            updated_at: new Date()
          };

          if (activeTxState.inTransaction) {
            activeTxState.stagedWallets.set(targetKey, updated);
          } else {
            this.wallets.set(targetKey, updated);
          }

          return { rows: [{ id: walletId } as any], rowCount: 1 };
        }

        // 8. INSERT INTO ledger_entries
        if (cleanSql.startsWith('INSERT INTO ledger_entries')) {
          const [
            id,
            walletId,
            userId,
            transactionId,
            refTxId,
            type,
            amountMinor,
            currency,
            beforeMinor,
            afterMinor,
            status,
            correlationId,
            auditMetadata
          ] = params;

          // Check unique constraint on (user_id, transaction_id)
          for (const existingEntry of [...this.ledgerEntries.values(), ...activeTxState.stagedEntries.values()]) {
            if (existingEntry.user_id === userId && existingEntry.transaction_id === transactionId) {
              const err: any = new Error(`duplicate key value violates unique constraint "uq_ledger_user_transaction"`);
              err.code = '23505';
              throw err;
            }
          }

          const entry = {
            id,
            wallet_id: walletId,
            user_id: userId,
            transaction_id: transactionId,
            reference_transaction_id: refTxId || null,
            type,
            amount_minor: BigInt(amountMinor),
            currency,
            before_balance_minor: BigInt(beforeMinor),
            after_balance_minor: BigInt(afterMinor),
            status: status || 'COMMITTED',
            correlation_id: correlationId,
            audit_metadata: typeof auditMetadata === 'string' ? JSON.parse(auditMetadata) : auditMetadata,
            created_at: new Date()
          };

          if (activeTxState.inTransaction) {
            activeTxState.stagedEntries.set(id, entry);
          } else {
            this.ledgerEntries.set(id, entry);
          }

          return { rows: [{ id } as any], rowCount: 1 };
        }

        // 9. INSERT INTO idempotency_records
        if (cleanSql.startsWith('INSERT INTO idempotency_records')) {
          const [key, txId, statusCode, payloadJson] = params;

          if (this.idempotencyRecords.has(key) || activeTxState.stagedIdempotency.has(key)) {
            const err: any = new Error(`duplicate key value violates unique constraint "uq_idempotency_key"`);
            err.code = '23505';
            throw err;
          }

          const rec = {
            idempotency_key: key,
            transaction_id: txId,
            status_code: statusCode,
            response_payload: typeof payloadJson === 'string' ? JSON.parse(payloadJson) : payloadJson,
            created_at: new Date()
          };

          if (activeTxState.inTransaction) {
            activeTxState.stagedIdempotency.set(key, rec);
          } else {
            this.idempotencyRecords.set(key, rec);
          }

          return { rows: [{ idempotency_key: key } as any], rowCount: 1 };
        }

        // 10. SELECT FROM ledger_entries WHERE transaction_id = $1
        if (cleanSql.includes('FROM ledger_entries') && cleanSql.includes('transaction_id = $1')) {
          const txId = params[0];
          for (const entry of this.ledgerEntries.values()) {
            if (entry.transaction_id === txId) {
              return {
                rows: [{
                  id: entry.id,
                  wallet_id: entry.wallet_id,
                  user_id: entry.user_id,
                  transaction_id: entry.transaction_id,
                  audit_metadata: entry.audit_metadata
                } as any],
                rowCount: 1
              };
            }
          }
          return { rows: [], rowCount: 0 };
        }

        // 11. Audit check: SUM ledger entries for a wallet
        if (cleanSql.includes('SUM') && cleanSql.includes('FROM ledger_entries')) {
          const walletId = params[0];
          let totalCredits = 0n;
          let totalDebits = 0n;

          for (const entry of this.ledgerEntries.values()) {
            if (entry.wallet_id === walletId && entry.status === 'COMMITTED') {
              if (entry.type === 'CREDIT' || entry.type === 'REVERSAL') {
                totalCredits += entry.amount_minor;
              } else if (entry.type === 'DEBIT') {
                totalDebits += entry.amount_minor;
              }
            }
          }

          return {
            rows: [{
              total_credits: totalCredits.toString(),
              total_debits: totalDebits.toString(),
              net_minor: (totalCredits - totalDebits).toString()
            } as any],
            rowCount: 1
          };
        }

        return { rows: [], rowCount: 0 };
      },

      release: () => {
        if (activeTxState.inTransaction) {
          activeTxState.stagedWallets.clear();
          activeTxState.stagedEntries.clear();
          activeTxState.stagedIdempotency.clear();
          this.releaseLocks(activeTxState);
        }
      }
    };

    return client;
  }

  public async query<T = any>(sql: string, params?: any[]): Promise<IDbResult<T>> {
    const client = await this.connect();
    try {
      return await client.query<T>(sql, params);
    } finally {
      client.release();
    }
  }

  private async acquireRowLock(walletKey: string, txState: { acquiredLocks: Set<string> }) {
    while (this.walletLocks.has(walletKey)) {
      await this.walletLocks.get(walletKey);
    }
    let resolver: () => void;
    const lockPromise = new Promise<void>((res) => {
      resolver = res;
    });
    this.walletLocks.set(walletKey, lockPromise);
    this.lockResolvers.set(walletKey, resolver!);
    txState.acquiredLocks.add(walletKey);
  }

  private releaseLocks(txState: { acquiredLocks: Set<string> }) {
    for (const key of txState.acquiredLocks) {
      const resolver = this.lockResolvers.get(key);
      if (resolver) {
        resolver();
        this.lockResolvers.delete(key);
      }
      this.walletLocks.delete(key);
    }
    txState.acquiredLocks.clear();
  }

  /**
   * Diagnostic helper to inspect master storage state
   */
  public getDebugSnapshot() {
    return {
      walletsCount: this.wallets.size,
      ledgerEntriesCount: this.ledgerEntries.size,
      idempotencyRecordsCount: this.idempotencyRecords.size
    };
  }
}
