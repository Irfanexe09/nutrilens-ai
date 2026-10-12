# NutriLens — Production Deployment & Operations Guide

## 1. System Overview & Architecture

NutriLens is packaged as a modular monolith orchestrated via Docker Compose. The topology consists of four coordinated containers:

```
                  ┌───────────────────────────────┐
                  │    Host Port 80 / 443         │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │    nutrilens-frontend (Nginx) │
                  │  Static SPA + Reverse Proxy   │
                  └──────────────┬────────────────┘
                                 │
                  ┌──────────────┴────────────────┐
                  │ (Internal Bridge Network)     │
                  ▼                               ▼
  ┌───────────────────────────────┐ ┌───────────────────────────┐
  │  nutrilens-backend (FastAPI)  │ │ nutrilens-migration       │
  │  Port 8000 (Internal)         │ │ (Alembic Upgrade Head)    │
  └──────────────┬────────────────┘ └─────────────┬─────────────┘
                 │                                │
                 └────────────────┬───────────────┘
                                  ▼
                  ┌───────────────────────────────┐
                  │   nutrilens-db (PostgreSQL)   │
                  │   Persistent Volume           │
                  └───────────────────────────────┘
```

---

## 2. Environment Variables Configuration

Create a production `.env` file on the deployment host. **Never commit real credentials to version control.**

| Variable | Description | Recommended Production Value |
| :--- | :--- | :--- |
| `ENVIRONMENT` | Runtime mode | `production` |
| `DEBUG` | FastAPI debug mode | `false` |
| `POSTGRES_USER` | PostgreSQL superuser | Random alphanumeric string |
| `POSTGRES_PASSWORD` | PostgreSQL database password | Cryptographically random string (min 24 chars) |
| `POSTGRES_DB` | Production database name | `nutrilens_db` |
| `DATABASE_URL` | SQLAlchemy connection string | `postgresql://<user>:<password>@db:5432/nutrilens_db` |
| `JWT_SECRET_KEY` | HMAC token signing secret | Generate with `openssl rand -hex 32` |
| `CORS_ORIGINS` | Permitted browser origins | Explicit domains e.g. `https://nutrilens.app` |
| `AI_PROVIDER` | Multi-modal vision provider | `gemini` (or `placeholder` for offline mode) |
| `GEMINI_API_KEY` | Google AI Studio API Key | Valid Gemini API key |
| `GEMINI_MODEL` | Google vision model identifier | `gemini-3.8-flash` |
| `RATE_LIMIT_ANALYZE_PER_MINUTE` | Per-client rate limit for vision calls | `15` |
| `MAX_UPLOAD_SIZE_BYTES` | File upload ceiling in bytes | `10485760` (10 MB) |

### Strict Production Validation Rules
When `ENVIRONMENT=production`, NutriLens enforces automated security guardrails on startup:
1. **JWT Secret Strength**: `JWT_SECRET_KEY` must be explicitly defined and at least 32 characters long. Using default fallbacks (`nutrilens-secret-key-change-in-production`, `secret`, `changeme`) triggers an immediate fatal startup error. Generate with `openssl rand -hex 32`.
2. **Database Password**: `DATABASE_URL` cannot contain the default development password (`nutrilens_password`).
3. **AI Provider Guardrails**: `AI_PROVIDER` must be set to `gemini` in production. Placeholder mode is rejected by default to prevent mock data from silently being served in production. If intentionally operating in mock mode for non-live staging environments, operators must explicitly set `ALLOW_PLACEHOLDER_AI=true`.
4. **Gemini Key Placeholder Check**: `GEMINI_API_KEY` cannot contain template placeholder values (e.g. `your_gemini_api_key_here`).
5. **Missing Gemini Key Handling**: If `GEMINI_API_KEY` is not configured at startup, the service boots normally to allow migrations, authentication, profile management, and history browsing, but:
   - `/api/health` transparently reports `ai_configured: false` and `ai_status: "unconfigured"`.
   - Any food image analysis request via `/api/analyze` immediately returns `HTTP 503 Service Unavailable` with a clear explanation rather than fabricating mock data.
6. **Port Isolation**: In `docker-compose.yml`, direct host bindings for PostgreSQL (`5432`) and backend FastAPI (`8000`) are restricted strictly to the host loopback interface (`127.0.0.1`). External incoming web traffic must ingress via the Nginx frontend reverse proxy (`${FRONTEND_PORT:-5173}`).

---

## 3. Deployment Procedure

### Step 1: Clone Repository & Create `.env`
```bash
git clone https://github.com/Irfanexe09/nutrilens-ai.git
cd nutrilens-ai
cp .env.example .env
# Edit .env with your cryptographically generated production credentials:
# Generate JWT secret: openssl rand -hex 32
chmod 600 .env
```

### Step 2: Build & Start Containers
```bash
docker compose up -d --build
```

### Step 3: Verify Container Health & Readiness
```bash
# Check running container statuses:
docker compose ps

# Test the backend health probe:
curl -f http://localhost:8000/api/health

# Expected response:
# {"status":"healthy","app":"NutriLens","version":"0.2.0","environment":"production","database":"connected","storage":"ready",...}
```

---

## 4. Operational Commands & Maintenance

### 4.1 Viewing Service Logs
Stream logs in real-time across all services or for a specific container:
```bash
# Stream all logs:
docker compose logs -f

# Stream backend API logs only:
docker compose logs -f backend

# Inspect migration execution logs:
docker compose logs migration

# Stream database query logs:
docker compose logs -f db
```

### 4.2 Inspecting Container Status & Healthchecks
Inspect the running status and health check state of all orchestrated containers:
```bash
docker compose ps
```
Healthy containers will show `Up (healthy)`. The `migration` service should show `Exited (0)`.

### 4.3 Database Migrations & Upgrades
The `nutrilens-migration` service automatically runs `alembic -c alembic.ini upgrade head` upon stack startup before the backend service starts listening.

To inspect current revision or run migrations manually:
```bash
# Check current migration revision:
docker compose run --rm backend alembic current

# Upgrade to latest revision manually:
docker compose run --rm backend alembic upgrade head

# Rollback one revision (if needed):
docker compose run --rm backend alembic downgrade -1
```

### 4.4 Stopping the Application
```bash
# Stop and preserve all containers and persistent database volumes:
docker compose down

# Stop and wipe persistent PostgreSQL volumes (fresh start):
docker compose down -v
```

---

## 5. Storage Volumes & Retention Pruning

1. **PostgreSQL Data Volume**: Stored in Docker named volume `postgres_data`. Back up with standard `pg_dump`:
   ```bash
   docker exec -t nutrilens-db pg_dump -U nutrilens_user nutrilens_db > backup_$(date +%F).sql
   ```
2. **Food Photography Uploads**: Mounted at `./backend/uploads:/app/uploads`. The backend automatically prunes uploads older than 24 hours (`IMAGE_RETENTION_SECONDS = 86400`) during upload requests and application startup.

---

## 6. Production Limitations & Scaling Roadmap

The provided Docker Compose configuration is designed for **local development, CI verification, and single-host VM deployment**.

For production deployments at scale, the following enterprise infrastructure components are recommended:

| Production Component | Docker Compose (Current) | Production Architecture (Recommended) |
| :--- | :--- | :--- |
| **Relational Database** | Containerized PostgreSQL 16 on local volume | Managed Relational Database (AWS RDS PostgreSQL / Google Cloud SQL) with automated backups and read-replicas |
| **Media Storage** | Local host volume mount (`/app/uploads`) | S3-compatible Object Storage (AWS S3 / Google Cloud Storage) with CDN delivery |
| **Secrets Management** | Local `.env` file | Enterprise Secret Vault (AWS Secrets Manager / Google Secret Manager / HashiCorp Vault) |
| **Container Orchestration** | Docker Compose on single VM | Managed Container Service (Kubernetes / AWS ECS / Google Cloud Run) with horizontal pod autoscaling |
| **TLS & Routing** | Reverse proxy on port 80 | TLS Termination via Cloud Load Balancer (AWS ALB / Cloudflare) with automated SSL certificates |
| **Telemetry & Observability** | In-process `/api/health` probe & console logs | Distributed Tracing & Metrics (OpenTelemetry, Prometheus, Grafana, Datadog) |

---

## 7. Database Disaster Recovery Runbook

### 7.1 Creating a Consistent Database Backup
Run `pg_dump` against the running database container. In production, execute this before running migrations or deploys:
```bash
# Dump custom binary format with compression (recommended):
docker compose exec -t db pg_dump -U ${POSTGRES_USER:-nutrilens_user} -d ${POSTGRES_DB:-nutrilens_db} -Fc > nutrilens_backup_$(date +%Y%m%d_%H%M%S).dump

# Or plain SQL format for inspection:
docker compose exec -t db pg_dump -U ${POSTGRES_USER:-nutrilens_user} -d ${POSTGRES_DB:-nutrilens_db} > nutrilens_backup_$(date +%Y%m%d_%H%M%S).sql
```

### 7.2 Restoring from Backup
To restore a snapshot into a new or existing database container:
```bash
# Stop application traffic during restore:
docker compose stop backend frontend

# Restore custom format dump:
docker compose exec -T db pg_restore -U ${POSTGRES_USER:-nutrilens_user} -d ${POSTGRES_DB:-nutrilens_db} --clean --if-exists < nutrilens_backup.dump

# Or restore plain SQL dump:
docker compose exec -T db psql -U ${POSTGRES_USER:-nutrilens_user} -d ${POSTGRES_DB:-nutrilens_db} < nutrilens_backup.sql

# Verify schema and migration state after restore:
docker compose run --rm backend alembic current

# Restart application services:
docker compose start backend frontend
```

### 7.3 Data Segregation: Disposable Test Data vs Persistent Data
- **Test / Verification Accounts**: Accounts created during automated testing or CI runs (e.g. `runtime_tester@nutrilens.app`) are ephemeral and run against isolated temporary containers or SQLite `:memory:`.
- **Customer Production Accounts**: Stored in persistent volume `postgres_data`. When updating or deploying containers, use `docker compose down` (NEVER `docker compose down -v` in production) to preserve customer history and profiles.

---

## 8. Secret Rotation Runbook

### 8.1 Rotating `JWT_SECRET_KEY`
- Generate new secret: `NEW_SECRET=$(openssl rand -hex 32)`
- Update `JWT_SECRET_KEY` in production `.env` or cloud secret manager.
- Re-deploy or restart backend: `docker compose up -d backend`
- *Impact*: Active user JWT tokens issued under the prior key become invalid; users will be required to re-authenticate via `/api/auth/login`.

### 8.2 Rotating `GEMINI_API_KEY`
- Obtain new API key from Google AI Studio.
- Update `GEMINI_API_KEY` in production `.env`.
- Re-deploy or restart backend: `docker compose up -d backend`
- *Impact*: Zero downtime. Real multimodal image analysis continues uninterrupted.

### 8.3 Rotating Database Password
- Update password in PostgreSQL via SQL: `ALTER USER nutrilens_user WITH PASSWORD 'new_strong_password';`
- Update `POSTGRES_PASSWORD` and `DATABASE_URL` in `.env`.
- Re-deploy stack: `docker compose up -d`
- *Impact*: Brief restart of backend and db connection pool.

---

## 9. Pre-Deployment Cloud Readiness Audit Checklist

Before pointing production DNS or opening public traffic, verify each check:

- [ ] **1. Secrets Hygiene**: Verified that `JWT_SECRET_KEY` is >=32 chars and random (`openssl rand -hex 32`). No default fallbacks.
- [ ] **2. Database Credentials**: Unique, non-default username and password configured for PostgreSQL.
- [ ] **3. AI Provider Configuration**: `AI_PROVIDER=gemini` and valid `GEMINI_API_KEY` set. `/api/health` reports `ai_configured: true` and `ai_status: "ready"`.
- [ ] **4. Port Isolation**: Host loopback bindings (`127.0.0.1`) verified for PostgreSQL (5432) and backend (8000). Direct DB access from the internet is blocked.
- [ ] **5. Ingress & TLS Termination**: Frontend Nginx (or cloud load balancer) configured with valid SSL/TLS certificates and HTTPS redirection.
- [ ] **6. CORS Allowlist**: `CORS_ORIGINS` restricted to verified production frontend domains (no `*` wildcards).
- [ ] **7. Database Migrations**: `alembic current` confirms schema matches `head`. Automated backup snapshot created before release.
- [ ] **8. Upload Security**: File size limit (10MB), Pillow decompression bomb protection (25MP), and transient cleanup (24h retention) active.
- [ ] **9. Rate Limiting**: In-memory sliding window rate limiter protects `/api/analyze` against excessive AI consumption (15 req/min/IP).
- [ ] **10. User Isolation Verified**: Automated regression tests pass, guaranteeing cross-user profile, target, and meal history separation.


