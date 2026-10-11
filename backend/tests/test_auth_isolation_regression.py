from datetime import timedelta
import pytest
import jwt
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.core.security import hash_password, create_access_token


@pytest.fixture
def user_alice(db_session: Session) -> User:
    user = User(
        email="alice.isolation@nutrilens.app",
        name="Alice Isolation",
        hashed_password=hash_password("AliceSecurePass123!"),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def user_bob(db_session: Session) -> User:
    user = User(
        email="bob.isolation@nutrilens.app",
        name="Bob Isolation",
        hashed_password=hash_password("BobSecurePass456!"),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def alice_auth_token(user_alice: User) -> str:
    return create_access_token(subject=user_alice.id)


@pytest.fixture
def bob_auth_token(user_bob: User) -> str:
    return create_access_token(subject=user_bob.id)


# --- 1. Token Integrity & Lifecycle Regressions ---

def test_expired_token_rejected_with_401(client: TestClient, user_alice: User):
    """Verify that an expired JWT access token is rejected with 401 Unauthorized."""
    expired_token = create_access_token(
        subject=user_alice.id,
        expires_delta=timedelta(seconds=-10),
    )
    res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert res.status_code == 401
    assert "token expired" in res.json()["detail"].lower() or "credentials" in res.json()["detail"].lower()


def test_tampered_signature_token_rejected_with_401(client: TestClient, user_alice: User):
    """Verify that a forged JWT token signed with an invalid secret is rejected."""
    tampered_token = jwt.encode(
        {"sub": str(user_alice.id), "exp": 9999999999},
        "attacker-unauthorized-fake-key-string",
        algorithm="HS256",
    )
    res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {tampered_token}"},
    )
    assert res.status_code == 401
    assert "could not validate credentials" in res.json()["detail"].lower()


def test_token_with_nonexistent_user_rejected_with_401(client: TestClient):
    """Verify that a token whose subject does not exist in the database is rejected."""
    ghost_token = create_access_token(subject="00000000-0000-0000-0000-000000000000")
    res = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {ghost_token}"},
    )
    assert res.status_code == 401
    assert "user not found" in res.json()["detail"].lower()


# --- 2. Profile & Nutrition Targets Isolation ---

def test_profile_strictly_isolated_between_users(
    client: TestClient,
    user_alice: User,
    user_bob: User,
    alice_auth_token: str,
    bob_auth_token: str,
):
    """
    Verify User A's profile and nutritional targets cannot be observed
    or overwritten by User B.
    """
    # 1. Alice creates her profile
    alice_profile_payload = {
        "name": "Alice Isolation",
        "age": 28,
        "sex": "FEMALE",
        "height_cm": 165.0,
        "weight_kg": 60.0,
        "activity_level": "MODERATELY_ACTIVE",
        "goal": "WEIGHT_LOSS",
    }
    alice_res = client.post(
        "/api/profile",
        json=alice_profile_payload,
        headers={"Authorization": f"Bearer {alice_auth_token}"},
    )
    assert alice_res.status_code == 200
    alice_data = alice_res.json()
    assert alice_data["profile"]["name"] == "Alice Isolation"
    assert alice_data["profile"]["goal"] == "WEIGHT_LOSS"

    # 2. Bob requests his profile before configuring one -> 404
    bob_res = client.get(
        "/api/profile",
        headers={"Authorization": f"Bearer {bob_auth_token}"},
    )
    assert bob_res.status_code == 404
    assert "not configured" in bob_res.json()["detail"].lower()

    # 3. Bob configures his own distinct profile
    bob_profile_payload = {
        "name": "Bob Isolation",
        "age": 35,
        "sex": "MALE",
        "height_cm": 180.0,
        "weight_kg": 85.0,
        "activity_level": "VERY_ACTIVE",
        "goal": "MUSCLE_GAIN",
    }
    bob_create = client.post(
        "/api/profile",
        json=bob_profile_payload,
        headers={"Authorization": f"Bearer {bob_auth_token}"},
    )
    assert bob_create.status_code == 200
    bob_data = bob_create.json()
    assert bob_data["profile"]["name"] == "Bob Isolation"
    assert bob_data["profile"]["goal"] == "MUSCLE_GAIN"

    # 4. Verify Alice's profile remains untouched
    alice_check = client.get(
        "/api/profile",
        headers={"Authorization": f"Bearer {alice_auth_token}"},
    )
    assert alice_check.status_code == 200
    assert alice_check.json()["profile"]["name"] == "Alice Isolation"
    assert alice_check.json()["profile"]["goal"] == "WEIGHT_LOSS"


# --- 3. Daily Nutrition Aggregation Isolation ---

def test_daily_nutrition_and_analytics_strictly_isolated(
    client: TestClient,
    alice_auth_token: str,
    bob_auth_token: str,
):
    """
    Verify daily consumed nutrition and weekly analytics aggregates
    include only the requester's own logged meals.
    """
    # Alice logs a high-protein lunch (385 kcal)
    client.post(
        "/api/meals",
        json={
            "meal_type": "lunch",
            "notes": "Alice lunch",
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
        },
        headers={"Authorization": f"Bearer {alice_auth_token}"},
    )

    # Bob logs a light snack (120 kcal)
    client.post(
        "/api/meals",
        json={
            "meal_type": "snack",
            "notes": "Bob snack",
            "items": [
                {
                    "food_name": "Apple",
                    "serving_count": 1.0,
                    "serving_size": 150.0,
                    "serving_unit": "piece",
                    "calories": 120.0,
                    "protein": 0.5,
                    "carbohydrates": 28.0,
                    "fat": 0.3,
                    "fiber": 3.0,
                    "uncertainty_pct": 5.0,
                }
            ],
        },
        headers={"Authorization": f"Bearer {bob_auth_token}"},
    )

    # Alice queries /api/daily-nutrition
    alice_daily = client.get(
        "/api/daily-nutrition",
        headers={"Authorization": f"Bearer {alice_auth_token}"},
    )
    assert alice_daily.status_code == 200
    alice_cals = alice_daily.json()["consumed"]["calories"]
    assert round(alice_cals) == 385

    # Bob queries /api/daily-nutrition
    bob_daily = client.get(
        "/api/daily-nutrition",
        headers={"Authorization": f"Bearer {bob_auth_token}"},
    )
    assert bob_daily.status_code == 200
    bob_cals = bob_daily.json()["consumed"]["calories"]
    assert round(bob_cals) == 120


# --- 4. Cross-User Meal Listing Partitioning ---

def test_meal_history_listing_is_strictly_partitioned(
    client: TestClient,
    alice_auth_token: str,
    bob_auth_token: str,
):
    """
    Verify GET /api/meals returns only the authenticated user's records
    and zero meals belonging to other users.
    """
    # Alice creates a meal
    client.post(
        "/api/meals",
        json={
            "meal_type": "breakfast",
            "notes": "Alice breakfast for listing test",
            "items": [
                {
                    "food_name": "Oatmeal",
                    "serving_count": 1.0,
                    "serving_size": 100.0,
                    "serving_unit": "g",
                    "calories": 150.0,
                    "protein": 5.0,
                    "carbohydrates": 27.0,
                    "fat": 2.5,
                    "fiber": 4.0,
                    "uncertainty_pct": 5.0,
                }
            ],
        },
        headers={"Authorization": f"Bearer {alice_auth_token}"},
    )

    # Bob lists meals
    bob_list = client.get(
        "/api/meals",
        headers={"Authorization": f"Bearer {bob_auth_token}"},
    )
    assert bob_list.status_code == 200
    for meal in bob_list.json()["meals"]:
        assert meal["notes"] != "Alice breakfast for listing test"
