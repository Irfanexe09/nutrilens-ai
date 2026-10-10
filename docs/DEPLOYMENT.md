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
| `GEMINI_MODEL` | Google vision model identifier | `gemini-2.5-flash` |
| `RATE_LIMIT_ANALYZE_PER_MINUTE` | Per-client rate limit for vision calls | `15` |
| `MAX_UPLOAD_SIZE_BYTES` | File upload ceiling in bytes | `10485760` (10 MB) |

---

## 3. Deployment Procedure

### Step 1: Clone Repository & Create `.env`
```bash
git clone https://github.com/Irfanexe09/nutrilens-ai.git
cd nutrilens-ai
cp .env.example .env
# Edit .env with your production credentials:
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

## 4. Database Migrations & Upgrades

The `nutrilens-migration` service automatically runs `alembic -c alembic.ini upgrade head` upon stack startup before the backend starts listening.

To run migrations manually or check revision history:
```bash
docker compose run --rm backend alembic current
docker compose run --rm backend alembic upgrade head
```

---

## 5. Storage Volumes & Retention Pruning

1. **PostgreSQL Data Volume**: Stored in Docker named volume `postgres_data`. Back up with standard `pg_dump`:
   ```bash
   docker exec -t nutrilens-db pg_dump -U nutrilens_user nutrilens_db > backup_$(date +%F).sql
   ```
2. **Food Photography Uploads**: Mounted at `./backend/uploads:/app/uploads`. The backend automatically prunes uploads older than 24 hours (`IMAGE_RETENTION_SECONDS = 86400`) during upload requests and application startup.
