import os
from typing import List, Union, Optional
from pydantic import field_validator
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
        return ["http://localhost:5173", "http://localhost:3000"]

    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
