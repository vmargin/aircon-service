# Arctic — Aircon Service Manager

A full-stack **air conditioning service operations manager** with **multi-tenant architecture**, role-based branch scoping, and audit logging. Built with React, Node.js, Express, Prisma, and PostgreSQL.

## Features

- **JWT authentication** with bcrypt password hashing
- **Multi-tenant data isolation** by organization and branch
- **Role-based access:** Admin (org-wide) and Branch Leader (branch-scoped)
- **Bookings lifecycle:** Pending → Confirmed → On-site → Completed (with invoice guard)
- **Invoicing & payments:** Create invoices per booking; track UNPAID / PARTIAL / PAID
- **Technician assignment:** Branch-scoped; soft-deactivate with audit trail
- **Public API:** Unauthenticated branch list and booking submission (find/create customer by phone)
- **Audit logging** for bookings, invoices, and technician actions
- **Modern React UI** with Tailwind CSS, TanStack Query, and typed API client

## Tech Stack

| Layer      | Technologies |
|-----------|--------------|
| **Frontend** | React 19 (Vite), TypeScript, Tailwind CSS, Axios, TanStack Query |
| **Backend**  | Node.js, Express 5, TypeScript, Prisma ORM |
| **Database** | PostgreSQL (e.g. Supabase) |
| **Auth**     | JWT, bcryptjs |
| **Validation** | Zod (request bodies) |

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (or Supabase)
- npm or yarn

### 1. Clone and install

```bash
git clone https://github.com/vmargin/aircon-service.git
cd aircon-service
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # or create .env (see below)
npx prisma generate
npx prisma migrate dev
npx prisma db seed     # if seed script exists
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
# Create .env with VITE_API_URL=http://localhost:5000/api
npm run dev
```

- **Frontend:** http://localhost:5173  
- **Backend:** http://localhost:5000  

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your-secret-key
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000/api
```

## Project Structure

```
aircon-service/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma    # Models: Organization, Branch, User, Customer, Booking, Invoice, Technician, AuditLog
│   │   └── migrations/
│   └── src/
│       ├── controllers/    # auth, booking, invoice, customer, technician, public
│       ├── middleware/     # JWT authenticate
│       ├── lib/            # auditLog
│       ├── db/             # Prisma client
│       ├── types/          # AuthUser, Express Request extension
│       └── server.ts       # Express app and routes
├── frontend/
│   └── src/
│       ├── components/     # Dashboard, Financials, Customers, Technicians, Reports, Login, modals
│       ├── api/            # Axios instance + Bearer token interceptor
│       ├── types.ts        # Shared TS types
│       └── App.tsx
└── ARCHITECTURE_AND_INTERVIEW_GUIDE.md   # Processes, flow, and interview notes
```

## API Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST   | `/api/auth/login` | No | Login; returns JWT + user |
| GET    | `/api/public/branches` | No | List branches (public) |
| POST   | `/api/public/bookings` | No | Submit booking (find/create customer by phone) |
| GET    | `/api/bookings` | Yes | List bookings (org/branch-scoped) |
| POST   | `/api/bookings` | Yes | Create booking |
| PATCH  | `/api/bookings/:id` | Yes | Update status / assign technician |
| GET/POST | `/api/invoices` | Yes | List / create invoices |
| PATCH  | `/api/invoices/:id/payment` | Yes | Update payment status |
| GET/POST | `/api/customers` | Yes | List / create customers |
| GET/POST/PATCH/DELETE | `/api/technicians` | Yes | Technicians (delete = soft-deactivate) |
| GET    | `/api/branches` | Yes | List branches (scoped by role) |

## Security & Data Isolation

- **Authentication:** JWT in `Authorization: Bearer <token>`; 24h expiry.
- **Authorization:** Every protected controller checks `req.user.orgId` and, for Branch Leader, `req.user.branchId`.
- **Validation:** Zod schemas on login, bookings, invoices, customers, and public booking.
- **Audit:** `AuditLog` records who did what (e.g. BOOKING_CREATE, INVOICE_PAYMENT_UPDATE, TECHNICIAN_DEACTIVATE).

## Documentation for Interviews & Learning

See **[ARCHITECTURE_AND_INTERVIEW_GUIDE.md](./ARCHITECTURE_AND_INTERVIEW_GUIDE.md)** for:

- End-to-end request flow (login, protected routes, public booking)
- Data model and relationships
- RBAC and business rules (billing guard, technician branch guard)
- Key backend functions and API summary
- Frontend state and TanStack Query usage
- Interview talking points

## Deployment

- **Backend:** e.g. Railway — set root to `backend`, add `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`.
- **Frontend:** e.g. Vercel — set root to `frontend`, set `VITE_API_URL` to your backend API base (e.g. `https://your-api.railway.app/api`).

## License

ISC
