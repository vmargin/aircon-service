# Aircon Service Management

Internal tool for an aircon servicing company with multiple branches. Staff log
in, book jobs, dispatch technicians, and bill the work.

**Live demo:** https://aircon-service.vercel.app

**Stack:** Express + Prisma + PostgreSQL, React + Vite + Tailwind, TypeScript
throughout. It deploys as **one service on one URL** — the API also serves the
built frontend, so there is no second host and no CORS to configure.

---

## Run it locally

You need Node 18+ and PostgreSQL 14+ installed.

```bash
git clone https://github.com/vmargin/aircon-service.git
cd aircon-service

npm run setup                      # install backend + frontend deps
npm run local                      # create/use isolated .local data, migrate, seed, build and serve
```

Open **http://localhost:5000**. The local launcher uses its own PostgreSQL
cluster and `arctic_dev`/`arctic_test` databases under `.local`; it does not read
`backend/.env` or connect to cloud data. Keep its terminal open while using the
app. Use `Ctrl+C` to stop the app, then `npm run local:stop` to stop its local
PostgreSQL cluster.

### Demo logins

Seeded only into the isolated local demo database. Password for all listed
accounts is `demo1234`.

| Email              | Access |
| ------------------ | --- |
| `admin@arctic.com` | All branches: Makati, Quezon City, Cavite, and Bulacan |
| `south@arctic.com` | Makati Branch |
| `north@arctic.com` | Quezon City Branch |

The seed is additive and idempotent. Cavite and Bulacan are demo branches with
no seeded staff; assign real branch users before expecting dispatch there.

Use synthetic data only. This is an educational portfolio system, not production
business software.

---

## What's in it

| Page | What you can do |
| --- | --- |
| **Dashboard** | Review today's jobs, dispatch, service trends, and attention items. |
| **Calendar / service jobs** | Schedule work, assign technicians, advance the ordered lifecycle, and open field work orders. |
| **Clients / aircon units** | Keep customer and equipment details, service history, and explicit next-maintenance dates together. |
| **Parts inventory** | Track branch stock, low-stock levels, restocks, adjustments, and parts used on a work order. |
| **Invoices & payments** | Issue one invoice per job and record separate dated receipts with exact amounts. |
| **Reports** | Filter visits and billing by date and branch, review service/technician summaries, see open balances grouped by days since invoice issue, and export billing CSV. Age bands do not imply a due date or overdue status. |
| **Theme** | Switch between the deep-teal dark theme and the cool light theme; the browser saves the choice. |

### Rules the API enforces

- **Two roles.** `ADMIN` sees the whole organization. `BRANCH_LEADER` is scoped
  to their own branch for both reads and writes.
- **Booking lifecycle.** `PENDING → CONFIRMED → ON_SITE → COMPLETED`, with
  cancellation allowed from any open state. Completed and cancelled are final,
  so a job can't skip dispatch or be reopened.
- **A technician can only be assigned to their own branch's jobs.**
- **One invoice per booking**, amounts stored as `Decimal(12,2)` (never floats).
- **Payment only moves forward.** `UNPAID → PARTIAL → PAID`, and `PAID` is
  terminal — collected money can't be quietly un-collected. Reversing a real
  payment belongs in a refund flow with its own trail, not a silent field edit.
- Writes are recorded in an audit log.
- **Field checklist.** Inspection items preserve Pending, Pass, Follow-up, and
  Not applicable outcomes while still reading older checked-only records.
- **Stock ledger.** Restocks, adjustments, and work-order use are branch-scoped,
  transaction-protected, and retry-safe when the client sends the same request key.

---

## Deploy

Any host that runs a Node process and gives you a Postgres database. `railway.json`
is included, so on Railway you add a Postgres service and set two variables:

| Variable       | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| `DATABASE_URL` | your Postgres connection string                                  |
| `JWT_SECRET`   | 32+ random chars — `node backend/scripts/generate-jwt-secret.js` |

Also set `NODE_ENV=production` and `TRUST_PROXY=1`. Then:

```
build:  npm run setup && npm run build
start:  npm run db:deploy --prefix backend && npm start
```

The start command applies migrations, then boots the server, which serves both
the API and the frontend on the same port. Seed the demo users once with
`npm run db:seed --prefix backend`.

Check `/health` after deploying — it returns `MISCONFIGURED` and names any
missing variable rather than failing silently.

---

## Useful commands

```bash
npm run typecheck                    # both packages
npm test                             # backend unit tests
npm run build                        # production build of both
npm run db:studio --prefix backend   # browse the database
npm run db:reset --prefix backend    # wipe, re-migrate, re-seed
```

## Layout

```
backend/
  prisma/schema.prisma    # data model, single squashed migration
  prisma/seed.ts          # idempotent demo data
  src/routes/             # all endpoints, one file
  src/controllers/        # request handling + validation (zod)
  src/lib/tenancy.ts      # the org/branch scoping rules
  src/lib/bookingStatus.ts# the lifecycle state machine
  src/middleware/         # auth, errors, rate limits, logging
frontend/
  src/App.tsx             # routes + app shell
  src/auth/               # login state, token handling
  src/api/api.ts          # axios client, currency/date helpers
  src/components/         # one file per page, plus shared ui/
```

## Deliberately not built yet

Public/customer-facing booking, inventory tracking, technician mobile app,
email/SMS notifications, PDF invoice export. The database and API are shaped to
allow them, but nothing half-finished ships in this repo.
