# Aircon Service Manager

A full-stack air conditioning service operations manager with multi-tenant architecture, built with React, Node.js, Express, Prisma, and a relational database (SQLite locally, PostgreSQL/Supabase in production).

## Features

- 🔐 JWT-based authentication
- 🏢 Multi-tenant data isolation
- 📦 CRUD operations for assets
- 🎨 Modern React UI with Tailwind CSS
- 🔒 Secure password hashing (bcrypt)
- 🚀 Deployed on Railway (backend) and Vercel (frontend)

## Tech Stack

**Frontend**

- React 19 (Vite)
- Tailwind CSS 4
- Axios HTTP client
- TanStack Query (server state)

**Backend**

- Node.js + Express 5 (TypeScript)
- Prisma ORM
- SQLite (local dev) / PostgreSQL or Supabase (production)
- JWT authentication
- bcryptjs password hashing

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Supabase)
- npm or yarn

### Local Development

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd aircon-service
   ```

2. **Backend Setup**

   ```bash
   cd backend
   npm install
   # Create .env file (see Environment Variables below)
   npx prisma generate
   npx prisma migrate dev
   npx prisma db seed
   npm run dev
   ```

3. **Frontend Setup**

   ```bash
   cd frontend
   npm install
   # Create .env file (see Environment Variables below)
   npm run dev
   ```

4. **Access the app**
   - Frontend: http://localhost:5173
   - Backend: http://localhost:5000

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/asset_manager
JWT_SECRET=your-super-secret-jwt-key
PORT=5000
NODE_ENV=development
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5000/api
```

## Database Setup

Local development uses Prisma with SQLite by default (see `prisma/schema.prisma`).  
For production, point `DATABASE_URL` at your PostgreSQL/Supabase instance and run the migrations.

### Test Credentials

- **Demo Org Admin**: `admin@acme.com` / `password123`

## Deployment

### Backend (Railway)

1. Connect GitHub repo to Railway
2. Set **Root Directory** to `backend`
3. Set **Start Command** to `npm start`
4. Add environment variables:
   - `DATABASE_URL` (PostgreSQL/Supabase connection string)
   - `JWT_SECRET`
   - `NODE_ENV=production`

### Frontend (Vercel)

1. Connect GitHub repo to Vercel
2. Set **Root Directory** to `frontend`
3. Add environment variable:
   - `VITE_API_URL` (your deployed backend URL + `/api`)

## Project Structure

```
aircon-service/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Route handlers (auth, bookings, invoices, customers, technicians, branches)
│   │   ├── middleware/      # Auth middleware (JWT)
│   │   ├── db/              # Prisma client
│   │   └── server.ts        # Express server
│   └── prisma/
│       ├── schema.prisma    # Database schema
│       └── seed.js          # Seed script
├── frontend/
│   └── src/
│       ├── components/      # React components (Dashboard, Financials, Customers, Login, modals)
│       ├── api/             # Axios configuration
│       └── App.tsx          # Main app component
└── docker-compose.yml       # Local dev services
```

## API Endpoints (summary)

- `POST /api/auth/login` – User login, returns JWT + user payload
- `GET /api/bookings` – List bookings for the current organization/branch
- `POST /api/bookings` – Create a booking
- `PATCH /api/bookings/:id` – Update booking status / assignment
- `GET /api/invoices` – List invoices (scoped by organization/branch)
- `POST /api/invoices` – Create invoice for a booking
- `PATCH /api/invoices/:id/payment` – Update invoice payment status
- `GET /api/customers` – List customers
- `POST /api/customers` – Create customer
- `GET /api/technicians` – List technicians
- `GET /api/branches` – List branches for the current organization

## Security & Data Isolation

- Password hashing with bcrypt
- JWT token authentication with typed payloads
- Multi-tenant data isolation via `organizationId` (and branch scoping for branch leaders)
- Request payload validation with Zod (auth, bookings, invoices, customers)
- CORS configuration with configurable `FRONTEND_URL`

## License

ISC
