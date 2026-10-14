import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, UserProfile, DailyNutritionTarget
from app.models.weight_entry import WeightEntry
from app.core.security import create_access_token


@pytest.fixture
def test_user_with_profile(db_session: Session):
    user = User(
        email="weightuser@example.com",
        hashed_password="hashed_pw_test",
        name="Weight User",
    )
    db_session.add(user)
    db_session.flush()

    profile = UserProfile(
        user_id=user.id,
        name="Weight User",
        age=30,
        sex="MALE",
        height_cm=180.0,
        weight_kg=80.0,
        activity_level="MODERATELY_ACTIVE",
        goal="MAINTENANCE",
    )
    db_session.add(profile)

    target = DailyNutritionTarget(
        user_id=user.id,
        bmr=1780.0,
        tdee=2759.0,
        calorie_target=2759.0,
        protein_target_g=160.0,
        carbohydrates_target_g=345.0,
        fat_target_g=77.0,
        fiber_target_g=38.0,
        is_active=True,
    )
    db_session.add(target)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def other_user(db_session: Session):
    user = User(
        email="otherweightuser@example.com",
        hashed_password="hashed_pw_test",
        name="Other User",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_weight_unauthenticated_rejected(client: TestClient):
    res = client.get("/api/weight")
    assert res.status_code == 401

    res = client.post("/api/weight", json={"weight_kg": 75.5, "date": "2026-10-10"})
    assert res.status_code == 401


def test_weight_record_and_list_with_trend(client: TestClient, test_user_with_profile: User, db_session: Session):
    token = create_access_token(subject=test_user_with_profile.id, token_version=test_user_with_profile.token_version)
    headers = {"Authorization": f"Bearer {token}"}

    today = date.today()
    yesterday = today - timedelta(days=1)

    # 1. Record first entry
    res1 = client.post(
        "/api/weight",
        json={"weight_kg": 82.0, "date": yesterday.isoformat(), "notes": "Felt bloated"},
        headers=headers,
    )
    assert res1.status_code == 201
    data1 = res1.json()
    assert data1["weight_kg"] == 82.0
    assert data1["date"] == yesterday.isoformat()
    assert data1["notes"] == "Felt bloated"

    # 2. Record second entry (today, lower weight)
    res2 = client.post(
        "/api/weight",
        json={"weight_kg": 80.5, "date": today.isoformat(), "notes": "Morning measurement"},
        headers=headers,
    )
    assert res2.status_code == 201

    # 3. List entries
    list_res = client.get("/api/weight", headers=headers)
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] == 2
    assert len(list_data["entries"]) == 2
    assert list_data["latest"]["weight_kg"] == 80.5
    assert list_data["change_kg"] == -1.5
    assert list_data["trend"] == "DECREASING"

    # 4. Verify profile was synced with latest weight
    prof = db_session.query(UserProfile).filter(UserProfile.user_id == test_user_with_profile.id).first()
    assert prof.weight_kg == 80.5


def test_weight_user_isolation(
    client: TestClient, test_user_with_profile: User, other_user: User, db_session: Session
):
    token1 = create_access_token(subject=test_user_with_profile.id, token_version=test_user_with_profile.token_version)
    token2 = create_access_token(subject=other_user.id, token_version=other_user.token_version)

    # User 1 creates entry
    res = client.post(
        "/api/weight",
        json={"weight_kg": 75.0, "date": "2026-10-12"},
        headers={"Authorization": f"Bearer {token1}"},
    )
    assert res.status_code == 201
    entry_id = res.json()["id"]

    # User 2 lists - should see 0 entries
    res2 = client.get("/api/weight", headers={"Authorization": f"Bearer {token2}"})
    assert res2.status_code == 200
    assert res2.json()["total"] == 0

    # User 2 tries to get User 1's entry - 404
    res_get = client.get(f"/api/weight/{entry_id}", headers={"Authorization": f"Bearer {token2}"})
    assert res_get.status_code == 404

    # User 2 tries to update User 1's entry - 404
    res_put = client.put(
        f"/api/weight/{entry_id}",
        json={"weight_kg": 60.0},
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert res_put.status_code == 404

    # User 2 tries to delete User 1's entry - 404
    res_del = client.delete(
        f"/api/weight/{entry_id}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert res_del.status_code == 404


def test_weight_update_and_delete(client: TestClient, test_user_with_profile: User, db_session: Session):
    token = create_access_token(subject=test_user_with_profile.id, token_version=test_user_with_profile.token_version)
    headers = {"Authorization": f"Bearer {token}"}

    # Create entry
    res = client.post(
        "/api/weight",
        json={"weight_kg": 78.0, "date": "2026-10-10", "notes": "Initial"},
        headers=headers,
    )
    entry_id = res.json()["id"]

    # Update entry
    res_up = client.put(
        f"/api/weight/{entry_id}",
        json={"weight_kg": 77.5, "notes": "Corrected"},
        headers=headers,
    )
    assert res_up.status_code == 200
    assert res_up.json()["weight_kg"] == 77.5
    assert res_up.json()["notes"] == "Corrected"

    # Delete entry
    res_del = client.delete(f"/api/weight/{entry_id}", headers=headers)
    assert res_del.status_code == 204

    # Verify deleted
    res_check = client.get(f"/api/weight/{entry_id}", headers=headers)
    assert res_check.status_code == 404
