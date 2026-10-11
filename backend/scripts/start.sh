#!/bin/sh
# ========================================================
# NutriLens — Production & Free-Tier Container Entrypoint
# ========================================================
# 1. Runs database pre-flight readiness checks and Alembic migrations.
# 2. On single-instance staging/free-tier hosts (e.g. Render Free Tier),
#    this executes before launching FastAPI because pre-deploy commands
#    are unavailable on free plans.
# 3. If migrations fail, the process aborts immediately (set -e).
# 4. Listens on $PORT provided by platform (Render default: 10000, local: 8000).
# ========================================================
set -e

echo "==> [NutriLens] Checking database connectivity and applying Alembic migrations..."
python scripts/run_staging_migrations.py

PORT="${PORT:-8000}"
echo "==> [NutriLens] Starting FastAPI uvicorn server on 0.0.0.0:${PORT}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" --proxy-headers
