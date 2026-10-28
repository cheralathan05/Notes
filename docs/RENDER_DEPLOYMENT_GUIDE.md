# 🚀 Complete Render Deployment Guide (Zero Errors Guaranteed)

This guide walks you through deploying **KRONOS** (Next.js frontend + Node.js/Express backend + PostgreSQL database) to **[Render](https://render.com/)** with **zero errors**.

---

## 🎯 Why Deployments Failed Previously & How It Is Fixed

| Previous Error | Root Cause | Permanent Fix Implemented |
|---|---|---|
| **`Can't reach database server at localhost:5432`** | `dotenv.config({ override: true })` in `backend/src/config.ts` was overwriting Render's injected `DATABASE_URL` with the local `.env` value. | Changed to `override: false`. Platform environment variables (`DATABASE_URL`, `PORT`) are now strictly preserved. |
| **`502 Bad Gateway / Connection Refused`** | On Render Free Tier, web services **cannot receive private network traffic** (e.g. `http://kronos-backend:10000` is blocked by Render). | **Unified Full-Stack Architecture**: Backend and Frontend run in the same container. Next.js proxies to backend via `127.0.0.1:4000` with zero network overhead and zero CORS. |
| **Free Tier Hours Exceeded (Account Suspended)** | Running 2 separate web services uses $2 \times 720 = 1440$ hours/month, exceeding Render's 750-hour free limit. | Unified deployment runs on **1 Web Service + 1 Database** ($\approx 720$ hours/month), fitting 100% within the free plan. |
| **Authentication / Session Loss** | Cross-subdomain cookies (`*.onrender.com`) are blocked by third-party cookie restrictions in Safari, Chrome, and iOS. | Frontend and backend share the exact same domain and origin, making session cookies first-party. Token fallback is also persisted in `localStorage`. |
| **Cold Start Timeout** | When two services wake up separately, the frontend wakes up and times out waiting for the sleeping backend. | In the unified runner (`start-prod.js`), PostgreSQL schema sync finishes, backend starts and becomes healthy, then frontend serves requests seamlessly. |

---

## ⚡ Option 1: Automatic 1-Click Deployment (Render Blueprint) — Recommended

The repository root includes a pre-configured [`render.yaml`](file:///c:/Users/chera/Downloads/AppFlowy-main/render.yaml) file.

### Step 1: Push Code to GitHub
Ensure all fixes are committed and pushed to your GitHub repository:
```bash
git add .
git commit -m "fix(deploy): optimize for Render unified zero-error deployment"
git push origin main
```

### Step 2: Deploy on Render
1. Go to your **[Render Dashboard](https://dashboard.render.com/)**.
2. Click **New +** in the top right and select **Blueprint**.
3. Connect your GitHub repository (`cheralathan05/Notes`).
4. Render will read `render.yaml` and display:
   - **`kronos-db`** (PostgreSQL Database — Free plan)
   - **`kronos-workspace`** (Full-Stack Web Service — Free plan)
5. Click **Apply**.
6. Render will automatically:
   - Provision the PostgreSQL database.
   - Inject `DATABASE_URL` into the web service.
   - Run `npm run build:all` (generates Prisma client, compiles backend TypeScript, and builds Next.js).
   - Run `node start-prod.js` (synchronizes database schema, launches Express on internal port 4000, and starts Next.js on public port).
7. Once the status turns **Live** (green), click your URL:
   `https://kronos-workspace-xxxx.onrender.com`

---

## 📋 Option 2: Manual Web Service Deployment via Render Dashboard

If you prefer to configure the service manually through the Render UI instead of using Blueprint:

### Step 1: Create PostgreSQL Database
1. In Render Dashboard, click **New +** ➔ **PostgreSQL**.
2. **Name:** `kronos-db`
3. **Database:** `workspace_saas`
4. **User:** `postgres`
5. **Region:** `Ohio (US East)` or `Oregon (US West)` (remember the region you choose).
6. **Plan:** `Free`
7. Click **Create Database**.
8. Wait for it to become **Available**, then copy the **Internal Database URL**.

---

### Step 2: Create Web Service
1. Click **New +** ➔ **Web Service**.
2. Select your repository: `cheralathan05/Notes`.
3. Configure the following fields:
   - **Name:** `kronos-workspace`
   - **Region:** Same region as your database.
   - **Runtime:** `Node`
   - **Branch:** `main`
   - **Root Directory:** *(leave blank)*
   - **Build Command:**
     ```bash
     npm run build:all
     ```
   - **Start Command:**
     ```bash
     npm start
     ```
   - **Plan:** `Free`

4. Scroll down to **Environment Variables** and add:
   | Key | Value | Notes |
   |---|---|---|
   | `NODE_VERSION` | `20.18.1` | Recommended Node LTS |
   | `NODE_ENV` | `production` | Production mode |
   | `DATABASE_URL` | *(Paste Internal Database URL from Step 1)* | Database connection string |
   | `SESSION_SECRET` | *(Click "Generate" or enter random string)* | Cookie encryption secret |
   | `COOKIE_SAME_SITE` | `lax` | Safe first-party cookie policy |
   | `EMAIL_PROVIDER` | `console` | Console or SMTP |
   | `NODE_OPTIONS` | `--max-old-space-size=460` | Prevents memory spikes on 512MB RAM |
   | `NEXT_CPU_COUNT` | `1` | Optimized build parallelism |
   | `NEXT_TELEMETRY_DISABLED` | `1` | Faster Next.js build |

5. Under **Advanced**:
   - **Health Check Path:** `/api/health`
6. Click **Create Web Service**.

---

## 🔍 Verification Checklist

Once Render marks the service as **Live**:

1. **Health Check:**
   - Open `https://<your-service>.onrender.com/api/health`
   - Expected response: `{"status":"ok","timestamp":"..."}`
2. **Frontend App:**
   - Open `https://<your-service>.onrender.com`
   - The landing page and navigation should load cleanly.
3. **Registration & Database Sync:**
   - Click **Get Started** or go to `/register`.
   - Register a new account.
   - You should be logged in immediately and redirected to `/onboarding` or `/dashboard`.
