/**
 * @file paymentAmountScale4Task614.test.ts
 * @description Comprehensive Test Suite for PLAY369 — TASK 6.1.4:
 * STRICT PAYMENT AMOUNT BOUNDARY & SCALE-4 PRECISION
 *
 * Verifies:
 * 1. Canonical scale-4 money parser & validator unit tests
 * 2. Exact decimal string representations and minor unit calculations (scale 4, 1.0000 = 10000n)
 * 3. Strict input validation rejecting over-precision (> 4 decimal places), scientific notation, negative numbers, NaN/Infinity
 * 4. PaymentGatewayController deposit and withdrawal HTTP endpoint validations
 * 5. Static code analysis: zero Number(amount) or floating-point conversions in controllers
 */

import { validatePaymentAmount, toScale4, fromScale4 } from '../utils/paymentAmount';
import { PaymentGatewayController } from '../controllers/paymentGatewayController';
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

function expectThrow(fn: () => void, match: RegExp, msg?: string) {
  try {
    fn();
    throw new Error(msg || 'Expected function to throw, but it succeeded.');
  } catch (err: any) {
    if (err.message === (msg || 'Expected function to throw, but it succeeded.')) {
      throw err;
    }
    if (!match.test(err.message)) {
      throw new Error(`Expected error message to match ${match}, but got "${err.message}"`);
    }
  }
}

async function runTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING PLAY369 TASK 6.1.4: STRICT PAYMENT AMOUNT & SCALE-4');
  console.log('================================================================\n');

  // Test 1: Valid scale-4 conversions
  await assert('1. Valid exact decimal strings parsed to scale-4 minor units and canonical strings', () => {
    const res1 = validatePaymentAmount('100');
    if (res1.raw !== '100' || res1.minorUnits !== 1000000n || res1.decimalString !== '100.0000') {
      throw new Error(`Unexpected result for "100": ${JSON.stringify(res1)}`);
    }

    const res2 = validatePaymentAmount('100.0000');
    if (res2.raw !== '100.0000' || res2.minorUnits !== 1000000n || res2.decimalString !== '100.0000') {
      throw new Error(`Unexpected result for "100.0000": ${JSON.stringify(res2)}`);
    }

    const res3 = validatePaymentAmount('0.0516');
    if (res3.raw !== '0.0516' || res3.minorUnits !== 516n || res3.decimalString !== '0.0516') {
      throw new Error(`Unexpected result for "0.0516": ${JSON.stringify(res3)}`);
    }

    const res4 = validatePaymentAmount('50.5');
    if (res4.minorUnits !== 505000n || res4.decimalString !== '50.5000') {
      throw new Error(`Unexpected result for "50.5": ${JSON.stringify(res4)}`);
    }
  });

  // Test 2: Over-precision fractional rejection
  await assert('2. Rejects over-precision fractional digits > 4 decimal places without truncation', () => {
    expectThrow(() => validatePaymentAmount('1.23456'), /Over-precision monetary input rejected/);
    expectThrow(() => validatePaymentAmount('0.00001'), /Over-precision monetary input rejected/);
    expectThrow(() => validatePaymentAmount('99.99999'), /Over-precision monetary input rejected/);
  });

  // Test 3: Scientific notation rejection
  await assert('3. Rejects scientific notation strings in monetary input', () => {
    expectThrow(() => validatePaymentAmount('1e3'), /Scientific notation is not allowed/);
    expectThrow(() => validatePaymentAmount('1E5'), /Scientific notation is not allowed/);
    expectThrow(() => validatePaymentAmount('2.5e-2'), /Scientific notation is not allowed/);
  });

  // Test 4: Negative & zero amount rejection
  await assert('4. Rejects negative, zero, and empty monetary amounts', () => {
    expectThrow(() => validatePaymentAmount('-100'), /cannot be negative/);
    expectThrow(() => validatePaymentAmount('-0.0516'), /cannot be negative/);
    expectThrow(() => validatePaymentAmount('0'), /strictly greater than zero/);
    expectThrow(() => validatePaymentAmount('0.0000'), /strictly greater than zero/);
    expectThrow(() => validatePaymentAmount(''), /Monetary amount is required/);
    expectThrow(() => validatePaymentAmount('   '), /Monetary amount is required/);
    expectThrow(() => validatePaymentAmount(null), /Monetary amount is required/);
    expectThrow(() => validatePaymentAmount(undefined), /Monetary amount is required/);
  });

  // Test 5: Malformed formats rejection
  await assert('5. Rejects NaN, Infinity, -Infinity and malformed format strings', () => {
    expectThrow(() => validatePaymentAmount(NaN), /NaN or Infinity is not allowed/);
    expectThrow(() => validatePaymentAmount(Infinity), /NaN or Infinity is not allowed/);
    expectThrow(() => validatePaymentAmount('NaN'), /Invalid monetary amount format/);
    expectThrow(() => validatePaymentAmount('Infinity'), /Invalid monetary amount format/);
    expectThrow(() => validatePaymentAmount('-Infinity'), /Invalid monetary amount format|cannot be negative/);
    expectThrow(() => validatePaymentAmount('abc'), /Invalid monetary decimal string format/);
    expectThrow(() => validatePaymentAmount('1.2.3'), /Invalid monetary decimal string format/);
    expectThrow(() => validatePaymentAmount('.5'), /Invalid monetary decimal string format/);
    expectThrow(() => validatePaymentAmount('1.'), /Invalid monetary decimal string format/);
  });

  // Test 6: toScale4 rejects unsafe JS number types
  await assert('6. toScale4 rejects unsafe JS floating point numbers', () => {
    expectThrow(() => toScale4(100 as any), /Unsafe JS number monetary input is rejected/);
  });

  // Test 7: HTTP Controller Endpoint Validation
  const controller = new PaymentGatewayController();
  const mockResponse = () => {
    const res: any = {};
    res.statusCode = 200;
    res.status = (code: number) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data: any) => {
      res.body = data;
      return res;
    };
    return res;
  };

  await assert('7. PaymentGatewayController deposit rejects over-precision, scientific notation & negative amounts', async () => {
    // Over-precision
    const req1: any = {
      body: { userId: '101', username: 'Player1', provider: 'bkash', amount: '1.23456' },
      headers: {},
      socket: {}
    };
    const res1 = mockResponse();
    await controller.createDepositIntent(req1, res1);
    if (res1.statusCode !== 400 || !res1.body.error.includes('Over-precision monetary input rejected')) {
      throw new Error(`Expected 400 with over-precision error, got ${res1.statusCode} ${JSON.stringify(res1.body)}`);
    }

    // Scientific notation
    const req2: any = {
      body: { userId: '101', username: 'Player1', provider: 'bkash', amount: '1e3' },
      headers: {},
      socket: {}
    };
    const res2 = mockResponse();
    await controller.createDepositIntent(req2, res2);
    if (res2.statusCode !== 400 || !res2.body.error.includes('Scientific notation is not allowed')) {
      throw new Error(`Expected 400 with scientific notation error, got ${res2.statusCode} ${JSON.stringify(res2.body)}`);
    }

    // Negative amount
    const req3: any = {
      body: { userId: '101', username: 'Player1', provider: 'bkash', amount: '-500' },
      headers: {},
      socket: {}
    };
    const res3 = mockResponse();
    await controller.createDepositIntent(req3, res3);
    if (res3.statusCode !== 400 || !res3.body.error.includes('cannot be negative')) {
      throw new Error(`Expected 400 with negative amount error, got ${res3.statusCode} ${JSON.stringify(res3.body)}`);
    }
  });

  await assert('8. PaymentGatewayController accepts valid scale-4 decimal strings without float conversions', async () => {
    const req: any = {
      body: { userId: '101', username: 'Player1', provider: 'bkash', amount: '500.0000' },
      headers: {},
      socket: {}
    };
    const res = mockResponse();
    await controller.createDepositIntent(req, res);
    if (res.statusCode !== 201 || !res.body.success || res.body.data.amount !== '500.0000') {
      throw new Error(`Expected 201 with amount '500.0000', got ${res.statusCode} ${JSON.stringify(res.body)}`);
    }
  });

  await assert('9. PaymentGatewayController withdrawal rejects invalid amount formats', async () => {
    const req: any = {
      body: { userId: '101', username: 'Player1', provider: 'nagad', amount: 'abc', recipientAccount: '01811223344' },
      headers: {},
      socket: {}
    };
    const res = mockResponse();
    await controller.requestWithdrawal(req, res);
    if (res.statusCode !== 400 || !res.body.error.includes('Invalid monetary amount')) {
      throw new Error(`Expected 400 with invalid monetary amount error, got ${res.statusCode} ${JSON.stringify(res.body)}`);
    }
  });

  // Test 10: Static code analysis of controllers
  await assert('10. Static Code Analysis: paymentGatewayController.ts contains ZERO Number(amount) conversions', () => {
    const filePath = path.join(process.cwd(), 'src', 'server', 'controllers', 'paymentGatewayController.ts');
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('Number(amount)')) {
      throw new Error('paymentGatewayController.ts must not contain Number(amount) conversions');
    }
    if (!content.includes('validatePaymentAmount(amount)')) {
      throw new Error('paymentGatewayController.ts must call validatePaymentAmount(amount)');
    }
  });

  console.log('\n================================================================');
  console.log(`📊 TASK 6.1.4 TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error('Test harness exception:', e);
  process.exit(1);
});
