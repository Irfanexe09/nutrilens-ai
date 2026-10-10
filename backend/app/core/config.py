import os
from typing import List, Union, Optional
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "NutriLens"
    APP_DESCRIPTION: str = "AI-Powered Food & Nutrition Intelligence Platform"
    ENVIRONMENT: str = "development"  # "development", "production", "testing"
    APP_VERSION: str = "0.2.0"
    API_V1_PREFIX: str = "/api"
    DEBUG: bool = False

    # Authentication & Security
    JWT_SECRET_KEY: str = "nutrilens-secret-key-super-secure-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database
    # Defaults to SQLite for immediate local zero-config runs, fully supports PostgreSQL
    DATABASE_URL: str = "sqlite:///./nutrilens.db"

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    # File uploads & Image Security
    UPLOAD_DIR: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
        "uploads",
    )
    MAX_UPLOAD_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
    MAX_IMAGE_PIXELS: int = 25_000_000  # 25 megapixels (Pillow decompression bomb protection)
    IMAGE_RETENTION_SECONDS: int = 86400  # 24 hours transient upload retention
    ALLOWED_IMAGE_TYPES: List[str] = ["image/jpeg", "image/png", "image/webp"]

    # Rate Limiting
    RATE_LIMIT_ANALYZE_PER_MINUTE: int = 15

    # AI Configuration (Phase 2: Gemini multimodal vision model)
    AI_PROVIDER: str = "gemini"  # "gemini" or "placeholder"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    AI_TIMEOUT_SECONDS: float = 25.0

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            origins = [i.strip() for i in v.split(",") if i.strip()]
            return origins if origins else ["http://localhost:5173", "http://localhost:3000"]
        elif isinstance(v, list):
            return v
    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_database_url(cls, v: str) -> str:
        """
        Normalize standard postgresql:// URLs to postgresql+psycopg2://
        to guarantee compatibility with psycopg2-binary under SQLAlchemy 2.0.
        """
        if isinstance(v, str) and v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+psycopg2://", 1)
        return v

    @model_validator(mode="after")
    def validate_production_configuration(self) -> "Settings":
        """
        Enforce strict security guardrails when ENVIRONMENT is 'production'.
        Guarantees that default development secrets and passwords cannot leak into production.
        """
        if self.is_production():
            insecure_secret_fallbacks = {
                "nutrilens-secret-key-super-secure-change-in-production",
                "nutrilens-secret-key-change-in-production",
                "secret",
                "changeme",
                "password",
            }
            # 1. JWT Secret Validation
            if not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY.strip() in insecure_secret_fallbacks:
                raise ValueError(
                    "Production configuration error: JWT_SECRET_KEY must be explicitly set to a strong, "
                    "cryptographically random secret (e.g. generated via 'openssl rand -hex 32'). "
                    "Using default or empty keys in production is forbidden."
                )
            if len(self.JWT_SECRET_KEY.strip()) < 32:
                raise ValueError(
                    "Production configuration error: JWT_SECRET_KEY must be at least 32 characters long."
                )

            # 2. Database Password Validation
            if "nutrilens_password" in self.DATABASE_URL:
                raise ValueError(
                    "Production configuration error: DATABASE_URL contains default development password "
                    "'nutrilens_password'. Please provide a secure, unique database password in production."
                )
        return self

    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
