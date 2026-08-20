/**
 * @file index.ts
 * @description Standalone Production Express Server entrypoint for B2B Seamless Wallet API.
 */

import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { validateHmacSignature, AuthenticatedRequest } from './middleware/hmac';
import { SeamlessWalletService, IDbPool } from './services/walletService';
import { SeamlessWalletController } from './controllers/seamlessWalletController';
import { paymentController } from './controllers/paymentController';
import { getAffiliateSummaryHandler, claimCommissionHandler } from './controllers/affiliateController';
import { getVipDetailsHandler, claimVipBonusHandler } from './controllers/vipController';
import { getPromotionDetailsHandler, claimCheckInHandler, spinWheelHandler } from './controllers/promotionController';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

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
// 5. Local Cashier Payment Routes (bKash, Nagad, Rocket, Upay)
// ----------------------------------------------------------------------------
const cashierRouter = express.Router();
cashierRouter.post('/deposit', (req, res) => paymentController.submitDeposit(req, res));
cashierRouter.post('/withdraw', (req, res) => paymentController.submitWithdrawal(req, res));
cashierRouter.get('/requests', (req, res) => paymentController.getRequests(req, res));

app.use('/api/cashier', cashierRouter);

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

// Health check endpoint (for load balancers & Kubernetes probes)
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'HEALTHY', uptime: process.uptime(), timestamp: Date.now() });
});

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
  app.listen(PORT, () => {
    console.log(`[Seamless Wallet Core] Server listening on port ${PORT}`);
  });
}

export default app;
