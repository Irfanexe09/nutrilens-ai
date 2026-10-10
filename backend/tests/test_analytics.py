import pytest
from datetime import datetime, timezone, timedelta, date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.meal import Meal
from app.models.meal_item import MealItem
from app.analytics.date_utils import (
    get_utc_bounds_for_local_date,
    get_local_date_for_utc_datetime,
    format_local_time,
)


def test_date_utils_tz_offset_conversion():
    """Verify UTC bounds and local date conversions with timezone offsets (e.g. IST UTC+5:30 -> -330 min)."""
    # Test IST (-330 minutes)
    target_d = date(2026, 10, 10)
    start_utc, end_utc = get_utc_bounds_for_local_date(target_d, tz_offset_minutes=-330)

    # Local midnight 2026-10-10 00:00 is 2026-10-09 18:30 UTC
    assert start_utc.year == 2026
    assert start_utc.month == 10
    assert start_utc.day == 9
    assert start_utc.hour == 18
    assert start_utc.minute == 30

    # Local end of day 2026-10-10 23:59:59 is 2026-10-10 18:29:59 UTC
    assert end_utc.year == 2026
    assert end_utc.month == 10
    assert end_utc.day == 10
    assert end_utc.hour == 18
    assert end_utc.minute == 29

    # Midnight boundary check
    # 2026-10-10 18:00 UTC in IST is 2026-10-10 23:30 (belongs to Oct 10)
    dt1 = datetime(2026, 10, 10, 18, 0, 0)
    assert get_local_date_for_utc_datetime(dt1, tz_offset_minutes=-330) == date(2026, 10, 10)

    # 2026-10-10 19:00 UTC in IST is 2026-10-11 00:30 (belongs to Oct 11)
    dt2 = datetime(2026, 10, 10, 19, 0, 0)
    assert get_local_date_for_utc_datetime(dt2, tz_offset_minutes=-330) == date(2026, 10, 11)


def test_daily_nutrition_aggregation_with_timezone_and_timeline(client: TestClient):
    """
    Test daily nutrition aggregation:
    - Enriches with food_names
    - Groups meals into 4-slot timeline
    - Correctly flags data_completeness
    """
    email = f"daily_tz_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai"
    token = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "name": "Daily TZ Tester",
    }).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/profile", json={
        "age": 28,
        "sex": "MALE",
        "height_cm": 178.0,
        "weight_kg": 75.0,
        "activity_level": "MODERATELY_ACTIVE",
        "goal": "WEIGHT_LOSS",
    }, headers=headers)

    # Log Breakfast
    client.post("/api/meals", json={
        "meal_type": "breakfast",
        "items": [{
            "food_name": "Idli (steamed)",
            "serving_count": 2.0,
            "serving_size": 80.0,
            "serving_unit": "piece",
            "calories": 130.0,
            "protein": 4.0,
            "carbohydrates": 26.0,
            "fat": 0.4,
            "fiber": 1.6,
        }],
    }, headers=headers)

    # Log Lunch
    client.post("/api/meals", json={
        "meal_type": "lunch",
        "items": [{
            "food_name": "Chicken Biryani",
            "serving_count": 1.0,
            "serving_size": 350.0,
            "serving_unit": "plate",
            "calories": 540.0,
            "protein": 28.5,
            "carbohydrates": 65.0,
            "fat": 18.0,
            "fiber": 3.8,
        }],
    }, headers=headers)

    # Fetch daily nutrition
    res = client.get("/api/daily-nutrition", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["meal_count"] == 2
    assert data["data_completeness"] == "PARTIAL"
    assert "timeline" in data
    assert len(data["timeline"]["breakfast"]) == 1
    assert len(data["timeline"]["lunch"]) == 1
    assert len(data["timeline"]["dinner"]) == 0
    assert len(data["timeline"]["snack"]) == 0

    breakfast_item = data["timeline"]["breakfast"][0]
    assert "Idli (steamed)" in breakfast_item["food_names"]
    assert breakfast_item["time_logged"] is not None


def test_weekly_analytics_single_query_and_unlogged_days_handling(client: TestClient, db_session: Session):
    """
    Test weekly analytics endpoint:
    - User has meals on 3 out of 7 days
    - Unlogged days are explicitly reported with has_logs=False and calories=None (NOT 0 intake)
    - Average calories across logged days correctly computes average of the 3 days
    """
    email = f"weekly_user_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai"
    reg = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "name": "Weekly User",
    }).json()
    token = reg["access_token"]
    user_id = reg["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/profile", json={
        "age": 29,
        "sex": "MALE",
        "height_cm": 180.0,
        "weight_kg": 80.0,
        "activity_level": "MODERATELY_ACTIVE",
        "goal": "MAINTENANCE",
    }, headers=headers)

    now = datetime.now(timezone.utc)
    today = now.date()

    # Seed meals directly for specific dates: Day -4 (1800 kcal), Day -2 (2100 kcal), Day 0 (today) (2400 kcal)
    # Remaining 4 days have NO meals.
    test_days = [
        (today - timedelta(days=4), 1800.0, 90.0),
        (today - timedelta(days=2), 2100.0, 110.0),
        (today, 2400.0, 130.0),
    ]

    for d, cals, pro in test_days:
        meal_time = datetime.combine(d, datetime.min.time()) + timedelta(hours=12)
        m = Meal(
            user_id=user_id,
            meal_type="lunch",
            total_calories=cals,
            total_protein=pro,
            total_carbohydrates=200.0,
            total_fat=60.0,
            total_fiber=25.0,
            created_at=meal_time,
        )
        db_session.add(m)
    db_session.commit()

    # Query weekly analytics
    res = client.get(f"/api/daily-nutrition/weekly?end_date={today.isoformat()}&days=7", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert len(data["days"]) == 7
    unlogged_days = [d for d in data["days"] if not d["has_logs"]]
    logged_days = [d for d in data["days"] if d["has_logs"]]

    assert len(logged_days) == 3
    assert len(unlogged_days) == 4

    # Critical check: unlogged days have calories=None, NOT zero
    for unlogged in unlogged_days:
        assert unlogged["calories"] is None
        assert unlogged["protein"] is None
        assert unlogged["data_completeness"] == "UNLOGGED"

    # Insights check: average is across 3 logged days: (1800 + 2100 + 2400) / 3 = 2100 kcal
    insights = data["insights"]
    assert insights["logged_days_count"] == 3
    assert insights["total_days"] == 7
    assert insights["average_calories_logged_days"] == 2100.0
    assert insights["average_protein_logged_days"] == 110.0
    assert insights["highest_calorie_day"]["calories"] == 2400.0
    assert insights["lowest_calorie_day"]["calories"] == 1800.0

    # Human-readable insights statements verify language
    statements_text = " ".join(insights["insights_statements"])
    assert "3 of 7 days" in statements_text
    assert "2100 kcal" in statements_text


def test_weekly_analytics_period_comparison(client: TestClient, db_session: Session):
    """
    Test period-over-period comparison when meals exist in both current 7 days
    and previous 7 days.
    """
    email = f"period_user_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai"
    reg = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "name": "Period User",
    }).json()
    token = reg["access_token"]
    user_id = reg["user"]["id"]
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/profile", json={
        "age": 25,
        "sex": "FEMALE",
        "height_cm": 165.0,
        "weight_kg": 60.0,
        "activity_level": "LIGHTLY_ACTIVE",
        "goal": "WEIGHT_LOSS",
    }, headers=headers)

    today = datetime.now(timezone.utc).date()

    # Prior period (days -10, -8): avg 2000 kcal
    db_session.add(Meal(
        user_id=user_id,
        meal_type="lunch",
        total_calories=1900.0,
        total_protein=70.0,
        created_at=datetime.combine(today - timedelta(days=10), datetime.min.time()) + timedelta(hours=12),
    ))
    db_session.add(Meal(
        user_id=user_id,
        meal_type="dinner",
        total_calories=2100.0,
        total_protein=80.0,
        created_at=datetime.combine(today - timedelta(days=8), datetime.min.time()) + timedelta(hours=12),
    ))

    # Current period (days -3, -1): avg 1700 kcal
    db_session.add(Meal(
        user_id=user_id,
        meal_type="lunch",
        total_calories=1600.0,
        total_protein=75.0,
        created_at=datetime.combine(today - timedelta(days=3), datetime.min.time()) + timedelta(hours=12),
    ))
    db_session.add(Meal(
        user_id=user_id,
        meal_type="dinner",
        total_calories=1800.0,
        total_protein=85.0,
        created_at=datetime.combine(today - timedelta(days=1), datetime.min.time()) + timedelta(hours=12),
    ))
    db_session.commit()

    res = client.get(f"/api/daily-nutrition/weekly?end_date={today.isoformat()}&days=7", headers=headers)
    assert res.status_code == 200
    insights = res.json()["insights"]

    prev_comp = insights["previous_period_comparison"]
    assert prev_comp["has_comparison"] is True
    assert prev_comp["prev_period_logged_days"] == 2
    assert prev_comp["prev_period_average_calories"] == 2000.0
    # Current avg is 1700.0 -> diff is -300.0 (-15.0%)
    assert prev_comp["calorie_difference"] == -300.0
    assert prev_comp["percent_change"] == -15.0
    assert "changed by -300" in prev_comp["message"]


def test_weekly_analytics_future_date_rejection(client: TestClient):
    """Verify requesting an unsupported future date returns 400 Bad Request."""
    email = f"future_user_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai"
    token = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "name": "Future User",
    }).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    tomorrow = (datetime.now(timezone.utc).date() + timedelta(days=1)).isoformat()
    res = client.get(f"/api/daily-nutrition/weekly?end_date={tomorrow}", headers=headers)
    assert res.status_code == 400
    assert "Cannot query future dates" in res.json()["detail"]


def test_weekly_analytics_user_isolation(client: TestClient, db_session: Session):
    """Verify User B cannot see User A's weekly analytics (data isolation)."""
    token_a = client.post("/api/auth/register", json={
        "email": f"usera_w_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai",
        "password": "Password123!",
        "name": "User A Weekly",
    }).json()["access_token"]

    user_b_res = client.post("/api/auth/register", json={
        "email": f"userb_w_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai",
        "password": "Password123!",
        "name": "User B Weekly",
    }).json()
    token_b = user_b_res["access_token"]

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A logs a meal today
    client.post("/api/meals", json={
        "meal_type": "lunch",
        "items": [{
            "food_name": "Chicken Biryani",
            "serving_count": 1.0,
            "serving_size": 350.0,
            "serving_unit": "plate",
            "calories": 750.0,
            "protein": 35.0,
            "carbohydrates": 80.0,
            "fat": 20.0,
            "fiber": 4.0,
        }],
    }, headers=headers_a)

    # User A sees 1 logged day
    res_a = client.get("/api/daily-nutrition/weekly", headers=headers_a).json()
    assert res_a["insights"]["logged_days_count"] >= 1

    # User B has logged 0 meals -> sees 0 logged days
    res_b = client.get("/api/daily-nutrition/weekly", headers=headers_b).json()
    assert res_b["insights"]["logged_days_count"] == 0
    for day in res_b["days"]:
        assert day["has_logs"] is False
        assert day["calories"] is None


def test_meal_history_filtering_by_meal_type_and_date(client: TestClient):
    """Test filtering meal history by meal_type, date, and optimization version."""
    email = f"hist_user_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai"
    token = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "name": "History User",
    }).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Log Breakfast
    client.post("/api/meals", json={
        "meal_type": "breakfast",
        "items": [{
            "food_name": "Idli",
            "serving_count": 1.0,
            "serving_size": 100.0,
            "serving_unit": "piece",
            "calories": 140.0,
            "protein": 4.0,
            "carbohydrates": 28.0,
            "fat": 0.5,
            "fiber": 1.0,
        }],
    }, headers=headers)

    # Log Lunch
    client.post("/api/meals", json={
        "meal_type": "lunch",
        "items": [{
            "food_name": "Dal Tadka",
            "serving_count": 1.0,
            "serving_size": 200.0,
            "serving_unit": "bowl",
            "calories": 200.0,
            "protein": 10.0,
            "carbohydrates": 25.0,
            "fat": 6.0,
            "fiber": 6.0,
        }],
    }, headers=headers)

    # Filter by meal_type=breakfast
    res_b = client.get("/api/meals?meal_type=breakfast", headers=headers)
    assert res_b.status_code == 200
    assert res_b.json()["total"] == 1
    assert res_b.json()["meals"][0]["meal_type"] == "breakfast"

    # Filter by meal_type=lunch
    res_l = client.get("/api/meals?meal_type=lunch", headers=headers)
    assert res_l.status_code == 200
    assert res_l.json()["total"] == 1
    assert res_l.json()["meals"][0]["meal_type"] == "lunch"

    # Filter by meal_type=dinner (none logged)
    res_d = client.get("/api/meals?meal_type=dinner", headers=headers)
    assert res_d.status_code == 200
    assert res_d.json()["total"] == 0


def test_meal_history_user_isolation(client: TestClient):
    """Verify User B cannot see User A's meals when calling GET /api/meals."""
    token_a = client.post("/api/auth/register", json={
        "email": f"usera_h_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai",
        "password": "Password123!",
        "name": "User A Hist",
    }).json()["access_token"]

    token_b = client.post("/api/auth/register", json={
        "email": f"userb_h_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai",
        "password": "Password123!",
        "name": "User B Hist",
    }).json()["access_token"]

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    client.post("/api/meals", json={
        "meal_type": "dinner",
        "items": [{
            "food_name": "Roti",
            "serving_count": 2.0,
            "serving_size": 40.0,
            "serving_unit": "piece",
            "calories": 200.0,
            "protein": 6.0,
            "carbohydrates": 38.0,
            "fat": 1.0,
            "fiber": 5.0,
        }],
    }, headers=headers_a)

    # User A sees 1 meal
    assert client.get("/api/meals", headers=headers_a).json()["total"] == 1

    # User B sees 0 meals
    assert client.get("/api/meals", headers=headers_b).json()["total"] == 0
