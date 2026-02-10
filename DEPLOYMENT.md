## Aircon Service Manager – Cloud Deployment Guide (Supabase + Backend Host + Vercel)

This guide explains how to deploy the **Aircon Service Manager** using:

- **Database**: Supabase PostgreSQL  
- **Backend API**: Node/Express/Prisma (e.g. on Railway or a similar Node host)  
- **Frontend**: React + Vite on Vercel

You already have:

- Supabase project: `https://supabase.com/dashboard/project/vawxkkeodnqyrzqvedsn`
- Vercel app: `https://aircon-service-esyzjxsp9-vmargins-projects.vercel.app/`

Replace `YOUR_BACKEND_URL` with the actual deployed backend URL when you have it.

---

## 1. Supabase – Database Setup

1. Open your Supabase project:
   - `https://supabase.com/dashboard/project/vawxkkeodnqyrzqvedsn`
2. Go to **Settings → Database → Connection string**.
3. Copy the **Postgres connection URL**, for example:

   ```env
   postgresql://postgres.vawxkkeodnqyrzqvedsn:postgres1221@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres
   ```

4. This value will be used as the backend `DATABASE_URL` environment variable.

> Prisma migrations in `backend/prisma/migrations` define the schema. You do **not** need to paste SQL manually into Supabase.

---

## 2. Backend API – Deploy Express/Prisma Service

The backend lives in the `backend/` folder and exposes all `/api/...` endpoints.

### 2.1. Backend code overview

- `backend/src/server.ts` – Express server entrypoint
- `backend/src/controllers/*` – route handlers (auth, bookings, invoices, customers, technicians, inventory, public booking, etc.)
- `backend/prisma/schema.prisma` – database schema
- `backend/prisma/migrations/` – Prisma migrations for schema evolution
- `backend/package.json` – scripts:

  ```json
  {
    "scripts": {
      "start": "node dist/server.js",
      "dev": "nodemon --exec ts-node src/server.ts",
      "build": "prisma generate && tsc",
      "postinstall": "prisma generate"
    }
  }
  ```

### 2.2. Deploying on a Node host (e.g. Railway)

Using Railway as a reference:

1. **Create a new Railway project** and connect it to this GitHub repo.
2. In service settings, configure:
   - **Root directory**: `backend`
   - **Build command**:
     ```bash
     npm install && npm run build
     ```
   - **Start command**:
     ```bash
     npm start
     ```

### 2.3. Backend environment variables

Set these environment variables in your backend host:

```env
DATABASE_URL="postgresql://postgres.vawxkkeodnqyrzqvedsn:postgres1221@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
JWT_SECRET="replace-with-a-long-random-string"
NODE_ENV="production"
FRONTEND_URL="https://aircon-service-esyzjxsp9-vmargins-projects.vercel.app"
# Optional if your platform needs a default:
PORT="5000"
```

Notes:

- **`FRONTEND_URL`** is used by `cors()` in `server.ts` to allow only your Vercel origin.
- **Do not commit `DATABASE_URL` or `JWT_SECRET` to git.** They must live only in your host’s env configuration.

### 2.4. Run Prisma migrations and seeds

After the backend builds successfully and environment variables are set, run:

```bash
npx prisma migrate deploy
npx prisma db seed   # optional, if you want demo data
```

This will:

- Apply all migrations from `backend/prisma/migrations` to your Supabase database.
- Optionally seed default data using `backend/prisma/seed.js`.

### 2.5. Backend URL

Once deployed, your backend will have a public URL, for example:

```text
https://YOUR_BACKEND_URL
```

The API base used by the frontend is:

```text
https://YOUR_BACKEND_URL/api
```

You will plug this into `VITE_API_URL` on Vercel.

---

## 3. Frontend – Deploy React/Vite App on Vercel

The frontend lives in the `frontend/` directory.

### 3.1. Frontend code overview

- `frontend/index.html` – Vite entry HTML, now correctly points to `main.tsx`:

  ```html
  <script type="module" src="/src/main.tsx"></script>
  ```

- `frontend/src/main.tsx` – app entry:
  - Renders the **public booking** page when the path starts with `/book`.
  - Renders the authenticated dashboard (`App`) for all other paths.

- `frontend/src/api/api.ts` – Axios client:

  ```ts
  const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  });
  ```

  In production, this uses `VITE_API_URL` from Vercel.

- `frontend/src/App.tsx` – main authenticated portal:
  - Tabs: `Bookings`, `Financials`, `Customers`, `Inventory`, `Reports`.

- `frontend/src/components/PublicBooking.tsx` – public booking form mounted at `/book`.

### 3.2. Vercel project configuration

1. In Vercel, **Import Project** from GitHub.
2. When prompted:
   - **Root Directory**: `frontend`
   - Vercel detects the framework as **Vite** (you also have `vercel.json`).

`vercel.json` already contains:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

This ensures SPA routing works correctly.

### 3.3. Frontend environment variables (Vercel)

In your Vercel project settings → **Environment Variables**, add:

```env
VITE_API_URL="https://YOUR_BACKEND_URL/api"
```

Example:

```env
VITE_API_URL="https://aircon-api.up.railway.app/api"
```

After adding/changing `VITE_API_URL`, **redeploy** the project.

---

## 4. Public vs Authenticated Routes

The frontend distinguishes between:

- **Public booking page** (no login required)
  - URL:  
    ```text
    https://aircon-service-esyzjxsp9-vmargins-projects.vercel.app/book
    ```
  - Uses:
    - `GET /api/public/branches`
    - `POST /api/public/bookings`
  - Allows customers/partner stores to submit bookings online.

- **Authenticated portal** (Admins / Branch Leaders)
  - URL:  
    ```text
    https://aircon-service-esyzjxsp9-vmargins-projects.vercel.app/
    ```
  - Uses:
    - `POST /api/auth/login`
    - `GET/POST/PATCH` `/api/bookings`, `/api/invoices`, `/api/customers`, `/api/technicians`, `/api/branches`, `/api/inventory`, `/api/inventory/transactions`
  - Requires JWT issued by backend on login.

Routing logic in `src/main.tsx`:

```ts
const isPublicBooking = window.location.pathname.startsWith('/book');
```

---

## 5. White Screen / Blank Page – Common Causes

If you see a white screen:

- **Wrong entry script reference** (already fixed):
  - Make sure `frontend/index.html` uses:

    ```html
    <script type="module" src="/src/main.tsx"></script>
    ```

  - Wrong: pointing to `./src/main.jsx` when that file does not exist will prevent the app from loading.

- **Incorrect `VITE_API_URL`**:
  - If `VITE_API_URL` still points to `http://localhost:5000/api` in production, all API calls will fail.
  - Always set it to your real backend URL on Vercel.

- **CORS misconfiguration**:
  - If `FRONTEND_URL` on the backend does not match your Vercel URL, browser will block API requests.
  - Ensure `FRONTEND_URL` exactly equals:

    ```env
    FRONTEND_URL="https://aircon-service-esyzjxsp9-vmargins-projects.vercel.app"
    ```

  - Redeploy backend after changing this.

Check browser **DevTools → Console** and **Network** tabs for clues.

---

## 6. End-to-End Sanity Checklist

### 6.1. Backend

- [ ] Backend builds successfully on your host:

  ```bash
  npm install && npm run build
  npm start
  ```

- [ ] Environment variables set:

  ```env
  DATABASE_URL="postgresql://postgres.vawxkkeodnqyrzqvedsn:postgres1221@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
  JWT_SECRET="replace-with-a-long-random-string"
  NODE_ENV="production"
  FRONTEND_URL="https://aircon-service-esyzjxsp9-vmargins-projects.vercel.app"
  PORT="5000"  # if required by your host
  ```

- [ ] Prisma migrations and seeds run:

  ```bash
  npx prisma migrate deploy
  npx prisma db seed   # optional
  ```

- [ ] Backend URL obtained, e.g.:

  ```text
  https://YOUR_BACKEND_URL
  ```

### 6.2. Frontend

- [ ] Vercel project root set to `frontend/`.
- [ ] Environment variable on Vercel:

  ```env
  VITE_API_URL="https://YOUR_BACKEND_URL/api"
  ```

- [ ] App loads at:

  ```text
  https://aircon-service-esyzjxsp9-vmargins-projects.vercel.app/
  ```

- [ ] Public booking accessible at:

  ```text
  https://aircon-service-esyzjxsp9-vmargins-projects.vercel.app/book
  ```

### 6.3. Functional tests

- [ ] Login succeeds with a valid seeded user.
- [ ] Dashboard shows bookings; creating a booking from the portal works.
- [ ] Creating an invoice and marking as paid updates Financials & Reports.
- [ ] Public booking form at `/book` submits successfully and new bookings appear in the internal dashboard.
- [ ] Inventory items and movements work in the Inventory tab.

---

## 7. Production Tips

- **Rotate secrets**:
  - Change `JWT_SECRET` if it was shared or committed anywhere.
  - Change DB password in Supabase if `DATABASE_URL` was ever exposed.

- **Monitoring & logs**:
  - Use your host’s logging to monitor errors (especially Prisma/DB and CORS issues).

- **Backups**:
  - Enable regular backups for your Supabase database (critical for real customer data).

This `DEPLOYMENT.md` should give you a complete, copy-paste friendly reference to deploy and maintain the Aircon Service Manager online using Supabase, a Node backend host, and Vercel. 

