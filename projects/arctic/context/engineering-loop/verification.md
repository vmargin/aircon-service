# ARCTIC verification

## Local proof

- `node scripts/local.cjs setup` — isolated `arctic_dev` reported three migrations and no pending migration; the demo seed preserved existing records. Inventory and report branch selectors show Makati, Quezon City, Cavite, and Bulacan.
- `npm run typecheck` — passed for backend and frontend.
- `npm test` — 5 suites and 26 tests passed; the repository's 1 database suite and 9 dependent tests are intentionally skipped without the isolated test database.
- `node scripts/local.cjs test` — all 6 suites and 35 tests passed against isolated `arctic_test`, including tenant, lifecycle, dispatch concurrency, required idempotency keys, replay/conflict, inventory balance and audit, receipt, and reporting cases.
- `npm run build` — passed; frontend bundle is 469.69KB (142.58KB gzip). Prisma emitted its existing `package.json#prisma` deprecation warning.
- Playwright — the local authenticated app loaded in both themes. The preference survives page reload; representative text, navigation, button and status colors meet 4.5:1 contrast. The work-order checklist exposes Pending, Pass, Follow-up required, and Not applicable. All core routes (dashboard, calendar, service jobs, clients, technicians, units, inventory, invoices, reports, and settings) fit a 320px viewport with no page-level horizontal overflow; wide tables remain independently scrollable. The report lists all four branches and filters open balance age by branch while keeping all invoice issue dates in scope. Its age bands are issue-date-only, unknown balances are excluded and flagged, and it does not label invoices overdue. At 320px the report has no page overflow. Inventory dialog and mobile navigation kept focus inside while open, closed with Escape, and returned focus to their triggers. Browser console reported no errors or warnings.
- Sauron code inspection — requirements align with the research and architecture records; branch/tenant checks, transaction locks, audit writes, append-only stock history, and additive migration boundaries remain in their existing server-owned layers. No critical or important implementation issues were found. The production database was not inspected or migrated; a deployment must apply the new additive migration before using the updated API.
- The local launcher was corrected to build production frontend assets while keeping the API in development mode. `node scripts/local.cjs start` now serves the optimized 467KB bundle at `http://localhost:5000`.

The local launcher uses `.local/postgres`; existing demo records were preserved and only missing named demo branches may be added. No production database was seeded or reset.

## Deployment boundary

The PostgreSQL migration is additive and is included with the code. Production migration state was not inspected or changed. Railway's start command runs `prisma migrate deploy`; the Vercel build command does not. Verify the target deployment and apply the migration to its intended database before serving the new API against that schema. A Git push alone does not prove that migration or deployment succeeded.

## Branch delivery

- Feature implementation commit `aa3eddcc62218511ed6cac1f78408c988bf98b05` was pushed to `origin/codex/aircon-service-operations` and verified with `git ls-remote`.
- `origin/master` remains at `e34d30bbb5751b35b625775a53d5c1aa1121e9c2`. No production deployment or production database change was made.

The production JWT-secret guard was also covered by tests: a short production secret makes health and application routes return 503, including in the serverless app path.

## Final verification refresh — 2026-10-06

- The current branch is `codex/aircon-service-operations`, based on the existing repository. The local app at `http://localhost:5000` remained running; no production migration, seed, or deployment was performed.
- `npm.cmd run typecheck` passed for backend and frontend. `npm.cmd test` passed 29 unit tests; 12 database tests were skipped in that mode. `npm.cmd run test:integration` passed all 7 suites and 41 tests against isolated `127.0.0.1:5433/arctic_test`; Prisma reported five migrations applied and no pending migrations.
- `npm.cmd run build --prefix frontend` passed (Vite reports a 541.76 kB JavaScript chunk, 159.35 kB gzip). A direct backend TypeScript emit passed. The full backend package build stopped at `prisma generate` with Windows `EPERM` renaming `query_engine-windows.dll.node`; the running app was left untouched.
- Playwright verified the authenticated service desk, all four branch options, the new-request dialog at desktop and 320px without page-level horizontal overflow, and the theme toggle in both modes with light mode restored. An on-site job marked Not billed exposed both Complete job and Create invoice. No form was submitted; browser console had no errors or warnings.
- Added integration cases cover branch-leader request/booking writes for same-branch history and rejection of foreign/ambiguous units, branch-limited maintenance reporting, unit/site reassignment guards after history exists, site-linked unit updates, and completion before invoicing. All passed in the isolated run.
- Sauron CLI `fitness --dry-run` passed with zero findings. `trace-report` found no trace file; no traced Fellowship execution is claimed. `git diff --check` passed; Git emitted only line-ending normalization warnings.
