import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient

from app.core.config import Settings, settings


def test_production_settings_rejects_default_jwt_secret():
    """Verify that Settings fails safely if default JWT secret is used in production."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="nutrilens-secret-key-change-in-production",
            DATABASE_URL="postgresql://prod_user:strong_prod_pass_12345@db:5432/prod_db",
        )
    assert "JWT_SECRET_KEY must be explicitly set" in str(exc_info.value)


def test_production_settings_rejects_short_jwt_secret():
    """Verify that Settings rejects short JWT secrets (< 32 chars) in production."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="short-secret-1234",
            DATABASE_URL="postgresql://prod_user:strong_prod_pass_12345@db:5432/prod_db",
        )
    assert "at least 32 characters long" in str(exc_info.value)


def test_production_settings_rejects_default_database_password():
    """Verify that Settings rejects default database password in production."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="a" * 32,
            DATABASE_URL="postgresql://user:nutrilens_password@db:5432/nutrilens_db",
        )
    assert "contains default development password" in str(exc_info.value)


def test_production_settings_accepts_strong_secrets():
    """Verify that Settings succeeds when strong credentials are provided in production."""
    valid_settings = Settings(
        ENVIRONMENT="production",
        JWT_SECRET_KEY="a" * 32,
        DATABASE_URL="postgresql://prod_user:super_secret_db_pass_9988@db:5432/prod_db",
    )
    assert valid_settings.is_production() is True
    assert valid_settings.JWT_SECRET_KEY == "a" * 32


def test_development_settings_allows_convenient_defaults():
    """Verify that development mode allows default zero-config local execution."""
    dev_settings = Settings(ENVIRONMENT="development")
    assert dev_settings.is_production() is False


def test_analyze_with_gemini_missing_key_returns_503(client: TestClient, sample_image_bytes: bytes):
    """
    Verify that when AI_PROVIDER is 'gemini' and GEMINI_API_KEY is missing,
    the API returns HTTP 503 instead of silently pretending analysis succeeded.
    """
    orig_provider = settings.AI_PROVIDER
    orig_key = settings.GEMINI_API_KEY
    try:
        settings.AI_PROVIDER = "gemini"
        settings.GEMINI_API_KEY = None

        files = {"image": ("food.jpg", sample_image_bytes, "image/jpeg")}
        response = client.post("/api/analyze", files=files)

        assert response.status_code == 503
        data = response.json()
        assert "GEMINI_API_KEY" in data["detail"]
        assert "not configured" in data["detail"].lower()
    finally:
        settings.AI_PROVIDER = orig_provider
        settings.GEMINI_API_KEY = orig_key


def test_production_settings_rejects_placeholder_ai_by_default():
    """Verify that Settings fails safely if AI_PROVIDER is placeholder in production without explicit override."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="a" * 32,
            DATABASE_URL="postgresql://prod_user:strong_prod_pass_12345@db:5432/prod_db",
            AI_PROVIDER="placeholder",
            ALLOW_PLACEHOLDER_AI=False,
        )
    assert "AI_PROVIDER cannot be 'placeholder' in production" in str(exc_info.value)


def test_production_settings_accepts_placeholder_ai_with_explicit_override():
    """Verify that Settings permits placeholder AI in production if ALLOW_PLACEHOLDER_AI is True."""
    cfg = Settings(
        ENVIRONMENT="production",
        JWT_SECRET_KEY="a" * 32,
        DATABASE_URL="postgresql://prod_user:strong_prod_pass_12345@db:5432/prod_db",
        AI_PROVIDER="placeholder",
        ALLOW_PLACEHOLDER_AI=True,
    )
    assert cfg.AI_PROVIDER == "placeholder"
    assert cfg.ALLOW_PLACEHOLDER_AI is True


def test_production_settings_rejects_placeholder_gemini_api_key():
    """Verify that Settings fails if GEMINI_API_KEY is an unconfigured template string in production."""
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="a" * 32,
            DATABASE_URL="postgresql://prod_user:strong_prod_pass_12345@db:5432/prod_db",
            GEMINI_API_KEY="your_gemini_api_key_here",
        )
    assert "GEMINI_API_KEY contains an unconfigured placeholder value" in str(exc_info.value)


def test_health_endpoint_does_not_leak_secrets(client: TestClient):
    """Verify that health check endpoint returns telemetry without leaking any secrets."""
    response = client.get("/api/health")
    assert response.status_code == 200
    text_content = response.text.lower()
    assert "jwt_secret_key" not in text_content
    assert "gemini_api_key" not in text_content
    assert "password" not in text_content


def test_health_endpoint_reports_ai_provider_and_status(client: TestClient):
    """Verify that health endpoint reports ai_provider, ai_status, and ai_configured accurately."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "ai_provider" in data
    assert "ai_status" in data
    assert "ai_configured" in data
    assert isinstance(data["ai_configured"], bool)


def test_staging_settings_enforces_hardened_security_guardrails():
    """Verify that ENVIRONMENT=staging enforces strong JWT secret and DB password."""
    # 1. Staging rejects default JWT secret
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="staging",
            JWT_SECRET_KEY="nutrilens-secret-key-change-in-production",
            DATABASE_URL="postgresql://staging_user:strong_pass_12345@db:5432/staging_db",
        )
    assert "JWT_SECRET_KEY must be explicitly set" in str(exc_info.value)

    # 2. Staging rejects default database password
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="staging",
            JWT_SECRET_KEY="b" * 32,
            DATABASE_URL="postgresql://staging_user:nutrilens_password@db:5432/staging_db",
        )
    assert "contains default development password" in str(exc_info.value)

    # 3. Staging rejects SQLite to prevent silent fallback to ephemeral disk
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            ENVIRONMENT="staging",
            JWT_SECRET_KEY="b" * 32,
            DATABASE_URL="sqlite:///./nutrilens.db",
            ALLOW_PLACEHOLDER_AI=True,
        )
    assert "DATABASE_URL cannot be SQLite" in str(exc_info.value)

    # 4. Staging accepts strong secrets
    valid_staging = Settings(
        ENVIRONMENT="staging",
        JWT_SECRET_KEY="b" * 32,
        DATABASE_URL="postgresql://staging_user:strong_pass_12345@db:5432/staging_db",
        ALLOW_PLACEHOLDER_AI=True,
    )
    assert valid_staging.is_staging() is True
    assert valid_staging.is_hardened_environment() is True
    assert valid_staging.is_production() is False


def test_database_url_normalization_handles_postgres_and_postgresql_with_query_params():
    """Verify that assemble_database_url normalizes both postgres:// and postgresql:// while preserving params."""
    # 1. postgresql:// with sslmode parameter (Neon style)
    cfg1 = Settings(DATABASE_URL="postgresql://user:pass@ep-test.neon.tech/neondb?sslmode=require")
    assert cfg1.DATABASE_URL == "postgresql+psycopg2://user:pass@ep-test.neon.tech/neondb?sslmode=require"

    # 2. legacy postgres:// URL (Heroku / legacy PaaS style)
    cfg2 = Settings(DATABASE_URL="postgres://user:pass@host:5432/db")
    assert cfg2.DATABASE_URL == "postgresql+psycopg2://user:pass@host:5432/db"

    # 3. sqlite:// is untouched
    cfg3 = Settings(DATABASE_URL="sqlite:///./test.db")
    assert cfg3.DATABASE_URL == "sqlite:///./test.db"


def test_database_url_normalization_handles_url_encoded_credentials():
    """Verify that credentials with URL-encoded characters are preserved during dialect normalization."""
    url = "postgresql://user_app:p%40ss%23word%21@ep-sample.neon.tech:5432/neondb?sslmode=require"
    cfg = Settings(DATABASE_URL=url)
    assert cfg.DATABASE_URL == "postgresql+psycopg2://user_app:p%40ss%23word%21@ep-sample.neon.tech:5432/neondb?sslmode=require"


def test_cors_origins_normalization_strips_trailing_slashes():
    """Verify that CORS origins strip trailing slashes to prevent browser CORS preflight mismatches."""
    cfg = Settings(CORS_ORIGINS="https://nutrilens.vercel.app/, https://staging.nutrilens.app///")
    assert cfg.CORS_ORIGINS == ["https://nutrilens.vercel.app", "https://staging.nutrilens.app"]


def test_gemini_model_normalization_strips_models_prefix_and_quotes():
    """Verify that GEMINI_MODEL default is gemini-3.8-flash and leading models/ prefixes are stripped."""
    cfg_default = Settings()
    assert cfg_default.GEMINI_MODEL == "gemini-3.8-flash"

    cfg_prefix = Settings(GEMINI_MODEL="models/gemini-3.8-flash")
    assert cfg_prefix.GEMINI_MODEL == "gemini-3.8-flash"

    cfg_quoted = Settings(GEMINI_MODEL='"models/gemini-3.8-flash"')
    assert cfg_quoted.GEMINI_MODEL == "gemini-3.8-flash"


def test_sanitize_db_error_redacts_password():
    """Verify that _sanitize_db_error masks plain text passwords from connection error messages."""
    from scripts.run_staging_migrations import _sanitize_db_error
    from sqlalchemy import create_engine

    engine = create_engine("postgresql+psycopg2://testuser:superSecretPassword123@db.example.com/testdb")
    raw_error = "OperationalError: password authentication failed for user 'testuser' with password 'superSecretPassword123'"
    sanitized = _sanitize_db_error(raw_error, engine)
    assert "superSecretPassword123" not in sanitized
    assert "******" in sanitized
