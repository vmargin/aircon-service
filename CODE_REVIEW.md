# Arctic — Code Review & Improvement Plan

Reviewed: full repo (backend Express/Prisma/TS, frontend React 19/Vite/Tailwind v4, deploy configs, docs).
Legend: 🔴 = fix now (correctness/security/deploy-breaking) · 🟡 = should fix soon · 🟢 = polish / nice-to-have

---

## 1. What's genuinely good

- **Multi-tenant model is well thought out.** `organizationId` → `branchId` scoping, `UserRole.BRANCH_LEADER` narrowing on nearly every query, and an `AuditLog` table. This is above the level of most portfolio CRUD apps.
- **Real business rules, not just CRUD.** The "Billing Guard" (can't mark `COMPLETED` without an invoice) and the "Technician Branch Guard" are exactly the kind of domain logic that makes a project interesting to talk about.
- **Zod validation at the edge** on most write endpoints, `bcrypt` + JWT, rate limiting, XSS sanitizer, error classes + `catchAsync`, request logging middleware — the security _intent_ is there.
- **Prisma schema is indexed deliberately** (composite `@@index([scheduledAt, status])`, `[branchId, category]`), not just default PKs.
- **Frontend uses TanStack Query properly** — query keys, `invalidateQueries` on mutation success, error surfacing via toast. `ErrorBoundary` exists.

---

## 2. 🔴 Critical — fix these first

### 2.1 You have two Express apps and they disagree

`backend/src/server.ts` (mounts `/api/...`, `PATCH /bookings/:id`) and `backend/src/app.ts` + `routes/index.ts` (mounts `/api/v1/...`, `PUT /bookings/:id`) both exist and export an app.

- The frontend calls `api.patch('/bookings/:id')` against `VITE_API_URL` (`/api`) → only `server.ts` works.
- `app.ts` has all the good stuff (rate limiting, error handler, sanitizer, 404) — `server.ts` has **none** of it. So the app you actually run is the insecure one.
- `vercel.json` points at `backend/src/server.ts`; `railway.json` runs `npm start`. Two deploy targets, two entrypoints.

**Fix:** delete `server.ts`'s route definitions, make it a thin bootstrap:

```ts
// server.ts
import dotenv from "dotenv";
dotenv.config();
import app from "./app";
const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));
```

Then pick one prefix. Keep `/api/v1` (versioning is the right call) and set `VITE_API_URL=.../api/v1`, or keep `/api` — but only one. Align verbs (`PATCH` vs `PUT`) with the frontend and the README table.

### 2.2 Backend `npm start` / `npm run dev` are broken

`backend/package.json`:

```json
"start": "node src/index.js",
"dev":   "nodemon src/index.js"
```

There is no `src/index.js` — this is a TypeScript project. `railway.json` runs `cd backend && npm start`, so **prod deploy cannot boot**.

**Fix:**

```json
"dev": "nodemon --exec ts-node src/server.ts",
"build": "prisma generate && tsc",
"start": "node dist/src/server.js",
"typecheck": "tsc --noEmit"
```

(and add `ts-node`/`nodemon` are already in devDeps ✅). Also `main` should point at `dist/src/server.js`.

### 2.3 Cross-tenant write hole in `createBooking` / `createTechnician`

`createBooking` only checks _branch leaders_. An ADMIN's token is never checked against the `branchId` or `customerId` they submit:

```ts
// current: branchId/customerId taken on faith for ADMIN
const booking = await prisma.booking.create({ data: { ...validation.data, ... } });
```

An admin of Org A can create a booking on **Org B's branch** with **Org B's customer**. Same in `createTechnician` (`branchId` never verified to belong to `user.orgId`) and `updateTechnician` (can move a tech to another org's branch).

**Fix:** always resolve the parent inside the tenant before writing:

```ts
const branch = await prisma.branch.findFirst({
  where: { id: branchId, organizationId: user.orgId },
});
if (!branch) throw new NotFoundError("Branch not found");
const customer = await prisma.customer.findFirst({
  where: { id: customerId, organizationId: user.orgId },
});
if (!customer) throw new NotFoundError("Customer not found");
```

Better: centralise this as a `scopedWhere(user)` helper or Prisma `$extends` client extension so no controller can forget.

### 2.4 `errorHandler` logs request bodies — including passwords

```ts
console.error('Error:', { ..., body: req.body, ... });
```

A failed login logs the plaintext password to your host's log drain. That's a real incident in a real deployment.

**Fix:** redact before logging (`password`, `token`, `authorization`), or drop `body` entirely and log a request id instead.

### 2.5 Global rate limit of 100 req/hour will break your own dashboard

`generalRateLimiter` (100/hr) is applied to **everything**. Loading Dashboard + Financials + Reports fires ~8 requests; a normal session hits 429 in minutes. Also `express-rate-limit` keyed by IP behind Railway/Vercel needs `app.set('trust proxy', 1)` or every user shares one bucket.

**Fix:** raise to ~300–600/15min for authed routes, keep the strict limits on `/auth/login` and `/public/bookings`, key authed limits on `req.user.userId`, and set `trust proxy`.

### 2.6 Public booking: race condition + no transaction + org leak

```ts
let customer = await prisma.customer.findFirst({ where: { phone, organizationId } });
if (!customer) customer = await prisma.customer.create({...});
const booking = await prisma.booking.create({...});
```

- Two simultaneous submits from the same phone create duplicate customers. Add `@@unique([organizationId, phone])` to `Customer` and use `prisma.upsert`.
- Customer + booking aren't in a `prisma.$transaction` — a failure leaves an orphan customer.
- `GET /public/branches` returns **every branch of every organization** with org names. For a multi-tenant product that's a tenant-enumeration leak. Scope it by org slug/subdomain: `/public/:orgSlug/branches`.

### 2.7 Money stored as `Float`

```prisma
amount Float // SQLite doesn't support Decimal, Float is fine for demo
```

The comment is stale — you're on Postgres. Floats lose cents on aggregation (your Reports page sums them). **Use `Decimal @db.Decimal(12,2)`** (or store integer minor units). Also add `currency String @default("PHP")`.

---

## 3. 🟡 Important

### Backend

- **No pagination anywhere.** `getBookings` does `findMany` with 4 `include`s and no `take`. At 10k bookings this is a multi-MB JSON payload. Add `?page&limit&status&from&to&q`, return `{ data, total, page }`, and `select` only the fields the UI renders.
- **No status state machine.** `PENDING → COMPLETED` in one hop is allowed. Define allowed transitions:
  ```ts
  const NEXT: Record<BookingStatus, BookingStatus[]> = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["ON_SITE", "CANCELLED"],
    ON_SITE: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
  };
  ```
- **Prisma errors aren't mapped.** Creating a second invoice for a booking hits the `@unique bookingId` constraint → `P2002` → generic 500. Map `P2002 → 409`, `P2025 → 404`, `P2003 → 400` in `errorHandler`.
- **Inconsistent error style.** Half the controllers `throw new ValidationError(...)`, half `return res.status(400).json(...)`, half wrap everything in `try/catch` that duplicates `catchAsync`. Pick the throw-based style and delete the `try/catch` blocks — `catchAsync` already forwards.
- **`sanitizeInput` is shallow and mislayered.** It only walks top-level keys (nested objects/arrays untouched) and in Express 5 `req.query` is a getter — assigning to it throws. Sanitising _input_ also corrupts legitimate data (`Smith & Sons` → `Smith &amp; Sons`). React already escapes output. Recommendation: **delete it**, add `helmet()` + a CSP instead, and only sanitize where you render raw HTML (you don't).
- **Missing hardening:** no `helmet`, no `compression`, no body-size sanity on non-upload routes (10mb is generous), no `express.urlencoded` need at all for a JSON API.
- **No org check on technician assignment for ADMIN** in `updateBooking` (the guard is branch-leader-only).
- **Auth UX:** 24h JWT, no refresh, no revocation, token in `localStorage`. For a portfolio piece this is defensible — but say so in the README and note the upgrade path (short-lived access token + httpOnly refresh cookie + rotation).
- **`catchAsync(fn: Function)`** loses types; type it as `(req, res, next) => Promise<unknown>`.
- **`app.use('*', ...)`** breaks under Express 5 / path-to-regexp v8. Use `app.use((req,_res,next)=>next(new NotFoundError(...)))`.
- **Version drift:** root `package.json` pins `express@5`, backend pins `express@4`, README says Express 5. The root `package.json` shouldn't have runtime deps at all — it's a workspace shim.
- **Tests:** two integration tests total, no unit tests, no CI. Add tests for the things that are actually hard: tenant isolation (leader can't read other branch), billing guard, status transitions, public booking dedupe. Then a `.github/workflows/ci.yml` running `typecheck → lint → test → build` on push.
- **No API docs.** `zod-to-openapi` + Swagger UI at `/api/v1/docs` is ~40 lines and is a strong portfolio signal.

### Frontend

- **`@tanstack/react-query` and `lucide-react` are in `devDependencies`** but imported by shipped code. On hosts that install with `NODE_ENV=production`, the build fails. Move both to `dependencies`.
- **No router.** `window.location.pathname.startsWith('/book')` in `main.tsx` and `activeTab` in `useState` means: no deep links, no back button, no `/bookings/:id`, no shareable URLs. Add `react-router-dom` with a `PublicLayout` / `AppLayout` split and a `ProtectedRoute`.
- **No 401 interceptor.** When the 24h token expires every query fails silently forever. Add:
  ```ts
  api.interceptors.response.use(
    (r) => r,
    (e) => {
      if (e.response?.status === 401) {
        localStorage.clear();
        location.href = "/login";
      }
      return Promise.reject(e);
    },
  );
  ```
- **Mobile nav is broken.** `<aside>` is `fixed left-0 ... lg:static` with no `-translate-x-full` when `isMenuOpen === false`, so the sidebar covers the content on mobile and the `X` button does nothing visible.
- **`App.tsx` has ~9 unused imports** (`Plus`, `Search`, `Globe`, `TrendingUp`, `Shield`, `Package`, `Zap`, `Card`, `StatusBadge`). Same pattern in `Dashboard.tsx`. Turn on `noUnusedLocals` and make lint fail CI.
- **`any` leaking everywhere** — `(queryError as any).response?.data?.error`, `mutationFn: (data: any)`. Add a typed `getApiError(e: unknown): string` helper and an `ApiError` type.
- **Types are duplicated** between `backend/src/types` and `frontend/src/types.ts` and can silently drift. Extract a `packages/shared` with the Zod schemas and derive both the backend validators and the frontend types from them (`z.infer`).
- **No frontend tests.** Vitest + Testing Library on `Login`, `PublicBooking`, and the status-transition buttons would cover the risky paths.
- **Accessibility:** modals have no focus trap / `role="dialog"` / Esc handler, icon-only buttons have no `aria-label`, the notification bell and "Branch Portal" chip are non-functional decorations. Also `text-[9px]` + `opacity-0 group-hover:opacity-100` nav descriptions are unreadable/unreachable by keyboard.
- **Dashboard.tsx is 418 lines** with 7 `useState`s. Split into `<BookingFilters>`, `<BookingTable>`, `<BookingRow>` and a `useBookings()` hook.

### Repo hygiene

- 🔴 **Delete the committed debug dumps:** `backend/auth_error.txt`, `booking_error.txt`, `booking_error_2.txt`, `prisma_error.txt`, `prisma_final_error.txt`, `prisma_output.txt`, `integration_results.txt`, `frontend/ts-errors3.txt`, `ts-errors4.txt`, `lint_errors.txt`. These are the first thing a reviewer sees and they read as "unfinished". Add `*_error*.txt`, `ts-errors*.txt`, `lint_errors.txt` to `.gitignore`.
- **Consolidate the docs.** `README.md`, `SYSTEM_OVERVIEW.md`, `ARCHITECTURE_AND_INTERVIEW_GUIDE.md`, `PROPOSAL.md`, `PROPOSAL1.md`, `GITHUB_PROFILE_README.md`, `DEPLOYMENT.md` overlap heavily and already contradict each other (Express 4 vs 5, `/api` vs `/api/v1`). Keep `README.md` + `docs/ARCHITECTURE.md` + `docs/DEPLOYMENT.md`; delete `PROPOSAL1.md`.
- **`docker-compose.yml`** only has Postgres and the DB is named `asset_manager` (leftover from a previous project). Add `backend` + `frontend` services and an `adminer`, so `docker compose up` gives a working stack — that's a great README bullet.
- **Pick one deploy story.** `vercel.json` (root, builds `backend/src/server.ts` with `@vercel/node`) + `backend/vercel.json` + `railway.json` + `.railwayignore` all coexist. Railway (API) + Vercel (SPA) is the cleaner split — delete the root `vercel.json` API build.
- **`.gitignore` line `backend/prisma/migrations/*.sql`** is risky — migrations must be committed for reproducible deploys. The negation below saves you, but simplify to just not ignoring migrations at all.
- **No `.env.example` for the frontend**, and the backend one should list every var the code reads (`RATE_LIMIT_*`, `AUDIT_LOG_ENABLED`, `FRONTEND_URL`).

---

## 4. 🟢 Product ideas that would make this stand out

The schema already has `Inventory` + `InventoryUsage` with **no controller, no routes, no UI** — finish it, it's the most differentiated feature you have:

1. **Parts consumption per job** → auto-add parts cost to the invoice, low-stock alerts (`quantity < minQuantity`) on the dashboard.
2. **Technician availability / double-booking guard** — reject two bookings for the same tech in an overlapping window. Cheap to build, very demo-able.
3. **Recurring maintenance contracts** (quarterly cleaning) → auto-generate next booking on completion. This is _the_ real aircon-service business model.
4. **Customer-facing booking status page** at `/track/:id` (you already have `qrcode.react` + `jspdf` installed) — QR on the invoice PDF links to it.
5. **Reports:** revenue by branch/month, technician job counts, avg time PENDING→COMPLETED, collection rate (PAID/total).
6. **Notifications:** SMS/email on confirm + day-before reminder (queue-backed, e.g. BullMQ or a simple `ScheduledJob` table + cron).

---

## 5. Suggested order of work

| #   | Task                                                                            | Why                                     |
| --- | ------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | Delete debug `.txt` dumps, fix `.gitignore`                                     | 5 minutes, biggest first-impression win |
| 2   | Single app entrypoint (`app.ts`), fix `start`/`dev`/`build` scripts             | Deploy is currently broken              |
| 3   | Tenant-scope every write (`branchId`/`customerId`/`technicianId`)               | Security bug                            |
| 4   | Redact log bodies, add `helmet`, fix rate limits + `trust proxy`                | Security                                |
| 5   | `Decimal` money + `@@unique([organizationId, phone])` + `$transaction` + upsert | Data correctness                        |
| 6   | Pagination + filters on bookings/invoices                                       | Scalability                             |
| 7   | react-router + 401 interceptor + move deps out of devDeps                       | Frontend correctness                    |
| 8   | Prisma error mapping, status state machine, consistent error style              | Robustness                              |
| 9   | Tests for tenant isolation + guards, then GitHub Actions CI                     | Credibility                             |
| 10  | Docs consolidation + OpenAPI at `/api/v1/docs`                                  | Presentation                            |
| 11  | Design system pass (see below) + finish Inventory                               | Differentiation                         |

---

## 6. Design workflow with Figma

**Status:** `Figma MCP` is present in your Cline MCP settings (`https://mcp.figma.com/mcp`, `streamableHttp`, not disabled), but **its tools aren't exposed to me in this session** — meaning the server hasn't completed its handshake/OAuth yet. To connect:

- **Remote server** (what you configured): open Cline's **MCP Servers** panel and click the Figma entry — it should trigger a browser OAuth consent. Requires a Figma **Dev/Full seat** on a paid plan. Restart the MCP server after authorising.
- **Local alternative** (often easier): Figma **desktop app** → open a file → menu **Figma → Preferences → Enable local MCP server**, then point the config at `http://127.0.0.1:3845/mcp`.
- Once connected I'll get tools like `get_code` / `get_design_context`, `get_variable_defs`, `get_image`, `get_screenshot` — they operate on your **current Figma selection**, so the workflow is: select a frame in Figma → tell me "build this" → I pull the design context and generate the React/Tailwind.

**How I'd use it on this project (once it's live):**

1. **Extract tokens first, not components.** Pull `get_variable_defs` from your Figma variables and generate a Tailwind v4 `@theme` block in `frontend/src/index.css` — colors, radii, spacing, shadows, font sizes. Right now every colour is hardcoded (`from-slate-900`, `blue-600`, `text-[9px]`, `shadow-blue-200`) across ~12 files; tokens make a restyle a one-file change.
   ```css
   @import "tailwindcss";
   @theme {
     --color-brand-500: #2563eb;
     --color-surface: #f8fafc;
     --radius-card: 0.75rem;
   }
   ```
2. **Design the primitives in Figma, then generate them** into `src/components/ui/`: `Button` (variants/sizes/loading), `Input`, `Select`, `Modal` (with focus trap), `Table`, `EmptyState`, `Skeleton`, `Card`, `StatusBadge`. You only have `Card`, `StatusBadge`, `Toast` today, which is why layout classes are copy-pasted everywhere.
3. **Then screens**, in this order — highest visual payoff first:
   - `PublicBooking` (the only page a customer sees — should look like a product, not an admin form)
   - `Login`
   - `Dashboard` list + row + filter bar
   - `Reports` (charts — consider `recharts`)
   - Invoice PDF layout (you have `jspdf`/`pdfkit`)
4. **Keep a `docs/DESIGN.md`** mapping Figma component name → React component path, so regenerating a frame doesn't create duplicates.
5. **Mobile first for the technician view.** Technicians work from phones; a `/tech` route with today's jobs + one-tap status updates is a genuinely useful screen and a great Figma exercise.

**Nudge:** design the _empty_, _loading_, and _error_ states in Figma too. Your components currently jump straight from spinner to table, and there's no empty state when a branch has zero bookings.

---

## 7. One-line summary

The domain modelling and multi-tenant thinking here are genuinely strong — what's holding it back is **duplication drift** (two servers, two route prefixes, seven overlapping docs, deps in three `package.json`s) and a handful of **tenant-scoping and money-precision bugs**. Consolidate to one app, one prefix, one deploy path, close the cross-org write hole, then spend the design effort on the public booking page and the unfinished Inventory feature.
