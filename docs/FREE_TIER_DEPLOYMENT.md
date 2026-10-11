# NutriLens — Zero-Cost (₹0/Month) Hosting Architecture & Deployment Playbook

This document details the evaluation, architecture selection, and deployment procedures for hosting NutriLens at a recurring cost of **₹0 / month ($0.00 / month)** without sacrificing database safety, data persistence, or security guardrails.

---

## 1. Cloud Provider Free-Tier Research & Evaluation

Official terms, resource ceilings, sleep behaviors, and expiration rules evaluated across candidate cloud hosting providers:

| Provider | Service Category | Free Tier Availability | Resource Limits & Behavior | Expiration & Retention Rules | Payment Method Required | NutriLens Compatibility |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Vercel** | Frontend (Static SPA) | **Yes** (Hobby Plan) | 100 GB bandwidth, unlimited deployments, automated SSL, global edge CDN. Zero sleep. | Deployments retained 30 days. No project expiration. | No | **Highly Compatible** (Ideal for Vite/React SPA) |
| **Cloudflare Pages** | Frontend (Static SPA) | **Yes** | Unlimited bandwidth, 500 builds/month, automated SSL, global edge CDN. Zero sleep. | No project expiration. | No | **Highly Compatible** (Alternative for Vite/React SPA) |
| **Render** | Backend (Web Service) | **Yes** (Free Instance) | 512 MB RAM, 0.1 vCPU, 750 free instance hours/month. **Spins down after 15 min of inactivity; ~50s cold start.** Ephemeral filesystem. | No project expiration. | No | **Compatible** (Supports Docker & FastAPI runtime) |
| **Render** | Relational Database | **Yes (Temporary only)** | 1 GB storage, 1 database instance per workspace. | **CRITICAL: Free databases expire and are PERMANENTLY DELETED after 30 days.** | No | **INCOMPATIBLE** (Violates data safety requirement) |
| **Neon** | Serverless PostgreSQL | **Yes** (Free Plan) | 1 GB storage, 100 Compute Unit (CU) hours/month, scales to zero after 5 min. **Cold start ~500ms.** | **PERMANENT FREE TIER. Data does NOT expire or delete after 30 days.** | No | **Highly Compatible** (Ideal PostgreSQL host) |
| **Supabase** | Managed PostgreSQL | **Yes** (Free Tier) | 500 MB database storage, 2 active projects. | **Pauses project after 7 days of inactivity.** Restorable within 90 days via dashboard. | No | **Conditionally Compatible** (Requires weekly ping or manual resume) |
| **Railway** | Full-Stack Containers | **No true free tier** | $1/month credit after initial 30-day $5 trial. | Metred usage by the second. Exceeding $1 suspends services. | **Yes** (Credit card required) | **Incompatible** (Not ₹0/month) |
| **Fly.io** | Containers | **No free tier** | Legacy accounts only. Pay-as-you-go model. | Charges for active VMs, persistent volumes, and IPv4 addresses. | **Yes** (Credit card required) | **Incompatible** (Not ₹0/month) |
| **Koyeb** | Containers | **No free tier** | Starter free tier closed in 2026. Pro plan starts at $29/month. | Pre-authorization hold on credit card ($29). | **Yes** (Credit card required) | **Incompatible** (Not ₹0/month) |

---

## 2. Recommended Zero-Cost Architecture

To achieve a guaranteed **₹0 / month** initial hosting cost while preserving persistent data safety and security, NutriLens adopts a **Decoupled Edge-and-Serverless Architecture**:

```
                                  ┌───────────────────────────────┐
                                  │      Client Web Browser       │
                                  └───────────────┬───────────────┘
                                                  │
                                  ┌───────────────┴───────────────┐
                                  │                               │
                                  ▼                               ▼
                   ┌───────────────────────────────┐ ┌───────────────────────────────┐
                   │        Vercel (Hobby)         │ │     Render (Free Instance)    │
                   │    Frontend Static Assets     │ │     FastAPI Backend API       │
                   │    - 100 GB/mo CDN Bandwidth  │ │     - 512 MB RAM, 0.1 vCPU    │
                   │    - Automated HTTPS          │ │     - 750 Free Hours/Month    │
                   │    - Zero Sleep / Instant UI  │ │     - 15-min Inactivity Sleep │
                   └───────────────────────────────┘ └───────────────┬───────────────┘
                                                                     │
                                                                     ▼ (Encrypted TLS)
                                                     ┌───────────────────────────────┐
                                                     │    Neon Serverless Postgres   │
                                                     │    Permanent Free Tier        │
                                                     │    - 1 GB Storage             │
                                                     │    - Never Auto-Deleted       │
                                                     │    - Scales to Zero (~500ms)  │
                                                     └───────────────────────────────┘
```

### Component Breakdown
1. **Frontend:** Hosted on **Vercel** (or Cloudflare Pages).
   - Fast global edge CDN serving the compiled React/Vite SPA.
   - Zero sleep latency: UI loads instantly for all visitors.
   - Configured via [`frontend/vercel.json`](file:///Users/irfan/Desktop/food%20app/frontend/vercel.json) with client-side SPA route rewrites.
   - **Vercel Hobby Plan Terms Notice:** Vercel's free Hobby plan is strictly designated for personal, non-commercial projects. For commercial deployments, Vercel Terms of Service require upgrading to Vercel Pro ($20/month per member).
2. **Backend:** Hosted on **Render** (Free Web Service).
   - Multi-stage Docker build from [`backend/Dockerfile`](file:///Users/irfan/Desktop/food%20app/backend/Dockerfile).
   - **Startup Migration Execution:** Because Render Free tier does not support `preDeployCommand` (which is exclusive to paid instances), migrations are executed on container startup via [`backend/scripts/start.sh`](file:///Users/irfan/Desktop/food%20app/backend/scripts/start.sh). The script runs [`run_staging_migrations.py`](file:///Users/irfan/Desktop/food%20app/backend/scripts/run_staging_migrations.py) with `set -e` before launching FastAPI uvicorn. If migrations fail, the container aborts and the deploy fails before receiving traffic.
   - **Concurrency Note:** Startup migrations are safe and appropriate for single-instance staging and free-tier hobby setups. For multi-instance horizontal production clusters, migrations should be extracted into a separate one-off pre-deploy job or migration container to prevent concurrent migration race conditions.
   - **Dynamic Port Binding:** Render dynamically assigns the listen port via the `$PORT` environment variable (defaults to port `10000` on Render). [`backend/scripts/start.sh`](file:///Users/irfan/Desktop/food%20app/backend/scripts/start.sh) binds to `--port "${PORT:-8000}"` on `0.0.0.0`, and the Dockerfile exposes both `8000` and `10000`.
   - Spin-down behavior: After 15 minutes of inactivity, the backend sleeps. The first incoming request triggers a ~45–60 second wake-up cycle.
3. **Database:** Hosted on **Neon Serverless PostgreSQL**.
   - Standard PostgreSQL 16 engine accessible over TLS (`?sslmode=require`).
   - **Data never expires or deletes.**
   - Compute automatically scales to zero after 5 minutes of inactivity, waking up in ~500ms on first connection.
   - Database connection pooling configured with `pool_recycle=300`, `pool_size=5`, and `max_overflow=10` to handle Neon serverless compute suspend gracefully without stale socket drops.

---

## 3. Storage & Persistence Analysis

### Ephemeral Filesystem on Free Backend Hosting
Render's free tier uses an ephemeral container filesystem (`/app/uploads` is wiped when the container sleeps or restarts).
- **NutriLens Handling:**
  1. The user uploads a food photograph.
  2. The image bytes are held in memory and transmitted directly to the Google Gemini multimodal API for visual recognition.
  3. The backend stores the transient image in `/app/uploads` solely for session review during the confirmation step.
  4. Once confirmed, **all nutritional values, portion calculations, meal items, timestamps, and user targets are written directly to Neon PostgreSQL**.
  5. User meal histories, daily macro targets, and weekly analytics remain permanently intact in the database even when the container sleeps or restarts.
- **Future Enhancement for Long-Term Photo Archival:**
  If permanent meal photo viewing across devices is desired, Cloudflare R2 provides 10 GB free permanent object storage with $0 egress fees.

---

## 4. Step-by-Step Free-Tier Deployment Runbook

### Step 1: Provision Free Database on Neon
1. Navigate to [Neon Console](https://console.neon.tech/) and sign up (no credit card required).
2. Create a project named `nutrilens-production` (PostgreSQL 16, Region: `US East` or nearest).
3. Copy the pooled connection string:
   ```
   postgresql://nutrilens_user:<password>@ep-example-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### Step 2: Deploy Backend on Render
1. Navigate to [Render Dashboard](https://dashboard.render.com/) and click **New > Web Service**.
2. Connect your GitHub repository: `Irfanexe09/nutrilens-ai`.
3. Select **Docker** environment:
   - Root Directory: `backend`
   - Docker Context: `./backend`
   - Dockerfile Path: `./backend/Dockerfile`
   - Instance Type: **Free**
4. Migration Execution & Port Handling:
   - Do **NOT** specify a `preDeployCommand` (not supported on Render Free plans).
   - The container entrypoint `scripts/start.sh` automatically performs DB connectivity checks, applies Alembic migrations, and seeds the core Indian foods dataset before launching Uvicorn.
   - Render automatically sets `$PORT` (typically `10000`); the container entrypoint listens on `0.0.0.0:${PORT:-8000}`.
5. Configure Environment Variables:
   - `ENVIRONMENT`: `staging` (or `production`)
   - `DATABASE_URL`: `<your_neon_connection_string>`
   - `JWT_SECRET_KEY`: `<generated via: openssl rand -hex 32>`
   - `CORS_ORIGINS`: `https://nutrilens.vercel.app` (your frontend domain, without trailing slash)
   - `AI_PROVIDER`: `gemini`
   - `GEMINI_API_KEY`: `<your_gemini_api_key_from_google_ai_studio>`
   - `RATE_LIMIT_ANALYZE_PER_MINUTE`: `15`
6. Click **Create Web Service**. Note the assigned URL: `https://nutrilens-backend.onrender.com`.

### Step 3: Deploy Frontend on Vercel
1. Navigate to [Vercel Dashboard](https://vercel.com/) and click **Add New > Project**.
2. Import repository `Irfanexe09/nutrilens-ai`.
3. Configure Project Settings:
   - Framework Preset: **Vite**
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Configure Environment Variables:
   - `VITE_API_BASE_URL`: `https://nutrilens-backend.onrender.com/api` (normalized automatically by `api.ts` if trailing slashes are included)
5. Review Terms:
   - Confirm project complies with Vercel Hobby terms (personal/non-commercial).
6. Click **Deploy**. Vercel will build and assign your domain (e.g., `https://nutrilens.vercel.app`).

### Step 4: Final Verification
1. Verify backend health probe:
   ```bash
   curl -f https://nutrilens-backend.onrender.com/api/health
   ```
   Expected response:
   ```json
   {
     "status": "healthy",
     "app": "NutriLens",
     "database": "connected",
     "storage": "ready",
     "ai_provider": "gemini",
     "ai_status": "ready"
   }
   ```
2. Open `https://nutrilens.vercel.app` in your browser.
3. Test user registration, login, and meal logging.

---

## 5. Security & Operational Checklist

- [x] **Zero Hardcoded Credentials:** Confirmed `.env` is omitted from version control.
- [x] **No Secrets in Frontend:** Verified that `JWT_SECRET_KEY`, `DATABASE_URL`, and `GEMINI_API_KEY` are strictly backend environment variables and never exposed to `VITE_*` public bundles.
- [x] **CORS Isolation:** `CORS_ORIGINS` on Render permits only the explicit Vercel frontend URL.
- [x] **Loopback & Private Network Safety:** Database connections use enforced TLS encryption (`sslmode=require`).
- [x] **Permanent Database Retention:** Neon PostgreSQL avoids Render's 30-day database deletion policy.
