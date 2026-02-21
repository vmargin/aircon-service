# Aircon Service — Architecture & Interview Guide

This document explains **processes, data flow, security, and design decisions** so you can speak confidently in interviews and use it for learning. Focus is on what hiring managers and technical interviewers care about.

---

## 1. Are My Changes Pushed?

**No.** Your latest changes are **not pushed**. You have:

- **Modified (unstaged):** `schema.prisma`, `authController`, `bookingController`, `invoiceController`, `technicianController`, `App.tsx`, `AssignTechnicianModal.tsx`, `types.ts`
- **Untracked:** `backend/prisma/migrations/20260216014333_add_audit_log/`, `backend/src/lib/`

To push everything:

```bash
git add -A
git commit -m "Add audit logging; branch-scoped RBAC; tenancy fixes"
git push origin master
```

---

## 2. High-Level Architecture (Interview Summary)

- **Stack:** React (Vite) + TypeScript frontend; Node.js + Express + Prisma (PostgreSQL) backend.
- **Auth:** JWT in `Authorization: Bearer <token>`; middleware attaches `req.user` (userId, orgId, role, branchId).
- **Multi-tenancy:** Data isolated by `organizationId`; branch leaders further restricted by `branchId`.
- **Roles:** `ADMIN` (org-wide), `BRANCH_LEADER` (branch-only). No separate “super admin”; first user/seed defines org.
- **Audit:** Critical actions (booking create/update, invoice create/payment, technician create/update/deactivate) logged to `AuditLog` with userId, action, resourceType, resourceId, branchId.

**One-liner for interviews:**  
*“It’s a multi-tenant AC service manager: JWT auth, role-based branch scoping, audit logging, and a React dashboard that talks to a typed Express API with Prisma and Zod validation.”*

---

## 3. Data Model & Relationships (Schema Fundamentals)

- **Organization** → has many **Branch**, **User**, **Customer**.
- **Branch** → has many **User**, **Technician**, **Booking**.
- **User** → belongs to **Organization**, optional **Branch**; has many **AuditLog**.
- **Customer** → belongs to **Organization**; has many **Booking**.
- **Booking** → belongs to **Customer**, **Branch**; optional **Technician**; has one **Invoice**.
- **Invoice** → belongs to **Booking** (1:1).
- **Technician** → belongs to **Branch**; soft-deleted via `isActive: false`.
- **AuditLog** → belongs to **User**; stores action, resourceType, resourceId, branchId, details.

**Enums:** `UserRole` (ADMIN, BRANCH_LEADER), `BookingStatus` (PENDING → CONFIRMED → ON_SITE → COMPLETED / CANCELLED), `PaymentStatus` (UNPAID, PARTIAL, PAID).

**Interview tip:** Be able to draw Organization → Branch → Bookings/Technicians and explain why customers are org-scoped (reuse across branches) while bookings are branch-scoped.

---

## 4. Request Flow (End-to-End)

### 4.1 Login

1. **Frontend:** POST `/api/auth/login` with `{ email, password }`.
2. **Backend:** Zod validates body → find user by email → `bcrypt.compare(password, user.password)` → build JWT payload `{ userId, orgId, role, branchId }` → sign with `JWT_SECRET`, expire 24h → return `{ token, user }`.
3. **Frontend:** Store `token` and `user` in `localStorage`; redirect to dashboard.

### 4.2 Protected API Calls

1. **Frontend:** Axios interceptor adds `Authorization: Bearer <token>` to every request (see `frontend/src/api/api.ts`).
2. **Backend:** `authenticate` middleware runs first: read token → `jwt.verify(token, JWT_SECRET)` → attach `decoded` as `req.user` (typed as `AuthUser`).
3. **Controller:** Uses `req.user.orgId` and optionally `req.user.branchId` to scope queries (e.g. `where: { branch: { organizationId: user.orgId } }` and, for branch leaders, `branchId: user.branchId`).

### 4.3 Creating a Booking (Authenticated)

1. **Frontend:** POST `/api/bookings` with `{ customerId, serviceType, scheduledAt, branchId, technicianId? }`.
2. **Backend:** Zod validates → if BRANCH_LEADER, enforce `branchId === user.branchId` → `prisma.booking.create(...)` → `logAudit(req, 'BOOKING_CREATE', 'booking', id, branchId)` → 201 + booking.

### 4.4 Public Booking (No Auth)

1. **Frontend (e.g. public form):** POST `/api/public/bookings` with `{ customerName, phone, address?, serviceType, scheduledAt, branchId }`.
2. **Backend:** Zod validates → find branch → find or create customer by `phone` + `organizationId` → create booking for that branch (no technician) → 201.

**Interview tip:** Explain the difference: internal app uses JWT and branch scoping; public API is unauthenticated and creates/finds customer by phone for that org.

---

## 5. Security & Authorization (RBAC)

- **Authentication:** JWT only; no session store. Token contains `userId`, `orgId`, `role`, `branchId`.
- **Authorization (backend):**
  - **ADMIN:** Can access all branches of their org (`organizationId = user.orgId`).
  - **BRANCH_LEADER:** All queries filtered by `branchId = user.branchId`; cannot create/update resources for other branches; cannot assign technicians from another branch.
- **Guards implemented in controllers:**
  - Booking: branch leader cannot create booking for another branch; cannot set COMPLETED without an invoice (“Billing Guard”); can only assign technicians from own branch.
  - Invoice: branch leader can only create/update invoices for their branch’s bookings.
  - Technician: branch leader can only CRUD technicians in their branch; “delete” is soft (isActive = false) and audit-logged.
- **Validation:** Zod on all inputs (login, booking create/update, invoice create/payment, customer create, public booking).

**Interview tip:** Say you use “defense in depth”: middleware for authentication, then per-controller checks for organization and branch so that even if a route is misused, data is still scoped.

---

## 6. Audit Logging

- **Location:** `backend/src/lib/auditLog.ts` — `logAudit(req, action, resourceType, resourceId, branchId?, details?)`.
- **Behavior:** Reads `req.user.userId`; does not throw (failures only logged to console); writes to `AuditLog` table.
- **Used in:** Booking create/update, invoice create, invoice payment update, technician create/update, technician deactivate.
- **Schema:** `userId`, `action`, `resourceType`, `resourceId`, `branchId`, `details`, `createdAt`.

**Interview tip:** “We log who did what to which resource and at which branch for compliance and debugging, without blocking the main flow if logging fails.”

---

## 7. Key Backend Functions (Cheat Sheet)

| File | Function | Purpose |
|------|----------|---------|
| `authController` | `login` | Validate credentials, issue JWT, return user summary |
| `middleware/auth` | `authenticate` | Verify JWT, set `req.user` |
| `bookingController` | `getBookings` | List bookings (org/branch-scoped) |
| `bookingController` | `createBooking` | Create booking; branch guard; audit |
| `bookingController` | `updateBooking` | Update status/technician/scheduledAt; billing guard; technician branch guard; audit |
| `invoiceController` | `getInvoices` | List invoices (org/branch-scoped) |
| `invoiceController` | `createInvoice` | Create invoice for booking; branch guard; audit |
| `invoiceController` | `updatePaymentStatus` | Set payment status/paidAt; branch guard; audit |
| `technicianController` | `getTechnicians` | List technicians (optional includeInactive); branch filter |
| `technicianController` | `createTechnician` | Create technician; branch leader can only create for own branch |
| `technicianController` | `updateTechnician` | Update technician; branch guard; audit |
| `technicianController` | `deleteTechnician` | Soft-deactivate; branch guard; audit |
| `technicianController` | `getBranches` | List branches (org-scoped; branch leader sees only own) |
| `customerController` | `getCustomers` / `createCustomer` | Org-scoped list/create |
| `publicController` | `getPublicBranches` | List branches with org name (no auth) |
| `publicController` | `createPublicBooking` | Find/create customer by phone, create booking (no auth) |
| `lib/auditLog` | `logAudit` | Write audit record from `req.user` |

---

## 8. Frontend Flow & State

- **Auth state:** `user` in React state; hydrated from `localStorage` on load; cleared on logout (token + user removed).
- **API client:** Single Axios instance (`api`); baseURL from `VITE_API_URL`; request interceptor adds Bearer token.
- **Server state:** TanStack Query — e.g. `queryKey: ['bookings']`, `['technicians', 'active']`; mutations invalidate relevant queries so lists refresh.
- **Screens:** Dashboard (bookings, status updates, assign technician, create invoice), Financials, Customers, Technicians, Reports; tab state in `App.tsx`.
- **Assign Technician modal:** Fetches technicians (filtered by backend + client-side RBAC); shows “local” vs other branch; branch mismatch message for branch leaders; mutation PATCH `/bookings/:id` with `technicianId`.

**Interview tip:** “We use TanStack Query for server state and cache invalidation on mutations; auth is stored in memory and localStorage and sent via an Axios interceptor.”

---

## 9. API Endpoints (Quick Reference)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/login` | No | Login; returns JWT + user |
| GET | `/api/public/branches` | No | List branches + org names |
| POST | `/api/public/bookings` | No | Create booking (find/create customer by phone) |
| GET | `/api/health` | No | Health check |
| GET/POST | `/api/bookings` | Yes | List / create bookings |
| PATCH | `/api/bookings/:id` | Yes | Update booking (status, technician, date) |
| GET/POST | `/api/invoices` | Yes | List / create invoices |
| PATCH | `/api/invoices/:id/payment` | Yes | Update payment status |
| GET/POST | `/api/customers` | Yes | List / create customers |
| GET/POST/PATCH/DELETE | `/api/technicians` | Yes | List / create / update / soft-delete technicians |
| GET | `/api/branches` | Yes | List branches (scoped by role) |

---

## 10. Interview Talking Points (Most Important for Getting Hired)

1. **Multi-tenancy:** “Data is isolated by organization and, for branch leaders, by branch. Every query that returns or mutates data applies `organizationId` and, when the user is a branch leader, `branchId`.”
2. **Security:** “JWT for authentication; authorization is role + branch in controllers. We validate all inputs with Zod and never trust client for org/branch.”
3. **Business rules:** “A booking can’t be marked COMPLETED without an invoice. Technicians are scoped to a branch; branch leaders can only assign technicians from their branch.”
4. **Auditability:** “We log create/update/deactivate actions to an AuditLog with user, action, resource type and id, and branch, so we can trace changes.”
5. **Public vs internal API:** “Internal dashboard uses JWT and full RBAC. Public booking endpoint is unauthenticated and finds or creates the customer by phone within the booking’s organization.”
6. **Type safety:** “Backend is TypeScript with Prisma types and Zod; Express `req.user` is typed via declaration merging; frontend types mirror the API.”
7. **Scalability:** “PostgreSQL and Prisma scale with indexes on org/branch; we could add pagination and rate limiting next.”

Use this doc to review flows before interviews and to explain your design decisions clearly.
