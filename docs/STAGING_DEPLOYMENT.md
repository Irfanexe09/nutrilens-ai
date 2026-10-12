# NutriLens — Staging Deployment & Cloud Hosting Architecture Guide

This guide details the runtime requirements, cloud hosting evaluation, staging configuration, and rollback procedures for NutriLens.

---

## 1. System Runtime Requirements

### 1.1 Environment Variables Matrix

| Variable | Requirement Level | Description | Recommended Staging Value / Generation Rule |
| :--- | :--- | :--- | :--- |
| `ENVIRONMENT` | **Required** | Operational mode. Enforces production-grade secret guardrails. | `staging` |
| `JWT_SECRET_KEY` | **Required** | Secret key for signing HS256 JWT tokens (minimum 32 characters). | Generate via `openssl rand -hex 32` |
| `DATABASE_URL` | **Required** | PostgreSQL connection URI for the managed database instance. | `postgresql://<user>:<password>@<managed-pg-host>:5432/<dbname>` |
| `CORS_ORIGINS` | **Required** | Comma-separated allowlist of permitted browser origins. | Explicit staging domains (e.g. `https://staging.nutrilens.app`) |
| `AI_PROVIDER` | **Required** | AI vision provider (`gemini` or `placeholder`). | `gemini` (or `placeholder` if offline) |
| `GEMINI_API_KEY` | **Conditional** | Google AI Studio API key. Required if `AI_PROVIDER=gemini`. | Provision from Google AI Studio |
| `ALLOW_PLACEHOLDER_AI` | **Optional** | Explicitly permits mock mode in staging for offline smoke tests. | `false` (default) |
| `GEMINI_MODEL` | **Optional** | Multimodal vision model identifier. | `gemini-3.8-flash` (default) |
| `AI_TIMEOUT_SECONDS` | **Optional** | Asynchronous timeout for external Gemini vision calls. | `25.0` (default) |
| `DEBUG` | **Optional** | FastAPI debug mode. Must remain disabled in staging. | `false` (default) |
| `RATE_LIMIT_ANALYZE_PER_MINUTE` | **Optional** | Rate limit ceiling per client IP on `/api/analyze`. | `15` (default) |
| `MAX_UPLOAD_SIZE_BYTES` | **Optional** | File upload size ceiling in bytes. | `10485760` (10 MB default) |
| `MAX_IMAGE_PIXELS` | **Optional** | Pillow decompression bomb defense threshold. | `25000000` (25 MP default) |
| `IMAGE_RETENTION_SECONDS` | **Optional** | Transient retention window for temporary meal uploads. | `86400` (24 hours default) |
| `BACKEND_PORT` | **Optional** | Host loopback binding port for backend container. | `8000` (default) |
| `STAGING_PORT` | **Optional** | Host ingress port for staging frontend reverse proxy. | `8080` or `80` |

### 1.2 Service Startup & Execution Behaviors
- **Backend Startup Command:**
  ```bash
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers
  ```
  Executed by unprivileged user `appuser` (UID 1001) in the hardened runtime stage of `backend/Dockerfile`.
- **Frontend Startup & Serving:**
  Multi-stage Docker build:
  1. `build` stage compiles TypeScript and produces static bundle via `npm run build` (`dist/`).
  2. `runtime` stage uses `nginx:alpine` to serve static assets from `/usr/share/nginx/html`.
  3. Reverse proxies `/api/` to `http://backend:8000/api/` and `/uploads/` to `http://backend:8000/uploads/`.
  4. SPA client-side routing fallback via `try_files $uri $uri/ /index.html;`.
- **Database Connection Requirements:**
  PostgreSQL 14+ (16 recommended) with `psycopg2-binary` driver. Connection URLs beginning with `postgresql://` are automatically normalized to `postgresql+psycopg2://` by the settings validator.
- **Alembic Migration Command:**
  ```bash
  alembic -c alembic.ini upgrade head
  ```
  Or via the automated pre-flight runner: `python scripts/run_staging_migrations.py`.
- **Health-Check Endpoint:**
  `GET /api/health` returns HTTP 200 with JSON telemetry:
  ```json
  {
    "status": "healthy",
    "app": "NutriLens",
    "version": "0.2.0",
    "environment": "staging",
    "database": "connected",
    "database_latency_ms": 1.45,
    "storage": "ready",
    "ai_provider": "gemini",
    "ai_status": "ready",
    "ai_configured": true,
    "timestamp": "2026-10-11T12:00:00Z"
  }
  ```
  Returns HTTP 503 if the database or upload storage becomes unreachable.
- **Persistent Storage Requirements:**
  1. Managed PostgreSQL database storage (customer profiles, meal logs, targets, analytics).
  2. Writable transient volume at `/app/uploads` (for transient food photographs; automatically pruned after 24 hours).
- **Network Inbound Ports:**
  - Public Inbound: Port 80 (HTTP) and 443 (HTTPS) terminating at Nginx reverse proxy or cloud load balancer.
  - Internal Loopback: Backend (8000) and Database (5432) restricted strictly to private network bridge or `127.0.0.1`.
- **Network Outbound Access:**
  Outbound HTTPS (TCP port 443) to Google Generative Language API (`generativelanguage.googleapis.com`).
- **CORS Allowlist:**
  Strictly whitelist explicit staging origins. Wildcards (`*`) are disallowed.
- **Authentication Behavior:**
  Stateless HS256 JWT access tokens issued upon login/registration. Expiration: 7 days (`ACCESS_TOKEN_EXPIRE_MINUTES = 10080`).

---

## 2. Cloud Hosting Options Evaluation

| Evaluation Criteria | Approach A: Managed Docker PaaS + Managed PostgreSQL (e.g. Render / Railway / Fly.io) | Approach B: Single Cloud VM + Docker Compose + Managed PostgreSQL (e.g. AWS EC2 / DigitalOcean Droplet) |
| :--- | :--- | :--- |
| **Docker Support** | Native support for multi-stage Dockerfiles (`backend/Dockerfile`, `frontend/Dockerfile`). Builds triggered automatically from Git branch. | Full native Docker and Docker Compose support (`docker compose -f docker-compose.staging.yml up -d`). |
| **Upload Storage** | Ephemeral container filesystem or attached persistent volume mount (e.g., Render Disk, Railway Volume). Well-suited for 24h transient retention. | Local host directory mount (`./backend/uploads:/app/uploads`). Simple, persists across container restarts. |
| **Database Connectivity** | Secure connection to managed PostgreSQL over private cloud network or encrypted TLS connection string. | Outbound TCP connection over TLS to managed PostgreSQL instance. |
| **TLS & HTTPS** | Fully automated. Platform edge router provisions and auto-renews Let's Encrypt certificates for custom or platform domains. | Manual setup required: Nginx host reverse proxy with Certbot / Let's Encrypt, cron renewal, or Caddy configuration. |
| **Secret Management** | Encrypted dashboard and CLI. Injected as runtime environment variables. Zero risk of secrets lingering in server filesystem. | Stored in `.env.staging` on the VM (`chmod 600`) or cloud parameter store. Requires host credential hygiene. |
| **Deployment Complexity** | **Very Low**: Git push to `staging` branch triggers automated build, pre-deploy migration, and rolling container swap. | **Moderate to High**: Requires provisioning VM, hardening SSH, configuring firewall (UFW/Security Groups), installing Docker, and setting up CI runner/SSH keys. |
| **Scaling Limitations** | Effortless vertical scaling (RAM/vCPU slider). Horizontal scaling requires external S3 storage for shared uploads. | Single VM is a single point of failure (SPOF). Resizing requires VM reboot. Horizontal scaling requires external load balancer. |
| **Backup Requirements** | Managed PostgreSQL provides automated point-in-time recovery (PITR) and automated daily snapshots. | Managed PostgreSQL provides DB snapshots. VM filesystem requires disk volume snapshots for uploads. |
| **Expected Cost Categories** | - Web Service compute tier (per vCPU/GB RAM)<br>- Managed PostgreSQL instance tier<br>- Egress bandwidth | - VM compute instance hourly/monthly fee<br>- Managed PostgreSQL instance fee<br>- Static Public IPv4 address fee<br>- Egress bandwidth |
| **Operational Maintenance** | **Minimal**: Cloud provider handles OS patching, Docker engine upgrades, kernel security updates, and TLS renewals. | **High**: Operations team must maintain Linux security updates, Docker daemon patches, firewall rules, and SSL renewal cron jobs. |

---

## 3. Architecture Recommendation

### **Recommendation: Approach A (Managed Docker Application Hosting with Managed PostgreSQL)**

**Rationale:**
1. **Zero Operational Overhead:** Eliminates Linux OS maintenance, SSH key management, firewall tuning, and Certbot renewal failures.
2. **Automated Release Hooks:** PaaS platforms (such as Render or Railway) natively support pre-deploy release commands:
   ```bash
   python scripts/run_staging_migrations.py
   ```
   If migrations fail, the new deployment is aborted automatically before receiving web traffic.
3. **Automated SSL/TLS:** Edge routing provides out-of-the-box HTTPS termination with automated Let's Encrypt certificate rotation.
4. **Instant Rollbacks:** One-click rollback in the platform dashboard to previous container image builds if an issue is discovered.

---

## 4. Staging Deployment Runbook

### 4.1 Prerequisites
1. Dedicated managed PostgreSQL staging database created.
2. Google Gemini API key obtained from Google AI Studio.
3. Cryptographically random JWT secret generated:
   ```bash
   openssl rand -hex 32
   ```

### 4.2 Deploying via Managed PaaS (Approach A)
1. **Create Managed Database Service:**
   - Create a staging PostgreSQL instance (e.g. PostgreSQL 16).
   - Copy the internal connection string (`DATABASE_URL`).
2. **Configure Backend Web Service:**
   - Source: GitHub repository `Irfanexe09/nutrilens-ai`, branch: `main` (or dedicated `staging` branch).
   - Runtime: Docker (`backend/Dockerfile`).
   - Pre-deploy Command: `python scripts/run_staging_migrations.py`.
   - Set Environment Variables:
     - `ENVIRONMENT=staging`
     - `DATABASE_URL=<managed_pg_url>`
     - `JWT_SECRET_KEY=<generated_openssl_secret>`
     - `CORS_ORIGINS=https://staging.nutrilens.app`
     - `AI_PROVIDER=gemini`
     - `GEMINI_API_KEY=<gemini_key>`
     - `ALLOW_PLACEHOLDER_AI=false`
3. **Configure Frontend Web Service:**
   - Source: GitHub repository `Irfanexe09/nutrilens-ai`.
   - Runtime: Docker (`frontend/Dockerfile`).
   - Build Argument: `VITE_API_BASE_URL=/api` (or custom backend URL).
4. **Verify Health:**
   ```bash
   curl -f https://staging.nutrilens.app/api/health
   ```

### 4.3 Deploying via Docker Compose VM (Approach B)
1. Provision VM with Ubuntu 24.04 LTS and install Docker Engine and Compose plugin.
2. Clone repository:
   ```bash
   git clone https://github.com/Irfanexe09/nutrilens-ai.git /opt/nutrilens
   cd /opt/nutrilens
   ```
3. Prepare staging configuration:
   ```bash
   cp .env.staging.example .env.staging
   chmod 600 .env.staging
   # Edit .env.staging with genuine staging credentials
   ```
4. Build and start containers:
   ```bash
   docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build
   ```
5. Inspect running services:
   ```bash
   docker compose -f docker-compose.staging.yml ps
   ```

---

## 5. Safe Rollback Playbook

If a critical issue, regression, or failure is detected in staging, execute the appropriate rollback procedure:

### 5.1 Application Code Rollback
- **Managed PaaS (Approach A):**
  1. Open the service deployment history in the dashboard.
  2. Select the previous stable deployment and click **Rollback**.
  3. Traffic is immediately redirected to the prior container image.
- **Docker Compose VM (Approach B):**
  1. Checkout previous Git commit:
     ```bash
     git checkout <previous_commit_hash>
     ```
  2. Rebuild and restart containers:
     ```bash
     docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build
     ```

### 5.2 Database Migration Rollback
If a newly applied database migration must be reverted:
1. Identify the current revision and migration history:
   ```bash
   docker compose -f docker-compose.staging.yml run --rm staging-backend alembic -c alembic.ini current
   ```
2. Revert the latest migration revision:
   ```bash
   docker compose -f docker-compose.staging.yml run --rm staging-backend alembic -c alembic.ini downgrade -1
   ```
3. Verify database health probe:
   ```bash
   curl -f http://localhost:8000/api/health
   ```

---

## 6. Pre-Staging Verification Checklist

- [ ] **1. Cryptographic Secrets:** `JWT_SECRET_KEY` is a unique 32+ character random hex string (`openssl rand -hex 32`).
- [ ] **2. Managed Database:** Staging PostgreSQL instance reachable over TLS with dedicated non-root credentials.
- [ ] **3. Guardrail Enforcement:** Verified that `ENVIRONMENT=staging` rejects default development secrets and passwords.
- [ ] **4. AI Provider Ready:** `AI_PROVIDER=gemini` with verified `GEMINI_API_KEY` (or `ALLOW_PLACEHOLDER_AI=true` for offline smoke testing).
- [ ] **5. Port Isolation:** Host ports restricted strictly to reverse proxy ingress (80/443); backend (8000) and DB bound only to loopback.
- [ ] **6. CORS Whitelist:** `CORS_ORIGINS` configured strictly to staging frontend domains.
- [ ] **7. Image Security:** File size capped at 10 MB, Pillow decompression bomb limit at 25 MP, 24h transient retention active.
- [ ] **8. Rate Limiting:** Sliding-window rate limiter (15 req/min/IP) enabled on `/api/analyze`.
- [ ] **9. Telemetry Verified:** `/api/health` reports status without exposing environment secrets.
- [ ] **10. Zero Tracked Secrets:** Confirmed `.env` and `.env.staging` are excluded from version control.
