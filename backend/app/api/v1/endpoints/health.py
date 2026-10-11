import os
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database.session import get_db
from app.core.config import settings
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["Health"])
def get_health_status(response: Response, db: Session = Depends(get_db)):
    """
    Health check endpoint verifying application, database connectivity,
    transient storage accessibility, and runtime configuration status.
    """
    db_status = "connected"
    db_latency_ms = None
    try:
        t0 = time.time()
        db.execute(text("SELECT 1"))
        db_latency_ms = round((time.time() - t0) * 1000, 2)
    except Exception:
        db_status = "unreachable"

    # Verify upload directory storage readiness
    storage_status = "ready"
    try:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        if not os.access(settings.UPLOAD_DIR, os.W_OK):
            storage_status = "read_only"
    except Exception:
        storage_status = "unavailable"

    is_healthy = db_status == "connected" and storage_status == "ready"
    overall_status = "healthy" if is_healthy else "degraded"

    if not is_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    # Assess AI vision provider configuration state
    provider_lower = (settings.AI_PROVIDER or "").lower().strip()
    ai_status = "ready"
    ai_configured = True

    if provider_lower == "gemini":
        has_key = bool(
            settings.GEMINI_API_KEY
            and settings.GEMINI_API_KEY.strip()
            not in {
                "",
                "your_gemini_api_key_here",
                "your_gemini_api_key_from_google_ai_studio_here",
                "placeholder",
                "changeme",
            }
        )
        if has_key:
            ai_status = "ready"
            ai_configured = True
        else:
            ai_status = "unconfigured"
            ai_configured = False
    elif provider_lower == "placeholder":
        ai_status = "mock_mode"
        ai_configured = True
    else:
        ai_status = "unknown"
        ai_configured = False

    return HealthResponse(
        status=overall_status,
        app=settings.APP_NAME,
        version=settings.APP_VERSION,
        environment=settings.ENVIRONMENT,
        database=db_status,
        database_latency_ms=db_latency_ms,
        storage=storage_status,
        ai_provider=settings.AI_PROVIDER,
        ai_status=ai_status,
        ai_configured=ai_configured,
        timestamp=datetime.now(timezone.utc),
    )
