# Aircon Service Management

Internal tool for an aircon servicing company with multiple branches. Staff log
in, book jobs, dispatch technicians, and bill the work.

**Stack:** Express + Prisma + PostgreSQL, React + Vite + Tailwind, TypeScript
throughout. It deploys as **one service on one URL** — the API also serves the
built frontend, so there is no second host and no CORS to configure.

---

## Run it locally

You need Node 18+ and Docker (for Postgres).

```bash
git clone https://github.com/vmargin/aircon-service.git
cd aircon-service

npm run setup                      # install backend + frontend deps
cp backend/.env.example backend/.env

npm run db:up                      # start Postgres in Docker
npm run db:init                    # migrate + seed the demo data
```

Then run the two dev servers in separate terminals:

```bash
npm run dev        # API on  http://localhost:5000
npm run dev:web    # UI  on  http://localhost:5173
```

Open **http://localhost:5173** and sign in.

### Demo logins

Seeded by `npm run db:init`. Password for all of them is `demo1234`
(override with `DEMO_ADMIN_PASSWORD` before seeding).

| Email              | Sees              |
| ------------------ | ----------------- |
| `admin@arctic.com` | All four branches |
| `north@arctic.com` | North Branch only |
| `south@arctic.com` | South Branch only |
| `east@arctic.com`  | East Branch only  |
| `west@arctic.com`  | West Branch only  |

The seed is idempotent — re-running it will not duplicate or fail.

---

## What's in it

| Page            | What you can do                                                         |
| --------------- | ----------------------------------------------------------------------- |
| **Dashboard**   | Today's jobs, counts by status, revenue collected vs. outstanding       |
| **Bookings**    | Create/edit jobs, assign a technician, advance status, raise an invoice |
| **Customers**   | Add and edit customers, see their booking count                         |
| **Technicians** | Add, edit, deactivate/reactivate field staff                            |
| **Invoices**    | Record payment method and mark unpaid → partial → paid                  |
| **Reports**     | Status/service breakdowns and per-technician collections by date range  |

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
