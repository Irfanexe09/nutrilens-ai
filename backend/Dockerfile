# ==========================================
# Multi-Stage Hardened Backend Dockerfile
# ==========================================

# Stage 1: Build dependencies and wheels
FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt


# Stage 2: Minimal hardened production runtime
FROM python:3.12-slim AS runtime

WORKDIR /app

# Install runtime shared libraries and curl for container health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create unprivileged system user and group
RUN groupadd -r -g 1001 appgroup && \
    useradd -r -u 1001 -g appgroup -s /sbin/nologin -d /app appuser

# Copy installed Python packages from builder stage with correct unprivileged ownership
COPY --from=builder --chown=appuser:appgroup /root/.local /home/appuser/.local

# Ensure PATH and PYTHONPATH include unprivileged user packages
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONPATH=/home/appuser/.local/lib/python3.12/site-packages:/app:$PYTHONPATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy application source code
COPY --chown=appuser:appgroup . .

# Create uploads directory and grant ownership to appuser
RUN mkdir -p uploads && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# Container health probe verifying API readiness
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
