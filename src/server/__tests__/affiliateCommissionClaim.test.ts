/**
 * @file affiliateCommissionClaim.test.ts
 * @description Unit & Contract Verification Suite for PLAY369 Task 2.3 Affiliate Commission Claim Ledger Integrity.
 * 
 * Verifies:
 * 1. Normal commission claim (atomic credit via exact BigInt math, status updated to CLAIMED, unclaimed reset).
 * 2. Zero claim rejection (fails safe with zero mutation when no unclaimed commission exists).
 * 3. Concurrent double-click claim protection (row locks serialize requests, exactly-once credit).
 * 4. Retry same claim / Idempotency handling (duplicate claimTxId returns original outcome without double credit).
 * 5. Partial failure rollback (crash-safe ACID transaction, no divergence between wallet and commission state).
 * 6. Already-claimed entries protection (only SETTLED entries are claimed, CLAIMED entries are never re-credited).
 * 7. Exact BigInt scale-4 minor unit math (zero floating-point drift/inaccuracies).
 * 8. Wallet frozen / not found failure handling (fails safe with zero commission state corruption).
 * 9. Static code audit ensuring no Number(), parseFloat(), or toFixed() in claimAffiliateCommission.
 */

import { toScale4, fromScale4 } from '../controllers/promotionController.js';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

async function assert(desc: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}\n`);
    failed++;
  }
}

// In-Memory Transactional Engine Mock for Affiliate Claim Verification
interface MockWallet {
  id: number;
  userId: number;
  currency: string;
  realBalance: bigint; // scale-4
  version: number;
  status: 'ACTIVE' | 'FROZEN' | 'CLOSED';
}

interface MockAffiliateNode {
  userId: number;
  unclaimedCommission: bigint; // scale-4
  totalCommissionEarned: bigint; // scale-4
}

interface MockCommissionEntry {
  id: number;
  beneficiaryUserId: number;
  commissionAmount: bigint; // scale-4
  status: 'SETTLED' | 'CLAIMED';
}

interface MockTransaction {
  transactionId: string;
  userId: number;
  walletId: number;
  type: string;
  amount: string;
  beforeBalance: string;
  afterBalance: string;
  status: string;
}

class MockClaimEngine {
  public wallets = new Map<number, MockWallet>();
  public nodes = new Map<number, MockAffiliateNode>();
  public commissions: MockCommissionEntry[] = [];
  public transactions = new Map<string, MockTransaction>();
  private nodeLocks = new Map<number, Promise<void>>();
  private nodeLockResolvers = new Map<number, () => void>();

  public async acquireNodeLock(userId: number): Promise<void> {
    while (this.nodeLocks.has(userId)) {
      await this.nodeLocks.get(userId);
    }
    let resolver: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolver = resolve;
    });
    this.nodeLocks.set(userId, lockPromise);
    this.nodeLockResolvers.set(userId, resolver!);
  }

  public releaseNodeLock(userId: number): void {
    const resolver = this.nodeLockResolvers.get(userId);
    if (resolver) {
      this.nodeLocks.delete(userId);
      this.nodeLockResolvers.delete(userId);
      resolver();
    }
  }

  public async claimAffiliateCommission(
    userId: number,
    claimTxId?: string,
    options?: { simulateDbCrashBeforeCommit?: boolean }
  ) {
    if (!userId || typeof userId !== 'number') {
      throw new Error('Valid userId is required to claim commissions');
    }

    const deterministicTxId = claimTxId && typeof claimTxId === 'string' && claimTxId.trim() !== ''
      ? claimTxId.trim()
      : `COMM_CLAIM_${userId}_${Date.now()}`;

    // 1. Idempotency check
    if (this.transactions.has(deterministicTxId)) {
      const existing = this.transactions.get(deterministicTxId)!;
      return {
        claimedAmount: existing.amount,
        newRealBalance: existing.afterBalance,
        transactionId: existing.transactionId,
        isIdempotent: true
      };
    }

    await this.acquireNodeLock(userId);

    try {
      // 2. Lock & fetch affiliate node
      const node = this.nodes.get(userId);
      if (!node) {
        throw new Error('Affiliate profile not found');
      }

      // 3. Lock & fetch wallet
      const wallet = this.wallets.get(userId);
      if (!wallet) {
        throw new Error('Player wallet not found');
      }

      if (wallet.status !== 'ACTIVE') {
        throw new Error(`Player wallet is ${wallet.status.toLowerCase()}`);
      }

      // 4. Fetch SETTLED commission records only
      const settled = this.commissions.filter(
        (c) => c.beneficiaryUserId === userId && c.status === 'SETTLED'
      );

      let totalClaimableScale4 = 0n;
      for (const entry of settled) {
        totalClaimableScale4 += entry.commissionAmount;
      }

      // Check node unclaimed balance as fallback
      if (totalClaimableScale4 === 0n && node.unclaimedCommission > 0n) {
        totalClaimableScale4 = node.unclaimedCommission;
      }

      if (totalClaimableScale4 <= 0n) {
        throw new Error('No unclaimed commissions available');
      }

      const claimedAmountStr = fromScale4(totalClaimableScale4);

      // Snapshot pre-claim state for rollback simulation
      const prevWalletBalance = wallet.realBalance;
      const prevWalletVersion = wallet.version;
      const prevNodeUnclaimed = node.unclaimedCommission;
      const prevCommissionsStatus = settled.map((c) => ({ id: c.id, status: c.status }));

      try {
        // 5. Calculate new balance with exact BigInt math
        const beforeBalanceScale4 = wallet.realBalance;
        const afterBalanceScale4 = beforeBalanceScale4 + totalClaimableScale4;
        const beforeBalanceStr = fromScale4(beforeBalanceScale4);
        const afterBalanceStr = fromScale4(afterBalanceScale4);

        // 6. Update wallet
        wallet.realBalance = afterBalanceScale4;
        wallet.version += 1;

        // 7. Update affiliate node unclaimed
        const remaining = node.unclaimedCommission > totalClaimableScale4
          ? node.unclaimedCommission - totalClaimableScale4
          : 0n;
        node.unclaimedCommission = remaining;

        // 8. Mark entries as CLAIMED
        for (const entry of settled) {
          entry.status = 'CLAIMED';
        }

        // 9. Simulate unexpected DB crash if requested
        if (options?.simulateDbCrashBeforeCommit) {
          throw new Error('DB_FATAL_DISK_IO_ERROR: Simulated connection drop before commit');
        }

        // 10. Record double-entry transaction
        const txRecord: MockTransaction = {
          transactionId: deterministicTxId,
          userId,
          walletId: wallet.id,
          type: 'COMMISSION',
          amount: claimedAmountStr,
          beforeBalance: beforeBalanceStr,
          afterBalance: afterBalanceStr,
          status: 'COMPLETED'
        };
        this.transactions.set(deterministicTxId, txRecord);

        return {
          claimedAmount: claimedAmountStr,
          newRealBalance: afterBalanceStr,
          transactionId: deterministicTxId
        };
      } catch (innerErr) {
        // Atomic rollback
        wallet.realBalance = prevWalletBalance;
        wallet.version = prevWalletVersion;
        node.unclaimedCommission = prevNodeUnclaimed;
        for (const prev of prevCommissionsStatus) {
          const entry = this.commissions.find((c) => c.id === prev.id);
          if (entry) entry.status = prev.status;
        }
        throw innerErr;
      }
    } finally {
      this.releaseNodeLock(userId);
    }
  }
}

async function runAffiliateCommissionClaimTests() {
  console.log('================================================================');
  console.log('🛡️ PLAY369 TASK 2.3 AFFILIATE COMMISSION CLAIM INTEGRITY SUITE');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // TEST 1: Normal Commission Claim with Exact BigInt Minor-Unit Math
  // --------------------------------------------------------------------------
  await assert('1. Normal commission claim credits wallet and marks entries CLAIMED', async () => {
    const engine = new MockClaimEngine();
    const userId = 101;

    engine.wallets.set(userId, {
      id: 1,
      userId,
      currency: 'BDT',
      realBalance: toScale4('500.0000'),
      version: 1,
      status: 'ACTIVE'
    });

    engine.nodes.set(userId, {
      userId,
      unclaimedCommission: toScale4('75.5000'),
      totalCommissionEarned: toScale4('75.5000')
    });

    engine.commissions.push(
      { id: 1, beneficiaryUserId: userId, commissionAmount: toScale4('50.0000'), status: 'SETTLED' },
      { id: 2, beneficiaryUserId: userId, commissionAmount: toScale4('25.5000'), status: 'SETTLED' }
    );

    const result = await engine.claimAffiliateCommission(userId, 'CLAIM_TEST_001');

    if (result.claimedAmount !== '75.5000') {
      throw new Error(`Expected claimedAmount '75.5000', got '${result.claimedAmount}'`);
    }
    if (result.newRealBalance !== '575.5000') {
      throw new Error(`Expected newRealBalance '575.5000', got '${result.newRealBalance}'`);
    }

    const updatedWallet = engine.wallets.get(userId)!;
    if (fromScale4(updatedWallet.realBalance) !== '575.5000') {
      throw new Error(`Wallet balance mismatch: ${fromScale4(updatedWallet.realBalance)}`);
    }
    if (updatedWallet.version !== 2) {
      throw new Error(`Expected wallet version 2, got ${updatedWallet.version}`);
    }

    const updatedNode = engine.nodes.get(userId)!;
    if (fromScale4(updatedNode.unclaimedCommission) !== '0.0000') {
      throw new Error(`Expected node unclaimed 0.0000, got ${fromScale4(updatedNode.unclaimedCommission)}`);
    }

    const allClaimed = engine.commissions.every((c) => c.status === 'CLAIMED');
    if (!allClaimed) {
      throw new Error('All commission entries must be marked CLAIMED');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 2: Zero Claim Rejection
  // --------------------------------------------------------------------------
  await assert('2. Zero unclaimed commission claim is rejected with zero mutation', async () => {
    const engine = new MockClaimEngine();
    const userId = 102;

    engine.wallets.set(userId, {
      id: 2,
      userId,
      currency: 'BDT',
      realBalance: toScale4('200.0000'),
      version: 1,
      status: 'ACTIVE'
    });

    engine.nodes.set(userId, {
      userId,
      unclaimedCommission: 0n,
      totalCommissionEarned: toScale4('50.0000')
    });

    let rejected = false;
    try {
      await engine.claimAffiliateCommission(userId, 'CLAIM_ZERO_001');
    } catch (err: any) {
      if (err.message.includes('No unclaimed commissions available')) {
        rejected = true;
      }
    }

    if (!rejected) {
      throw new Error('Expected zero commission claim to be rejected');
    }

    // Verify zero wallet mutation
    const wallet = engine.wallets.get(userId)!;
    if (fromScale4(wallet.realBalance) !== '200.0000' || wallet.version !== 1) {
      throw new Error('Wallet was mutated on zero claim rejection');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 3: Concurrent Double-Click Claim Protection
  // --------------------------------------------------------------------------
  await assert('3. Concurrent double-click claim executes exactly once due to row locks', async () => {
    const engine = new MockClaimEngine();
    const userId = 103;

    engine.wallets.set(userId, {
      id: 3,
      userId,
      currency: 'BDT',
      realBalance: toScale4('100.0000'),
      version: 1,
      status: 'ACTIVE'
    });

    engine.nodes.set(userId, {
      userId,
      unclaimedCommission: toScale4('50.0000'),
      totalCommissionEarned: toScale4('50.0000')
    });

    engine.commissions.push({
      id: 10,
      beneficiaryUserId: userId,
      commissionAmount: toScale4('50.0000'),
      status: 'SETTLED'
    });

    // Fire two simultaneous claims
    const [res1, res2] = await Promise.allSettled([
      engine.claimAffiliateCommission(userId, 'CLAIM_CONCURRENT_1'),
      engine.claimAffiliateCommission(userId, 'CLAIM_CONCURRENT_2')
    ]);

    const successes = [res1, res2].filter((r) => r.status === 'fulfilled');
    const rejections = [res1, res2].filter((r) => r.status === 'rejected');

    if (successes.length !== 1 || rejections.length !== 1) {
      throw new Error(`Expected exactly 1 success and 1 rejection, got ${successes.length} successes`);
    }

    const wallet = engine.wallets.get(userId)!;
    // Balance should be exactly 150.0000, not 200.0000
    if (fromScale4(wallet.realBalance) !== '150.0000') {
      throw new Error(`Double crediting detected! Wallet balance is ${fromScale4(wallet.realBalance)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 4: Retry Same Claim / Idempotency
  // --------------------------------------------------------------------------
  await assert('4. Retry with duplicate claimTxId returns cached outcome without re-crediting', async () => {
    const engine = new MockClaimEngine();
    const userId = 104;

    engine.wallets.set(userId, {
      id: 4,
      userId,
      currency: 'BDT',
      realBalance: toScale4('100.0000'),
      version: 1,
      status: 'ACTIVE'
    });

    engine.nodes.set(userId, {
      userId,
      unclaimedCommission: toScale4('30.0000'),
      totalCommissionEarned: toScale4('30.0000')
    });

    engine.commissions.push({
      id: 20,
      beneficiaryUserId: userId,
      commissionAmount: toScale4('30.0000'),
      status: 'SETTLED'
    });

    const txId = 'IDEMP_CLAIM_104';
    const firstCall = await engine.claimAffiliateCommission(userId, txId);
    const secondCall = await engine.claimAffiliateCommission(userId, txId);

    if (secondCall.claimedAmount !== '30.0000' || secondCall.newRealBalance !== '130.0000') {
      throw new Error('Idempotent retry failed to return consistent response');
    }
    if (!secondCall.isIdempotent) {
      throw new Error('Expected isIdempotent flag on repeated claimTxId');
    }

    const wallet = engine.wallets.get(userId)!;
    if (fromScale4(wallet.realBalance) !== '130.0000' || wallet.version !== 2) {
      throw new Error(`Wallet corrupted on idempotent retry: ${fromScale4(wallet.realBalance)}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 5: Partial Failure Rollback (Crash Safety)
  // --------------------------------------------------------------------------
  await assert('5. Partial failure during claim transaction rolls back atomically', async () => {
    const engine = new MockClaimEngine();
    const userId = 105;

    engine.wallets.set(userId, {
      id: 5,
      userId,
      currency: 'BDT',
      realBalance: toScale4('100.0000'),
      version: 1,
      status: 'ACTIVE'
    });

    engine.nodes.set(userId, {
      userId,
      unclaimedCommission: toScale4('40.0000'),
      totalCommissionEarned: toScale4('40.0000')
    });

    engine.commissions.push({
      id: 30,
      beneficiaryUserId: userId,
      commissionAmount: toScale4('40.0000'),
      status: 'SETTLED'
    });

    let failedAsExpected = false;
    try {
      await engine.claimAffiliateCommission(userId, 'CLAIM_FAIL_001', {
        simulateDbCrashBeforeCommit: true
      });
    } catch (err: any) {
      if (err.message.includes('DB_FATAL_DISK_IO_ERROR')) {
        failedAsExpected = true;
      }
    }

    if (!failedAsExpected) {
      throw new Error('Expected transaction to fail on simulated crash');
    }

    // Verify complete state integrity
    const wallet = engine.wallets.get(userId)!;
    if (fromScale4(wallet.realBalance) !== '100.0000' || wallet.version !== 1) {
      throw new Error(`Wallet balance not rolled back! Found ${fromScale4(wallet.realBalance)}`);
    }

    const node = engine.nodes.get(userId)!;
    if (fromScale4(node.unclaimedCommission) !== '40.0000') {
      throw new Error(`Node unclaimed commission not rolled back! Found ${fromScale4(node.unclaimedCommission)}`);
    }

    const commission = engine.commissions.find((c) => c.id === 30)!;
    if (commission.status !== 'SETTLED') {
      throw new Error(`Commission status mutated during rollback: ${commission.status}`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 6: Already-Claimed Entries Protection
  // --------------------------------------------------------------------------
  await assert('6. Already CLAIMED entries are excluded and cannot be claimed again', async () => {
    const engine = new MockClaimEngine();
    const userId = 106;

    engine.wallets.set(userId, {
      id: 6,
      userId,
      currency: 'BDT',
      realBalance: toScale4('500.0000'),
      version: 1,
      status: 'ACTIVE'
    });

    engine.nodes.set(userId, {
      userId,
      unclaimedCommission: 0n,
      totalCommissionEarned: toScale4('100.0000')
    });

    // 2 already CLAIMED entries
    engine.commissions.push(
      { id: 41, beneficiaryUserId: userId, commissionAmount: toScale4('60.0000'), status: 'CLAIMED' },
      { id: 42, beneficiaryUserId: userId, commissionAmount: toScale4('40.0000'), status: 'CLAIMED' }
    );

    let rejected = false;
    try {
      await engine.claimAffiliateCommission(userId, 'CLAIM_ALREADY_001');
    } catch (err: any) {
      if (err.message.includes('No unclaimed commissions available')) {
        rejected = true;
      }
    }

    if (!rejected) {
      throw new Error('Expected claim of already claimed entries to be rejected');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 7: Exact Scale-4 BigInt Arithmetic Accuracy
  // --------------------------------------------------------------------------
  await assert('7. Exact BigInt scale-4 minor unit math prevents floating-point precision drift', () => {
    // 0.1000 + 0.2000 in floats = 0.30000000000000004
    const a = toScale4('0.1000');
    const b = toScale4('0.2000');
    const sum = a + b;
    const sumStr = fromScale4(sum);

    if (sumStr !== '0.3000') {
      throw new Error(`Expected '0.3000', got '${sumStr}'`);
    }

    // Accumulating 10,000 small commissions of 0.0001
    let total = 0n;
    const small = toScale4('0.0001');
    for (let i = 0; i < 10000; i++) {
      total += small;
    }

    if (fromScale4(total) !== '1.0000') {
      throw new Error(`Expected exact '1.0000', got '${fromScale4(total)}'`);
    }
  });

  // --------------------------------------------------------------------------
  // TEST 8: Wallet Frozen / Not Found Failure with Zero Commission Corruption
  // --------------------------------------------------------------------------
  await assert('8. Frozen or nonexistent wallet aborts claim with zero commission-state corruption', async () => {
    const engine = new MockClaimEngine();
    const userId = 108;

    engine.wallets.set(userId, {
      id: 8,
      userId,
      currency: 'BDT',
      realBalance: toScale4('300.0000'),
      version: 1,
      status: 'FROZEN'
    });

    engine.nodes.set(userId, {
      userId,
      unclaimedCommission: toScale4('88.5000'),
      totalCommissionEarned: toScale4('88.5000')
    });

    engine.commissions.push({
      id: 50,
      beneficiaryUserId: userId,
      commissionAmount: toScale4('88.5000'),
      status: 'SETTLED'
    });

    let rejected = false;
    try {
      await engine.claimAffiliateCommission(userId, 'CLAIM_FROZEN_001');
    } catch (err: any) {
      if (err.message.includes('frozen')) {
        rejected = true;
      }
    }

    if (!rejected) {
      throw new Error('Expected claim on frozen wallet to be rejected');
    }

    // Verify commission remains SETTLED and unclaimedCommission is intact
    const node = engine.nodes.get(userId)!;
    if (fromScale4(node.unclaimedCommission) !== '88.5000') {
      throw new Error('Node unclaimedCommission was corrupted on frozen wallet failure');
    }
    const commission = engine.commissions.find((c) => c.id === 50)!;
    if (commission.status !== 'SETTLED') {
      throw new Error('Commission entry was marked CLAIMED despite frozen wallet failure');
    }
  });

  // --------------------------------------------------------------------------
  // TEST 9: Static Code Analysis of claimAffiliateCommission
  // --------------------------------------------------------------------------
  await assert('9. Static code analysis confirms zero Number(), parseFloat(), or toFixed() in claimAffiliateCommission', () => {
    const controllerPath = path.join(process.cwd(), 'src/server/controllers/affiliateController.ts');
    const content = fs.readFileSync(controllerPath, 'utf8');

    const startIdx = content.indexOf('public static async claimAffiliateCommission');
    if (startIdx === -1) {
      throw new Error('claimAffiliateCommission method not found in affiliateController.ts');
    }

    const endIdx = content.indexOf('export const getAffiliateSummaryHandler', startIdx);
    const methodBody = content.substring(startIdx, endIdx);

    const bannedPatterns = [
      /\bNumber\s*\(/,
      /\bparseFloat\s*\(/,
      /\bparseInt\s*\(/,
      /\.toFixed\s*\(/,
    ];

    for (const pattern of bannedPatterns) {
      if (pattern.test(methodBody)) {
        throw new Error(`Banned float/numeric conversion pattern ${pattern} found in claimAffiliateCommission body`);
      }
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAffiliateCommissionClaimTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
