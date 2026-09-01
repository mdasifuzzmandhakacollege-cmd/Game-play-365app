# Repository Governance & Delivery Pipeline

## 1. Overview & Branch Protection Principles

To maintain strict production reliability, compliance, and supply-chain integrity across the **PLAY369** platform, all changes must pass through a controlled Pull Request (PR) and Continuous Integration (CI) verification gate before reaching production.

### Core Governance Rules

1. **`main` Branch is Protected**:
   - Direct commits or pushes to the `main` branch are strictly forbidden.
   - All production deployments are sourced strictly from verified commits on `main`.

2. **Branching Strategy**:
   - All work must be developed in dedicated feature, bugfix, or chore branches (`feat/*`, `fix/*`, `chore/*`, `sec/*`).
   - Short-lived branches with clear commit history are required.

3. **Mandatory Pull Request Reviews & Quality Gates**:
   - Every merge into `main` must occur via a Pull Request.
   - Pull Requests require passing all CI verification gates across all supported Node.js runtimes (Node 20.x and 22.x).
   - Zero bypass of failing automated tests or security audits.

---

## 2. Automated CI Verification Gates

Every Pull Request and commit to `main` triggers automated verification executing the following fail-closed steps:

| Gate | Command | Description | Failure Policy |
|---|---|---|---|
| **1. Dependency Audit** | `npm audit --audit-level=high` | Automated supply-chain vulnerability scan. | **Fail-closed** on any High or Critical advisory. |
| **2. TypeScript Lint & Typecheck** | `npm run lint` (`tsc --noEmit`) | Strict static type validation. | **Fail-closed** on any type mismatch or lint error. |
| **3. Security & Regression Gate** | `npm test` (`tsx src/server/__tests__/runAllTests.ts`) | Hermetic test suite covering Task A1, A2, A3, and A4 invariants. | **Fail-closed** on any test failure or credential leak. |
| **4. Production Build** | `npm run build` | Full Vite client and esbuild server compilation. | **Fail-closed** on any compilation error. |

---

## 3. Pull Request Protocol & Checklist

When opening a Pull Request, engineers must fill out the standard PR template (`.github/pull_request_template.md`), addressing:
- **Change Summary**: Clear description of functional or technical modifications.
- **Security Impact**: Evaluation of auth, permissions, input sanitization, and data exposure.
- **Database / Schema Impact**: Details of PostgreSQL (Drizzle) or Firestore schema adjustments and backwards compatibility.
- **Rollback Plan**: Concrete procedure to revert changes safely if an issue arises post-merge.
- **Tests Executed**: Evidence of test execution and coverage.
- **Secrets Invariant**: Explicit confirmation that no credentials, tokens, or private keys are introduced.
- **CI Status**: Verification that GitHub Actions CI matrix is completely green.

---

## 4. Code Ownership & Review Boundaries

Code ownership is mapped via `.github/CODEOWNERS` to ensure critical paths receive appropriate oversight:
- **Server & API Controllers**: `/server.ts`, `/src/server/`, `/src/controllers/`
- **Security & Middleware**: `/src/middleware/`, `/src/lib/firebase-admin.ts`, `/firestore.rules`
- **Database & Schemas**: `/src/db/`, `/drizzle/`
- **CI / CD Pipelines**: `/.github/workflows/`

---

## 5. Emergency Hotfix Procedure

In the event of a critical production incident:
1. Create a `hotfix/<incident-id>` branch from the latest stable `main` commit.
2. Apply the minimal necessary patch.
3. Open an expedited PR adhering to the same CI verification gates.
4. Verify all tests and builds pass.
5. Merge into `main` and trigger release validation according to `docs/PRODUCTION_READINESS.md`.
