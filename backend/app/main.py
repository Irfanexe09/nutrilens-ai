import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import logging

from app.core.config import settings
from app.database.session import engine, SessionLocal
from app.database.base import Base
from app.models import (
    FoodItem,
    Meal,
    MealItem,
    User,
    UserProfile,
    DailyNutritionTarget,
)  # Ensure all models are registered
from app.services.food_service import FoodService
from app.api.v1.api import api_router
from app.core.firebase_admin import initialize_firebase

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nutrilens")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure tables exist and seed database if empty
    logger.info(f"Starting NutriLens in '{settings.ENVIRONMENT}' mode (debug={settings.DEBUG})")
    logger.info(f"Configured allowed CORS origins: {settings.CORS_ORIGINS}")
    logger.info("Initializing database schema...")
    Base.metadata.create_all(bind=engine)
    
    # Prune stale transient food image uploads on startup
    try:
        from app.services.analysis_service import AnalysisService
        cleaned = AnalysisService.cleanup_old_uploads(settings.IMAGE_RETENTION_SECONDS)
        if cleaned > 0:
            logger.info(f"Cleaned up {cleaned} stale transient food upload files.")
    except Exception as e:
        logger.warning(f"Notice during upload cleanup: {e}")

    # Auto-seed initial nutrition data
    db = SessionLocal()
    try:
        service = FoodService(db)
        seeded = service.seed_database()
        if seeded > 0:
            logger.info(f"Seeded {seeded} Indian food items into the nutrition database.")
    except Exception as e:
        logger.warning(f"Database auto-seeding notice: {e}")
    finally:
        db.close()

    # Initialize Firebase Admin SDK for server-side ID token verification
    try:
        fb_ready = initialize_firebase()
        if fb_ready:
            logger.info("Firebase Admin SDK ready for ID token verification.")
        else:
            logger.warning("Firebase Admin SDK not available. Firebase auth endpoints will return 503.")
    except Exception as e:
        logger.warning(f"Firebase Admin initialization notice: {e}")

    yield
    logger.info("Shutting down NutriLens application...")


app = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure uploads directory exists and mount static route
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include API Router under /api
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


# Root landing endpoint
@app.get("/", tags=["Root"])
def root():
    return {
        "app": settings.APP_NAME,
        "tagline": "See your food. Understand your nutrition.",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": f"{settings.API_V1_PREFIX}/health",
    }


# Global safe exception handler: prevents exposing internal stack traces to users
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error on {request.method} {request.url.path}: {exc}", exc_info=True)
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected internal server error occurred. Please try again later.",
            "path": request.url.path,
        },
    )
    # Ensure CORS headers are preserved even on unhandled 500 exceptions
    origin = request.headers.get("origin")
    if origin and (origin in settings.CORS_ORIGINS or "*" in settings.CORS_ORIGINS):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Vary"] = "Origin"
    return response
