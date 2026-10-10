import io
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.meal import Meal
from app.core.security import hash_password, create_access_token
from app.core.rate_limit import InMemorySlidingWindowRateLimiter, analysis_rate_limiter
from app.services.analysis_service import AnalysisService


# --- Fixtures for User Authentication ---

@pytest.fixture
def alice_user(db_session: Session) -> User:
    user = User(
        email="alice.audit@example.com",
        name="Alice Audit",
        hashed_password=hash_password("AuditPassword123!"),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def bob_user(db_session: Session) -> User:
    user = User(
        email="bob.audit@example.com",
        name="Bob Audit",
        hashed_password=hash_password("AuditPassword456!"),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def alice_token(alice_user: User) -> str:
    return create_access_token(subject=alice_user.id)


@pytest.fixture
def bob_token(bob_user: User) -> str:
    return create_access_token(subject=bob_user.id)


# --- 1. Authorization & IDOR Protection Tests ---

def test_unauthenticated_cannot_access_private_meal(
    client: TestClient, alice_user: User, alice_token: str
):
    # Alice creates a private meal
    create_payload = {
        "meal_type": "lunch",
        "notes": "Alice private lunch",
        "items": [
            {
                "food_name": "Chicken Biryani",
                "serving_count": 1.0,
                "serving_size": 250.0,
                "serving_unit": "g",
                "calories": 385.0,
                "protein": 20.0,
                "carbohydrates": 46.0,
                "fat": 12.0,
                "fiber": 2.5,
                "uncertainty_pct": 10.0,
            }
        ],
    }
    create_res = client.post(
        "/api/meals",
        json=create_payload,
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert create_res.status_code == 201
    meal_id = create_res.json()["id"]

    # 1. Unauthenticated request without token must receive 401 Unauthorized
    unauth_res = client.get(f"/api/meals/{meal_id}")
    assert unauth_res.status_code == 401
    assert "authentication required" in unauth_res.json()["detail"].lower()

    # 2. Alice requests her own meal -> 200 OK
    alice_res = client.get(
        f"/api/meals/{meal_id}",
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert alice_res.status_code == 200
    assert alice_res.json()["id"] == meal_id


def test_cross_user_meal_access_forbidden(
    client: TestClient, alice_user: User, alice_token: str, bob_token: str
):
    # Alice creates a private meal
    create_payload = {
        "meal_type": "dinner",
        "notes": "Alice secret dinner",
        "items": [
            {
                "food_name": "Paneer Tikka",
                "serving_count": 1.0,
                "serving_size": 150.0,
                "serving_unit": "g",
                "calories": 280.0,
                "protein": 18.0,
                "carbohydrates": 8.0,
                "fat": 20.0,
                "fiber": 1.5,
                "uncertainty_pct": 10.0,
            }
        ],
    }
    create_res = client.post(
        "/api/meals",
        json=create_payload,
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert create_res.status_code == 201
    meal_id = create_res.json()["id"]

    # Bob attempts to access Alice's meal -> must receive 403 Forbidden
    bob_res = client.get(
        f"/api/meals/{meal_id}",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert bob_res.status_code == 403
    assert "permission" in bob_res.json()["detail"].lower()


def test_unauthenticated_cannot_spoof_user_id_on_meal_creation(
    client: TestClient, alice_user: User
):
    # Unauthenticated attacker attempts to attach Alice's user_id in the payload
    spoofed_payload = {
        "user_id": alice_user.id,
        "meal_type": "snack",
        "notes": "Spoofed snack injection",
        "items": [
            {
                "food_name": "Samosa",
                "serving_count": 1.0,
                "serving_size": 80.0,
                "serving_unit": "piece",
                "calories": 260.0,
                "protein": 4.0,
                "carbohydrates": 30.0,
                "fat": 14.0,
                "fiber": 2.0,
                "uncertainty_pct": 12.0,
            }
        ],
    }
    res = client.post("/api/meals", json=spoofed_payload)
    assert res.status_code == 201
    created_meal = res.json()
    # Ensure backend cleared or ignored the spoofed user_id
    assert created_meal["user_id"] is None


def test_unauthenticated_meal_listing_does_not_leak_private_meals(
    client: TestClient, alice_user: User, alice_token: str
):
    # Alice creates a private meal
    client.post(
        "/api/meals",
        json={
            "meal_type": "breakfast",
            "notes": "Alice private breakfast",
            "items": [
                {
                    "food_name": "Idli with Sambar",
                    "serving_count": 2.0,
                    "serving_size": 100.0,
                    "serving_unit": "serving",
                    "calories": 160.0,
                    "protein": 5.0,
                    "carbohydrates": 32.0,
                    "fat": 1.0,
                    "fiber": 2.0,
                    "uncertainty_pct": 6.0,
                }
            ],
        },
        headers={"Authorization": f"Bearer {alice_token}"},
    )

    # Guest user queries GET /api/meals
    guest_res = client.get("/api/meals")
    assert guest_res.status_code == 200
    guest_meals = guest_res.json()["meals"]
    # No meals belonging to registered users should be returned to guest
    for m in guest_meals:
        assert m["user_id"] is None


def test_unauthenticated_cannot_optimize_or_modify_private_meal(
    client: TestClient, alice_user: User, alice_token: str, bob_token: str
):
    # Alice creates a private meal
    res = client.post(
        "/api/meals",
        json={
            "meal_type": "lunch",
            "items": [
                {
                    "food_name": "Dal Tadka",
                    "serving_count": 1.0,
                    "serving_size": 200.0,
                    "serving_unit": "bowl",
                    "calories": 180.0,
                    "protein": 9.2,
                    "carbohydrates": 24.0,
                    "fat": 5.5,
                    "fiber": 6.5,
                    "uncertainty_pct": 8.0,
                }
            ],
        },
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    meal_id = res.json()["id"]

    # 1. Unauthenticated optimization request -> 401
    unauth_opt = client.post(f"/api/meals/{meal_id}/optimize")
    assert unauth_opt.status_code == 401

    # 2. Bob attempts optimization of Alice's meal -> 403
    bob_opt = client.post(
        f"/api/meals/{meal_id}/optimize",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert bob_opt.status_code == 403

    # 3. Unauthenticated apply-optimization -> 401
    apply_payload = {
        "items": [
            {
                "food_id": 1,
                "food_name": "Dal Tadka",
                "portion_value": 200.0,
                "portion_unit": "g",
                "calories": 180.0,
                "protein": 9.2,
                "carbohydrates": 24.0,
                "fat": 5.5,
                "fiber": 6.5,
            }
        ]
    }
    unauth_apply = client.post(
        f"/api/meals/{meal_id}/apply-optimization", json=apply_payload
    )
    assert unauth_apply.status_code == 401

    # 4. Bob attempts apply-optimization -> 403
    bob_apply = client.post(
        f"/api/meals/{meal_id}/apply-optimization",
        json=apply_payload,
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert bob_apply.status_code == 403


# --- 2. Image Upload Security & Pillow Decompression Bomb Tests ---

def test_image_format_mismatch_rejected(client: TestClient):
    """
    Simulate polyglot or format confusion attack:
    File header claims image/jpeg, but actual payload is a BMP image.
    """
    buf = io.BytesIO()
    bmp_img = Image.new("RGB", (50, 50), color=(10, 20, 30))
    bmp_img.save(buf, format="BMP")
    bmp_bytes = buf.getvalue()

    files = {"image": ("disguised.jpg", bmp_bytes, "image/jpeg")}
    res = client.post("/api/analyze", files=files)
    assert res.status_code == 415
    assert "unsupported decoded image format" in res.json()["detail"].lower()


def test_huge_resolution_decompression_bomb_rejected(client: TestClient):
    """
    Image resolution exceeding allowable limits (e.g. >6000px) must be rejected
    before consuming server memory.
    """
    # Create an image that reports 7000x7000 dimensions
    buf = io.BytesIO()
    large_img = Image.new("RGB", (7000, 7000), color=(0, 0, 0))
    large_img.save(buf, format="JPEG")
    large_bytes = buf.getvalue()

    files = {"image": ("bomb.jpg", large_bytes, "image/jpeg")}
    res = client.post("/api/analyze", files=files)
    assert res.status_code == 400
    assert "decompression bomb" in res.json()["detail"].lower() or "resolution" in res.json()["detail"].lower()


def test_upload_retention_cleanup_helper(tmp_path):
    """
    Verify cleanup_old_uploads removes files older than the retention threshold.
    """
    import os
    import time
    from unittest.mock import patch

    with patch("app.services.analysis_service.settings.UPLOAD_DIR", str(tmp_path)):
        stale_file = tmp_path / "old_meal.jpg"
        stale_file.write_bytes(b"old-image-bytes")
        fresh_file = tmp_path / "recent_meal.jpg"
        fresh_file.write_bytes(b"recent-image-bytes")

        # Set stale_file mtime to 2 days ago
        two_days_ago = time.time() - (2 * 86400)
        os.utime(str(stale_file), (two_days_ago, two_days_ago))

        cleaned = AnalysisService.cleanup_old_uploads(max_age_seconds=86400)
        assert cleaned == 1
        assert not stale_file.exists()
        assert fresh_file.exists()


# --- 3. Rate Limiting Tests ---

def test_sliding_window_rate_limiter_enforces_limit():
    limiter = InMemorySlidingWindowRateLimiter(max_requests=3, window_seconds=60)
    client_ip = "192.168.1.100"

    # 3 requests should pass
    limiter.check_rate_limit(client_ip)
    limiter.check_rate_limit(client_ip)
    limiter.check_rate_limit(client_ip)

    # 4th request must raise 429
    with pytest.raises(Exception) as excinfo:
        limiter.check_rate_limit(client_ip)

    assert excinfo.value.status_code == 429
    assert "rate limit exceeded" in excinfo.value.detail.lower()
    assert "Retry-After" in excinfo.value.headers


# --- 4. Error Message Sanitization ---

def test_global_exception_handler_sanitizes_stack_traces():
    """
    Verify unhandled server exceptions return sanitized generic messages
    without leaking internal traceback or implementation details.
    """
    from unittest.mock import patch
    from app.main import app

    test_client = TestClient(app, raise_server_exceptions=False)
    with patch("app.services.food_service.FoodService.search_foods", side_effect=RuntimeError("Secret database credentials path /var/secrets/db")):
        res = test_client.get("/api/foods")
        assert res.status_code == 500
        data = res.json()
        assert "unexpected internal server error" in data["detail"].lower()
        # Ensure raw exception message and path did NOT leak to the client
        assert "secret database credentials" not in str(data).lower()
        assert "/var/secrets" not in str(data)
