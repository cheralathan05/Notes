# 🚀 Complete Render Deployment Guide for KRONOS (Frontend + Backend + PostgreSQL)

This guide provides step-by-step instructions to successfully deploy the **KRONOS** full-stack application (Next.js frontend, Node.js/Express backend, and PostgreSQL database) to **[Render](https://render.com/)** with zero errors.

---

## 🛠️ Errors Diagnosed & Fixed in the Codebase

Before deploying, the following critical issues were identified and resolved across the project:

1. **Circular Dependency Loop in `render.yaml`:**
   - *Previous Issue:* `kronos-backend` was attempting to read `kronos-frontend.host` via `fromService`, while `kronos-frontend` was reading `kronos-backend.host` via `fromService`. Render blueprints strictly prohibit circular dependencies and fail during initial validation.
   - *Fix:* Dependency direction was made strictly unidirectional (`kronos-db` ➔ `kronos-backend` ➔ `kronos-frontend`).

2. **Render Port Binding Timeout on Frontend:**
   - *Previous Issue:* The frontend `npm start` script hardcoded `-p 3001`. On Render, web services must dynamically bind to the platform's injected `$PORT` (typically `10000`). This caused health checks to time out.
   - *Fix:* Updated `frontend/package.json` so `"start": "next start"` listens to `process.env.PORT` automatically.

3. **Missing Build Tools Under `NODE_ENV=production`:**
   - *Previous Issue:* When `NODE_ENV=production` is set, `npm install` skips `devDependencies` by default. This caused `prisma`, `typescript`, `@types/*`, and `@tailwindcss/turbopack` to be missing during build time (`prisma: command not found`, `tsc: command not found`).
   - *Fix:* Added `--include=dev` to all build scripts (`npm install --include=dev`) and promoted `prisma` CLI into backend dependencies.

4. **Internal Hostname vs. Browser External URL Mismatch:**
   - *Previous Issue:* Render's `property: host` produces internal private hostnames (e.g. `kronos-backend`), not public internet URLs. Browser-side code calling `https://kronos-backend` resulted in `ERR_NAME_NOT_RESOLVED`.
   - *Fix:* 
     - Configured the frontend to utilize Next.js's built-in reverse proxy route (`src/app/api/[...path]/route.ts`), which communicates over Render's private internal network (`BACKEND_INTERNAL_URL: hostport`) via HTTP.
     - Kept browser requests same-origin (`/api/*`), completely eliminating cross-origin cookie issues and CORS rejections on iOS, Safari, and Chrome.

5. **Flexible CORS and Health Checks:**
   - *Previous Issue:* The backend lacked a root `/` handler (returning 404 on default health checks) and rejected origins missing an explicit protocol match.
   - *Fix:* Added root `/` status endpoint, registered `healthCheckPath: /api/health`, and configured dynamic matching for all `*.onrender.com` subdomains.

---

## ⚡ Option 1: Automatic 1-Click Deployment (Blueprint) — Recommended

The repository is now pre-configured with a tested `render.yaml` blueprint.

### Step 1: Push Your Code
Commit and push the latest changes to your GitHub or GitLab repository:
```bash
git add .
git commit -m "fix(deploy): optimize render.yaml, port binding, and internal networking for Render"
git push origin main
```

### Step 2: Create Blueprint Instance on Render
1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. In the top right, click **New +** and select **Blueprint**.
3. Connect your GitHub/GitLab repository.
4. Render will automatically detect [`render.yaml`](file:///c:/Users/chera/Downloads/AppFlowy-main/render.yaml) and display the 3 services:
   - **`kronos-db`** (PostgreSQL Database)
   - **`kronos-backend`** (Web Service)
   - **`kronos-frontend`** (Web Service)
5. Click **Apply**.
6. Render will sequentially:
   - Provision the PostgreSQL database.
   - Run migrations (`prisma db push`) and start `kronos-backend`.
   - Build and launch the `kronos-frontend`.

---

## 📋 Option 2: Manual Service Creation via Render Dashboard

If you prefer to configure each service manually without Blueprints, follow these exact settings:

### 1. PostgreSQL Database (`kronos-db`)
- Click **New +** ➔ **PostgreSQL**.
- **Name:** `kronos-db`
- **Database:** `workspace_saas`
- **User:** `postgres`
- **Region:** `Oregon (US West)` (keep all services in the same region)
- **Plan:** `Free`
- Click **Create Database**.
- Once created, copy the **Internal Database URL**.

---

### 2. Backend API Service (`kronos-backend`)
- Click **New +** ➔ **Web Service**.
- Select your repository.
- **Name:** `kronos-backend`
- **Region:** Same as database (e.g. `Oregon`)
- **Runtime:** `Node`
- **Root Directory:** leave blank or enter `.`
- **Build Command:**
  ```bash
  cd backend && npm install --include=dev && npm run render:build
  ```
- **Start Command:**
  ```bash
  cd backend && npm run render:start
  ```
- **Health Check Path:** `/api/health`
- **Environment Variables:**
  | Key | Value | Notes |
  |---|---|---|
  | `NODE_ENV` | `production` | Production environment |
  | `PORT` | `10000` | Standard Render web service port |
  | `DATABASE_URL` | *(Paste Internal Database URL from kronos-db)* | Full postgres connection string |
  | `SESSION_SECRET` | *(Generate a 64-char random string or click generate)* | Auth cookie encryption |
  | `FRONTEND_URL` | `https://kronos-frontend.onrender.com` | Update if custom domain is used |
  | `COOKIE_SAME_SITE` | `none` | Cross-site cookie support |
  | `EMAIL_PROVIDER` | `console` | Console or SMTP |

---

### 3. Frontend Web Service (`kronos-frontend`)
- Click **New +** ➔ **Web Service**.
- Select your repository.
- **Name:** `kronos-frontend`
- **Region:** Same as backend (e.g. `Oregon`)
- **Runtime:** `Node`
- **Root Directory:** `frontend`
- **Build Command:**
  ```bash
  npm install --include=dev && (npm run build || npm run build)
  ```
- **Start Command:**
  ```bash
  npm start
  ```
- **Environment Variables:**
  | Key | Value | Notes |
  |---|---|---|
  | `NODE_ENV` | `production` | Production environment |
  | `PORT` | `10000` | Standard Render web service port |
  | `BACKEND_INTERNAL_URL` | `http://kronos-backend:10000` | Internal fast container-to-container network |
  | `NEXT_PUBLIC_API_URL` | *(Leave empty)* | Empty ensures requests use same-origin proxy |

---

## 🔍 Post-Deployment Verification Checklist

Once both services show **Live**:

1. **Backend Health Check:**
   - Open `https://<your-backend>.onrender.com/api/health` in your browser.
   - Expected response: `{"status":"ok","timestamp":"..."}`
2. **Frontend Loading:**
   - Open `https://<your-frontend>.onrender.com` in your browser.
   - The landing page and authentication UI should load immediately.
3. **User Authentication & Database Connectivity:**
   - Navigate to `/register` and create a test account.
   - Session cookies will be issued and you will be routed directly to the dashboard.
