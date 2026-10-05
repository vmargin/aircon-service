# ARCTIC verification

## Local proof

- `npm run typecheck` — passed for backend and frontend.
- `node scripts/local.cjs test` — all 6 suites and 35 tests passed against the isolated local PostgreSQL test database, including tenant, lifecycle, dispatch concurrency, inventory, receipt and reporting cases.
- `npm run build` — passed; frontend bundle is 459.91KB (139.74KB gzip). Prisma emitted only its existing package.json configuration deprecation warning.
- Playwright — dashboard and operational routes loaded from the local app. At a 320px viewport, the dashboard, calendar, jobs, clients, technicians, units, inventory, billing, reports and settings routes had no page-level horizontal overflow. Wide tables remained independently scrollable. Work-order and booking dialogs closed with Escape and returned focus to their trigger. Browser console reported no errors.

The local launcher used `.local/postgres` and preserved its existing demo data; its seed skipped because the database already contained records. No production database was seeded or reset.

## Deployment boundary

The PostgreSQL migration is additive and is included with the code. Production migration state was not inspected or changed. Railway's start command runs `prisma migrate deploy`; the Vercel build command does not. Verify the target deployment and apply the migration to its intended database before serving the new API against that schema. A Git push alone does not prove that migration or deployment succeeded.

The production JWT-secret guard was also covered by tests: a short production secret makes health and application routes return 503, including in the serverless app path.
