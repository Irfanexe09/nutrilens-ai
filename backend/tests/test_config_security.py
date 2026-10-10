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


def test_health_endpoint_does_not_leak_secrets(client: TestClient):
    """Verify that health check endpoint returns telemetry without leaking any secrets."""
    response = client.get("/api/health")
    assert response.status_code == 200
    text_content = response.text.lower()
    assert "jwt_secret_key" not in text_content
    assert "gemini_api_key" not in text_content
    assert "password" not in text_content
