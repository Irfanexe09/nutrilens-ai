import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.main import app


def test_health_probe_reports_detailed_telemetry(client: TestClient):
    """Verify health probe returns detailed latency, environment, and storage telemetry."""
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert "database_latency_ms" in data
    assert data["database_latency_ms"] is not None
    assert data["database_latency_ms"] >= 0
    assert data["storage"] == "ready"
    assert "environment" in data
    assert data["app"] == "NutriLens"


def test_health_probe_returns_503_when_database_unreachable():
    """Verify health probe returns 503 Service Unavailable when DB is down."""
    mock_db = MagicMock()
    mock_db.execute.side_effect = OperationalError("connection refused", {}, None)

    def override_get_db():
        yield mock_db

    from app.database.session import get_db
    app.dependency_overrides[get_db] = override_get_db

    try:
        client = TestClient(app, raise_server_exceptions=False)
        res = client.get("/api/health")
        assert res.status_code == 503
        data = res.json()
        assert data["status"] == "degraded"
        assert data["database"] == "unreachable"
    finally:
        app.dependency_overrides.clear()


def test_health_probe_returns_503_when_storage_not_writable(client: TestClient):
    """Verify health probe returns 503 Service Unavailable when upload dir is read-only."""
    with patch("os.access", return_value=False):
        res = client.get("/api/health")
        assert res.status_code == 503
        data = res.json()
        assert data["status"] == "degraded"
        assert data["storage"] == "read_only"
