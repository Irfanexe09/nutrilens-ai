import os
import re
import json
import ast
from urllib.parse import urlparse, urlunparse
from typing import List, Union, Optional, Any
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
    CORS_ORIGINS: Union[List[str], str] = [
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

    ALLOW_PLACEHOLDER_AI: bool = False

    # Firebase Authentication (server-side ID token verification)
    FIREBASE_PROJECT_ID: Optional[str] = "nutrilens-dc1f9"
    FIREBASE_SERVICE_ACCOUNT_JSON: Optional[str] = None  # Base64 or raw JSON from env var

    # AI Configuration (Phase 2: Gemini multimodal vision model)
    AI_PROVIDER: str = "gemini"  # "gemini" or "placeholder"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.8-flash"
    GEMINI_FALLBACK_MODEL: Optional[str] = "gemini-2.0-flash"
    AI_TIMEOUT_SECONDS: float = 30.0  # Total end-to-end operation deadline
    AI_PER_ATTEMPT_TIMEOUT_SECONDS: float = 12.0  # Per-call timeout ceiling to prevent single attempt monopolizing deadline
    AI_MAX_RETRIES: int = 2
    AI_RETRY_BASE_DELAY_SECONDS: float = 1.0
    AI_RETRY_MAX_DELAY_SECONDS: float = 3.0

    @staticmethod
    def _clean_single_origin(origin: Any) -> str:
        """
        Clean, unquote, and normalize an individual CORS origin string.
        Strips surrounding single/double quotes, trailing slashes, and whitespace.
        Normalizes HTTP scheme and hostname to lowercase while preserving port numbers.
        """
        if not isinstance(origin, str):
            return ""
        cleaned = origin.strip().strip("\"'").rstrip("/").strip("\"'")
        if not cleaned:
            return ""
        try:
            parsed = urlparse(cleaned)
            if parsed.scheme and parsed.netloc:
                netloc = parsed.netloc.lower()
                cleaned = urlunparse((parsed.scheme.lower(), netloc, parsed.path, parsed.params, parsed.query, parsed.fragment)).rstrip("/")
        except Exception:
            pass
        return cleaned

    @field_validator("CORS_ORIGINS", mode="after")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[Any], None]) -> List[str]:
        """
        Assemble and sanitize CORS origins from environment variables or config files.
        Accepts comma/semicolon/newline-delimited strings, JSON array strings,
        single-quoted Python lists, or Python lists.
        Always returns a canonical List[str] with normalized origins (no trailing slashes, no quotes).
        """
        defaults = [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
        ]
        if not v:
            return defaults

        if isinstance(v, str):
            v_str = v.strip()
            # Handle JSON array string or Python list string e.g. ["https://..."] or ['https://...']
            if v_str.startswith("[") and v_str.endswith("]"):
                for parser in (json.loads, ast.literal_eval):
                    try:
                        parsed = parser(v_str)
                        if isinstance(parsed, list):
                            res = [cls._clean_single_origin(x) for x in parsed if cls._clean_single_origin(x)]
                            if res:
                                return res
                    except Exception:
                        pass

            # Comma, semicolon, or newline separated strings
            raw_items = re.split(r"[,;\n\r]+", v_str)
            res = [cls._clean_single_origin(x) for x in raw_items if cls._clean_single_origin(x)]
            return res if res else defaults

        elif isinstance(v, list):
            res = [cls._clean_single_origin(x) for x in v if cls._clean_single_origin(x)]
            return res if res else defaults

        return defaults

    @field_validator("GEMINI_MODEL", mode="before")
    @classmethod
    def assemble_gemini_model(cls, v: Optional[str]) -> str:
        """
        Normalize the Gemini vision model identifier.
        Strips surrounding whitespace, quotes, and any leading 'models/' prefix
        to avoid accidental duplication of the prefix when passed to the SDK.
        """
        if not v or not isinstance(v, str) or not v.strip():
            return "gemini-3.8-flash"
        cleaned = v.strip().strip("\"'")
        if cleaned.startswith("models/"):
            cleaned = cleaned[len("models/"):]
        return cleaned or "gemini-3.8-flash"

    @field_validator("GEMINI_FALLBACK_MODEL", mode="before")
    @classmethod
    def assemble_gemini_fallback_model(cls, v: Optional[str]) -> Optional[str]:
        """
        Normalize the Gemini fallback model identifier.
        Strips surrounding whitespace, quotes, and any leading 'models/' prefix.
        Returns None if empty, false, null, or disabled.
        """
        if not v or not isinstance(v, str) or not v.strip():
            return None
        cleaned = v.strip().strip("\"'")
        if cleaned.startswith("models/"):
            cleaned = cleaned[len("models/"):]
        if cleaned.lower() in ("none", "null", "disabled", "false", ""):
            return None
        return cleaned or None

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_database_url(cls, v: str) -> str:
        """
        Normalize postgresql:// and legacy postgres:// URLs to postgresql+psycopg2://
        to guarantee compatibility with psycopg2-binary under SQLAlchemy 2.0.
        Preserves all query parameters such as ?sslmode=require.
        """
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+psycopg2://", 1)
            elif v.startswith("postgresql://"):
                return v.replace("postgresql://", "postgresql+psycopg2://", 1)
        return v

    @model_validator(mode="after")
    def validate_production_configuration(self) -> "Settings":
        """
        Enforce strict security guardrails when ENVIRONMENT is 'production' or 'staging'.
        Guarantees that default development secrets and passwords cannot leak into staging/production.
        """
        env_label = self.ENVIRONMENT.lower()
        if self.is_hardened_environment():
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
                    f"{env_label.capitalize()} configuration error: JWT_SECRET_KEY must be explicitly set to a strong, "
                    "cryptographically random secret (e.g. generated via 'openssl rand -hex 32'). "
                    f"Using default or empty keys in {env_label} is forbidden."
                )
            if len(self.JWT_SECRET_KEY.strip()) < 32:
                raise ValueError(
                    f"{env_label.capitalize()} configuration error: JWT_SECRET_KEY must be at least 32 characters long."
                )

            # 2. Database Password & Dialect Validation
            if self.DATABASE_URL.startswith("sqlite"):
                raise ValueError(
                    f"{env_label.capitalize()} configuration error: DATABASE_URL cannot be SQLite in {env_label}. "
                    "A persistent managed PostgreSQL database (e.g. Neon) is required to prevent data loss."
                )

            if "nutrilens_password" in self.DATABASE_URL:
                raise ValueError(
                    f"{env_label.capitalize()} configuration error: DATABASE_URL contains default development password "
                    f"'nutrilens_password'. Please provide a secure, unique database password in {env_label}."
                )

            # 3. AI Provider and API Key Guardrails in Hardened Environments
            if self.AI_PROVIDER.lower() == "placeholder" and not self.ALLOW_PLACEHOLDER_AI:
                raise ValueError(
                    f"{env_label.capitalize()} configuration error: AI_PROVIDER cannot be 'placeholder' in {env_label}. "
                    "NutriLens requires real multimodal AI integration (AI_PROVIDER=gemini) with a valid GEMINI_API_KEY. "
                    f"If intentionally running placeholder mode for non-live {env_label} tests, explicitly set ALLOW_PLACEHOLDER_AI=True."
                )

            if self.GEMINI_API_KEY:
                insecure_gemini_keys = {
                    "your_gemini_api_key_here",
                    "your_gemini_api_key_from_google_ai_studio_here",
                    "placeholder",
                    "changeme",
                    "your-gemini-api-key",
                }
                if self.GEMINI_API_KEY.strip().lower() in insecure_gemini_keys:
                    raise ValueError(
                        f"{env_label.capitalize()} configuration error: GEMINI_API_KEY contains an unconfigured placeholder value. "
                        "Please provide a genuine Gemini API key from Google AI Studio."
                    )

            # 4. CORS Origins Guardrails in Hardened Environments
            if "*" in self.CORS_ORIGINS:
                raise ValueError(
                    f"{env_label.capitalize()} configuration error: CORS_ORIGINS cannot contain wildcard '*' "
                    "when credentials are enabled. Explicit origins (e.g. your Vercel frontend URL) must be specified."
                )
        return self

    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    def is_staging(self) -> bool:
        return self.ENVIRONMENT.lower() == "staging"

    def is_hardened_environment(self) -> bool:
        return self.ENVIRONMENT.lower() in {"production", "staging"}

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
