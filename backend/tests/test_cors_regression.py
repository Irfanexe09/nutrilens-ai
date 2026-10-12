import pytest
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app, global_exception_handler


VERCEL_ORIGIN = "https://nutrilens-ai-silk.vercel.app"
UNAPPROVED_ORIGIN = "https://malicious-attacker.com"


@pytest.fixture
def cors_test_client(monkeypatch):
    """
    TestClient configured with the exact production Vercel frontend origin.
    Re-creates the FastAPI application instance with CORSMiddleware using the test origin.
    """
    test_settings = Settings(
        CORS_ORIGINS=f"{VERCEL_ORIGIN}, http://localhost:5173"
    )
    monkeypatch.setattr("app.core.config.settings", test_settings)

    # Instantiate test app with the same middleware and routers as app.main
    test_app = FastAPI()
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=test_settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Mount the actual app routers and handlers
    from app.api.v1.api import api_router
    test_app.include_router(api_router, prefix="/api")
    test_app.add_exception_handler(Exception, global_exception_handler)

    return TestClient(test_app, raise_server_exceptions=False)


def test_get_health_from_configured_origin_receives_cors_headers(cors_test_client):
    """
    Verify that GET /api/health from the configured Vercel origin receives
    the Access-Control-Allow-Origin header and Access-Control-Allow-Credentials.
    """
    response = cors_test_client.get(
        "/api/health",
        headers={"Origin": VERCEL_ORIGIN},
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == VERCEL_ORIGIN
    assert response.headers.get("access-control-allow-credentials") == "true"
    assert "Origin" in response.headers.get("vary", "")


def test_get_foods_from_configured_origin_receives_cors_headers(cors_test_client):
    """
    Verify that GET /api/foods from the configured Vercel origin receives
    the correct CORS response headers.
    """
    response = cors_test_client.get(
        "/api/foods?limit=50",
        headers={"Origin": VERCEL_ORIGIN},
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == VERCEL_ORIGIN
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_options_preflight_login_succeeds_with_cors_headers(cors_test_client):
    """
    Verify that an OPTIONS preflight request for POST /api/auth/login succeeds (HTTP 200)
    and includes:
    - Access-Control-Allow-Origin matching the Vercel origin
    - Access-Control-Allow-Methods including POST
    - Access-Control-Allow-Headers including content-type and authorization
    - Access-Control-Allow-Credentials: true
    """
    response = cors_test_client.options(
        "/api/auth/login",
        headers={
            "Origin": VERCEL_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == VERCEL_ORIGIN
    assert response.headers.get("access-control-allow-credentials") == "true"
    assert "POST" in response.headers.get("access-control-allow-methods", "")
    allowed_headers = response.headers.get("access-control-allow-headers", "").lower()
    assert "content-type" in allowed_headers
    assert "authorization" in allowed_headers


def test_unapproved_origin_is_denied_cors_access(cors_test_client):
    """
    Verify that an unapproved origin:
    1. Fails OPTIONS preflight with HTTP 400 'Disallowed CORS origin' and NO allow-origin header.
    2. Receives NO Access-Control-Allow-Origin header on simple GET requests.
    """
    # 1. Preflight rejection
    preflight_res = cors_test_client.options(
        "/api/auth/login",
        headers={
            "Origin": UNAPPROVED_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert preflight_res.status_code == 400
    assert "Disallowed CORS origin" in preflight_res.text
    assert "access-control-allow-origin" not in preflight_res.headers

    # 2. Simple GET request has no allow-origin header
    get_res = cors_test_client.get(
        "/api/health",
        headers={"Origin": UNAPPROVED_ORIGIN},
    )
    assert get_res.status_code == 200
    assert "access-control-allow-origin" not in get_res.headers


def test_cors_origins_normalizes_trailing_slashes_and_quotes():
    """
    Verify that Settings normalizes origins that contain trailing slashes,
    surrounding quotes (single or double), whitespace, or JSON-array brackets.
    """
    # Trailing slash
    cfg1 = Settings(CORS_ORIGINS=f"{VERCEL_ORIGIN}/")
    assert cfg1.CORS_ORIGINS == [VERCEL_ORIGIN]

    # Multiple trailing slashes
    cfg2 = Settings(CORS_ORIGINS=f"{VERCEL_ORIGIN}///")
    assert cfg2.CORS_ORIGINS == [VERCEL_ORIGIN]

    # Double quotes
    cfg3 = Settings(CORS_ORIGINS=f'"{VERCEL_ORIGIN}"')
    assert cfg3.CORS_ORIGINS == [VERCEL_ORIGIN]

    # Single quotes
    cfg4 = Settings(CORS_ORIGINS=f"'{VERCEL_ORIGIN}'")
    assert cfg4.CORS_ORIGINS == [VERCEL_ORIGIN]

    # Quotes with trailing slash
    cfg5 = Settings(CORS_ORIGINS=f'"{VERCEL_ORIGIN}/"')
    assert cfg5.CORS_ORIGINS == [VERCEL_ORIGIN]

    # JSON-like bracket format with single quotes
    cfg6 = Settings(CORS_ORIGINS=f"['{VERCEL_ORIGIN}']")
    assert cfg6.CORS_ORIGINS == [VERCEL_ORIGIN]

    # JSON bracket format with double quotes
    cfg7 = Settings(CORS_ORIGINS=f'["{VERCEL_ORIGIN}"]')
    assert cfg7.CORS_ORIGINS == [VERCEL_ORIGIN]

    # Mixed case scheme/hostname
    cfg8 = Settings(CORS_ORIGINS="HTTPS://NutriLens-AI-Silk.Vercel.App")
    assert cfg8.CORS_ORIGINS == [VERCEL_ORIGIN]

    # Semicolon and comma separated list
    cfg9 = Settings(CORS_ORIGINS=f"{VERCEL_ORIGIN}; http://localhost:5173, http://127.0.0.1:5173")
    assert cfg9.CORS_ORIGINS == [VERCEL_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"]


def test_production_mode_rejects_wildcard_cors_with_credentials():
    """
    Verify that hardened environments (production/staging) reject wildcard origins ('*')
    because using '*' with allow_credentials=True is an invalid and insecure CORS configuration.
    """
    with pytest.raises(ValueError, match="CORS_ORIGINS cannot contain wildcard '\\*'"):
        Settings(
            ENVIRONMENT="production",
            JWT_SECRET_KEY="a" * 32,
            DATABASE_URL="postgresql+psycopg2://user:pass@ep-test.neon.tech/db?sslmode=require",
            AI_PROVIDER="gemini",
            GEMINI_API_KEY="AIzaSyRealGenuineProductionKey12345",
            CORS_ORIGINS="*",
        )


def test_exception_handler_preserves_cors_headers_on_500(monkeypatch):
    """
    Verify that if an unhandled 500 error occurs in an endpoint,
    global_exception_handler attaches CORS headers for approved origins
    so that browser users receive the actual JSON error instead of a misleading CORS error.
    """
    test_settings = Settings(CORS_ORIGINS=VERCEL_ORIGIN)
    monkeypatch.setattr("app.main.settings.CORS_ORIGINS", test_settings.CORS_ORIGINS)
    test_app = FastAPI()
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=test_settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    test_app.add_exception_handler(Exception, global_exception_handler)

    @test_app.get("/error-endpoint")
    def error_route():
        raise RuntimeError("Simulated internal error")

    client = TestClient(test_app, raise_server_exceptions=False)

    # Approved origin gets 500 JSON with CORS headers
    res_approved = client.get("/error-endpoint", headers={"Origin": VERCEL_ORIGIN})
    assert res_approved.status_code == 500
    assert res_approved.headers.get("access-control-allow-origin") == VERCEL_ORIGIN
    assert res_approved.headers.get("access-control-allow-credentials") == "true"
    assert res_approved.json()["detail"] == "An unexpected internal server error occurred. Please try again later."

    # Unapproved origin gets 500 JSON without CORS headers
    res_unapproved = client.get("/error-endpoint", headers={"Origin": UNAPPROVED_ORIGIN})
    assert res_unapproved.status_code == 500
    assert "access-control-allow-origin" not in res_unapproved.headers
