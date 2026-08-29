# PLAY369 Project Checkpoint

Last updated: 2026-08-29
Branch: `main`

## Purpose
This file is the persistent source-of-truth checkpoint for PLAY369. Before assigning any new implementation task, verify the latest GitHub `main` state and continue from this checkpoint instead of restarting or repeating completed work.

## Current Status

### Completed foundation
- React/Vite PLAY369 frontend with Emerald/Gold visual system.
- Authentication and authenticated app shell.
- Game lobby/provider-adapter foundation.
- Server-side provider gateway with validation, masking, correlation IDs and timeout boundary.
- PostgreSQL wallet-ledger foundation with ACID transaction pattern, row-level locking, idempotency and immutable ledger records.
- Security-hardening work: Firestore restrictions, HMAC secret handling, secret removal from code, stricter webhook validation.
- Live deployment/white-page stabilization work completed earlier.
- Demo/mock user-facing financial/profile data cleanup completed and pushed.
- New-user zero-state behavior implemented.
- Affiliate empty-state and promotion eligibility moved toward real database-backed state.

### Verified GitHub checkpoints
- `67557706e4e6cde8f46602e41a717465a291eb42` — remove mock state / use live user data.
- `0c35f9b468349850bb4dad822074c49a2faf6f65` — promotion state moved from localStorage toward authoritative server/database state.

## CURRENT ACTIVE TASK — DO NOT SKIP

### Task 1.1: Promotion / Reward Integrity Fix
Status: **IN PROGRESS**

Required completion criteria:
1. Remove all client-side financial fallbacks.
2. If check-in API fails, frontend must not credit any wallet.
3. If spin API fails, frontend must not generate a prize or credit a wallet.
4. Frontend must never use simulated wallet top-up for real rewards.
5. Server/database is the sole authority for reward state and reward credit.
6. Remove unsafe user-ID fallback mapping (`|| 1`, derived numeric fallback IDs, synthetic user mapping).
7. Unknown users must return an error with zero mutation.
8. Enforce daily spin limit inside the same server transaction that executes the spin.
9. Reward credit must flow through the authoritative ACID wallet/ledger path.
10. Reward operations must use idempotency, row-level locking and integer/minor-unit money math.
11. Verify duplicate check-in, duplicate spin, unknown-user, API-failure, and concurrent/double-click behavior.
12. Run lint + production build + relevant tests.

Do not start the next phase until Task 1.1 is verified from GitHub `main`.

## Planned Next Steps

### Task 2 — Affiliate System Productionization
- Server-authoritative referral codes and referral hierarchy.
- No client-supplied trusted user identity; resolve from authenticated server context.
- Durable referral relationships in PostgreSQL.
- Commission accrual only from valid settled game/bet events.
- Commission calculation with integer/minor-unit money math.
- Idempotent commission events keyed to source transaction.
- Claim commissions through the authoritative wallet ledger, not direct balance mutation.
- Row locks / ACID transaction for claims.
- Real-time zero/empty states in UI.

### Task 3 — Rewards / Daily Tasks / Offers Claim Control
- Server-authoritative eligibility and claim limits.
- One-time/daily/weekly claim rules enforced in DB, not UI.
- Durable claim records and unique constraints to block repeat claims.
- Idempotency for all reward claims.
- Wagering/turnover requirements backed by real ledger/game events.
- Expiry, cooldown and status transitions enforced server-side.
- No unlimited claims or synthetic reward state.

### Task 4 — Wallet / Cashier Production Integrity
- New user starts at real balance 0.
- Deposit/withdraw actions use authoritative ledger only.
- No auto-approve or client-driven credit.
- Local payment webhook verification with strict signatures and durable idempotency.
- Integer/minor-unit monetary math only.
- Real-time transaction history and wallet state from authoritative backend.

### Task 5 — Provider Sandbox Readiness
- Only after core wallet/rewards/affiliate integrity passes.
- Request sandbox/test credentials, callback registration and currency from provider.
- Keep test/sandbox only at first.
- No production deposit/payment commitment until technical and commercial due diligence is complete.

### Task 6 — Seamless Wallet Provider Integration
Implement provider contract exactly from documentation, one endpoint at a time:
- `/balance`
- `/bet`
- `/win`
- `/refund`

Requirements:
- HMAC SHA-256 validation.
- Replay/timestamp protection.
- Strict transaction idempotency.
- `SELECT ... FOR UPDATE` where financial state changes.
- Authoritative PostgreSQL ledger.
- Provider response SLA target under 4 seconds.
- Duplicate/retry/rollback/concurrency tests.

### Task 7 — Production UI / Mobile Polish
After financial and provider core is stable:
- Premium Emerald Green & Gold design pass.
- Mobile-first Capacitor optimization.
- 48px touch targets and safe-area handling.
- Profile/navigation discoverability.
- Real loading/empty/error states.
- Remove all remaining fake counters, fake activity and placeholder financial values.
- Code splitting/performance work.
- PWA favicon/manifest/app icons and Android app icon package.

### Task 8 — Final Audit / Staging / Production Gate
- Registration/login/session persistence.
- New-user zero wallet.
- Deposit/withdraw webhook tests.
- Affiliate accrual/claim tests.
- Daily reward anti-repeat tests.
- Provider sandbox launch and seamless-wallet transaction tests.
- Security audit for secrets, HMAC, Firestore, SQL/DB and logs.
- Load/concurrency/idempotency tests.
- Production build and live-route verification.

## Working Rules
- Use small micro-prompts, one scoped task at a time.
- Do not repeat already completed work unless GitHub verification shows regression.
- GitHub `main` is the implementation source of truth; screenshots/reports are not enough by themselves.
- Before moving to a new task, verify the relevant files/commit in GitHub.
- Do not enter real provider secrets before the provider-integration phase.
- Do not enable real-money production flows until wallet/payment/security readiness is verified.
- Never allow client-side code to authoritatively credit/debit financial balances or rewards.
- Never use floating-point arithmetic for authoritative money movement.
- Maintain ACID, row locking, idempotency and HMAC requirements throughout.

## Resume Rule
When asked "where are we now?" or "what is the next task?":
1. Read this checkpoint.
2. Inspect latest GitHub `main` commits/files.
3. Confirm whether Task 1.1 is complete.
4. If complete, proceed to Task 2. Otherwise continue Task 1.1 only.
