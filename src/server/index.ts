/**
 * @file index.ts
 * @description Standalone Production Express Server entrypoint for B2B Seamless Wallet API.
 */

import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { validateHmacSignature, AuthenticatedRequest } from './middleware/hmac';
import { SeamlessWalletService, IDbPool } from './services/walletService';
import { SeamlessWalletController } from './controllers/seamlessWalletController';
import { paymentController } from './controllers/paymentController';
import { paymentGatewayController } from './controllers/paymentGatewayController';
import { getAffiliateSummaryHandler, claimCommissionHandler } from './controllers/affiliateController';
import { getVipDetailsHandler, claimVipBonusHandler } from './controllers/vipController';
import { getPromotionDetailsHandler, claimCheckInHandler, spinWheelHandler } from './controllers/promotionController';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const HOST = '0.0.0.0';

// ----------------------------------------------------------------------------
// 1. Raw Body Middleware for HMAC SHA-256 Signature Verification
// Crucial: Must capture raw byte stream before JSON.parse alters whitespace/keys
// ----------------------------------------------------------------------------
app.use(
  express.json({
    verify: (req: AuthenticatedRequest, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  })
);

// ----------------------------------------------------------------------------
// 2. Database Connection Pool Mock / Real PG Client setup
// In production, instantiate `new pg.Pool({ connectionString: process.env.DATABASE_URL })`
// ----------------------------------------------------------------------------
const dbPoolMock: IDbPool = {
  connect: async () => ({
    query: async (sql: string, params?: any[]) => ({ rows: [], rowCount: 0 }),
    release: () => {}
  }),
  query: async (sql: string, params?: any[]) => ({ rows: [], rowCount: 0 })
};

// ----------------------------------------------------------------------------
// 3. Dependency Injection & Service / Controller Instantiation
// ----------------------------------------------------------------------------
const walletService = new SeamlessWalletService(dbPoolMock);
const walletController = new SeamlessWalletController(walletService);

// ----------------------------------------------------------------------------
// 4. B2B Seamless Wallet Routes (Protected by HMAC Validation Middleware)
// ----------------------------------------------------------------------------
const seamlessRouter = express.Router();
seamlessRouter.use(validateHmacSignature);

seamlessRouter.post('/balance', walletController.getBalance);
seamlessRouter.post('/bet', walletController.processBet);
seamlessRouter.post('/win', walletController.processWin);
seamlessRouter.post('/refund', walletController.processRefund);

app.use('/api/seamless', seamlessRouter);

// ----------------------------------------------------------------------------
// 5. Automated Payment Gateway & Cashier Routes (bKash, Nagad, Rocket, Bank, USDT)
// ----------------------------------------------------------------------------
const cashierRouter = express.Router();
cashierRouter.post('/deposit', (req, res) => paymentController.submitDeposit(req, res));
cashierRouter.post('/withdraw', (req, res) => paymentController.submitWithdrawal(req, res));
cashierRouter.get('/requests', (req, res) => paymentController.getRequests(req, res));

app.use('/api/cashier', cashierRouter);

// Automated Payment Orchestrator API v2
const paymentV2Router = express.Router();
paymentV2Router.post('/deposit/intent', (req, res) => paymentGatewayController.createDepositIntent(req, res));
paymentV2Router.post('/deposit/verify-trx', (req, res) => paymentGatewayController.verifyTrxId(req, res));
paymentV2Router.post('/withdraw/request', (req, res) => paymentGatewayController.requestWithdrawal(req, res));
paymentV2Router.post('/webhook/:provider', (req, res) => paymentGatewayController.handleWebhook(req, res));
paymentV2Router.get('/destination-pool', (req, res) => paymentGatewayController.getDestinationPool(req, res));
paymentV2Router.get('/stats', (req, res) => paymentGatewayController.getStats(req, res));

app.use('/api/v2/payment', paymentV2Router);

// ----------------------------------------------------------------------------
// 6. Multi-Tier Affiliate, VIP & Promotion Routes
// ----------------------------------------------------------------------------
const affiliateRouter = express.Router();
affiliateRouter.get('/summary', getAffiliateSummaryHandler);
affiliateRouter.post('/claim', claimCommissionHandler);
app.use('/api/affiliate', affiliateRouter);

const vipRouter = express.Router();
vipRouter.get('/details', getVipDetailsHandler);
vipRouter.post('/claim-bonus', claimVipBonusHandler);
app.use('/api/vip', vipRouter);

const promoRouter = express.Router();
promoRouter.get('/details', getPromotionDetailsHandler);
promoRouter.post('/checkin', claimCheckInHandler);
promoRouter.post('/spin', spinWheelHandler);
app.use('/api/promo', promoRouter);

// ----------------------------------------------------------------------------
// 7. Health Check Endpoint (For Cloud Run / Firebase App Hosting Probes)
// ----------------------------------------------------------------------------
app.get(['/health', '/api/health', '/_health'], (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'HEALTHY',
    uptime: process.uptime(),
    timestamp: Date.now(),
    port: PORT
  });
});

// ----------------------------------------------------------------------------
// 8. Serve Static Frontend Bundle (dist directory) in Production
// ----------------------------------------------------------------------------
const distPath = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ code: 'NOT_FOUND', message: 'API route not found' });
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Fatal Server Error]:', err);
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'An unhandled server exception occurred',
    timestamp: Date.now()
  });
});

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, HOST, () => {
    console.log(`[Seamless Wallet Core] Server successfully listening on http://${HOST}:${PORT} (PORT=${PORT})`);
  });

  process.on('SIGTERM', () => {
    console.log('[Seamless Wallet Core] SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('[Seamless Wallet Core] HTTP server closed');
      process.exit(0);
    });
  });
}

export default app;
