import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.personalization.enums import SexEnum, ActivityLevelEnum, GoalEnum
from app.personalization.bmr_service import BMRCalculator
from app.personalization.tdee_service import TDEECalculator
from app.personalization.target_service import TargetCalculator
from app.personalization.meal_evaluation_service import MealEvaluationService
from app.core.security import hash_password, verify_password


# ==========================================
# Unit Tests: Deterministic Calculations
# ==========================================

def test_bmr_male_calculation():
    """
    Test BMR for male: 70kg, 175cm, 20yo
    10*70 + 6.25*175 - 5*20 + 5 = 700 + 1093.75 - 100 + 5 = 1698.75 -> 1698.8 kcal
    """
    bmr = BMRCalculator.calculate(weight_kg=70.0, height_cm=175.0, age=20, sex=SexEnum.MALE)
    assert bmr == 1698.8


def test_bmr_female_calculation():
    """
    Test BMR for female: 60kg, 165cm, 25yo
    10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25 -> 1345.2 kcal
    """
    bmr = BMRCalculator.calculate(weight_kg=60.0, height_cm=165.0, age=25, sex=SexEnum.FEMALE)
    assert bmr == 1345.2


def test_bmr_invalid_inputs():
    """Test validation errors for invalid BMR inputs."""
    with pytest.raises(ValueError, match="Weight"):
        BMRCalculator.calculate(weight_kg=-5.0, height_cm=170.0, age=25, sex=SexEnum.MALE)
    with pytest.raises(ValueError, match="Height"):
        BMRCalculator.calculate(weight_kg=70.0, height_cm=0.0, age=25, sex=SexEnum.MALE)
    with pytest.raises(ValueError, match="Age"):
        BMRCalculator.calculate(weight_kg=70.0, height_cm=170.0, age=-1, sex=SexEnum.MALE)
    with pytest.raises(ValueError, match="Unsupported sex"):
        BMRCalculator.calculate(weight_kg=70.0, height_cm=170.0, age=25, sex="OTHER")


def test_tdee_all_activity_multipliers():
    """Test all documented activity level multipliers."""
    bmr = 1500.0
    assert TDEECalculator.calculate(bmr, ActivityLevelEnum.SEDENTARY) == 1800.0       # 1500 * 1.2
    assert TDEECalculator.calculate(bmr, ActivityLevelEnum.LIGHTLY_ACTIVE) == 2062.5  # 1500 * 1.375
    assert TDEECalculator.calculate(bmr, ActivityLevelEnum.MODERATELY_ACTIVE) == 2325.0 # 1500 * 1.55
    assert TDEECalculator.calculate(bmr, ActivityLevelEnum.VERY_ACTIVE) == 2587.5     # 1500 * 1.725
    assert TDEECalculator.calculate(bmr, ActivityLevelEnum.EXTRA_ACTIVE) == 2850.0    # 1500 * 1.9


def test_target_calculator_all_goals():
    """Test goal-based calorie adjustments and protein targets."""
    # Standard profile: 70kg male, 175cm, 25yo, Sedentary
    # BMR: 700 + 1093.75 - 125 + 5 = 1673.75 -> 1673.8
    # TDEE (Sedentary 1.2): 1673.8 * 1.2 = 2008.56 -> 2008.6
    
    # 1. Weight Loss: TDEE - 400, Protein 1.4 g/kg
    res_wl = TargetCalculator.calculate(70.0, 175.0, 25, SexEnum.MALE, ActivityLevelEnum.SEDENTARY, GoalEnum.WEIGHT_LOSS)
    assert res_wl.calorie_target == round(2008.6 - 400.0, 1)  # 1608.6
    assert res_wl.protein_target_g == round(70.0 * 1.4, 1)    # 98.0 g

    # 2. Maintenance: TDEE, Protein 1.2 g/kg
    res_maint = TargetCalculator.calculate(70.0, 175.0, 25, SexEnum.MALE, ActivityLevelEnum.SEDENTARY, GoalEnum.MAINTENANCE)
    assert res_maint.calorie_target == 2008.6
    assert res_maint.protein_target_g == round(70.0 * 1.2, 1) # 84.0 g

    # 3. Weight Gain: TDEE + 350, Protein 1.4 g/kg
    res_wg = TargetCalculator.calculate(70.0, 175.0, 25, SexEnum.MALE, ActivityLevelEnum.SEDENTARY, GoalEnum.WEIGHT_GAIN)
    assert res_wg.calorie_target == round(2008.6 + 350.0, 1)  # 2358.6
    assert res_wg.protein_target_g == round(70.0 * 1.4, 1)    # 98.0 g

    # 4. Muscle Gain: TDEE + 250, Protein 1.8 g/kg
    res_mg = TargetCalculator.calculate(70.0, 175.0, 25, SexEnum.MALE, ActivityLevelEnum.SEDENTARY, GoalEnum.MUSCLE_GAIN)
    assert res_mg.calorie_target == round(2008.6 + 250.0, 1)  # 2258.6
    assert res_mg.protein_target_g == round(70.0 * 1.8, 1)    # 126.0 g

    # 5. General Health: TDEE, Protein 1.1 g/kg
    res_gh = TargetCalculator.calculate(70.0, 175.0, 25, SexEnum.MALE, ActivityLevelEnum.SEDENTARY, GoalEnum.GENERAL_HEALTH)
    assert res_gh.calorie_target == 2008.6
    assert res_gh.protein_target_g == round(70.0 * 1.1, 1)    # 77.0 g


def test_target_internal_caloric_consistency():
    """
    Verify internal caloric consistency:
    (protein_g * 4) + (carbs_g * 4) + (fat_g * 9) should equal calorie_target within 2 kcal (rounding).
    """
    res = TargetCalculator.calculate(
        weight_kg=75.0,
        height_cm=180.0,
        age=28,
        sex=SexEnum.MALE,
        activity_level=ActivityLevelEnum.MODERATELY_ACTIVE,
        goal=GoalEnum.MUSCLE_GAIN,
    )
    derived_calories = (res.protein_target_g * 4.0) + (res.carbohydrates_target_g * 4.0) + (res.fat_target_g * 9.0)
    assert abs(derived_calories - res.calorie_target) <= 2.0


def test_fiber_target_scaling_and_floor():
    """Verify fiber target is 14g per 1000 kcal with a strict 25g floor."""
    # Low calorie case: target 1500 kcal -> 1.5 * 14 = 21g, but floor is 25g
    res_low = TargetCalculator.calculate(50.0, 150.0, 40, SexEnum.FEMALE, ActivityLevelEnum.SEDENTARY, GoalEnum.MAINTENANCE)
    assert res_low.fiber_target_g >= 25.0

    # High calorie case: target 3000 kcal -> 3.0 * 14 = 42.0g
    res_high = TargetCalculator.calculate(90.0, 190.0, 22, SexEnum.MALE, ActivityLevelEnum.EXTRA_ACTIVE, GoalEnum.WEIGHT_GAIN)
    expected_fiber = round((res_high.calorie_target / 1000.0) * 14.0, 1)
    assert res_high.fiber_target_g == expected_fiber


def test_safety_warning_triggered_for_low_intake():
    """Test safety warning is triggered when calorie target < 1500 (male) or < 1200 (female)."""
    # Extremely small male in aggressive deficit
    res_male_low = TargetCalculator.calculate(
        weight_kg=40.0,
        height_cm=140.0,
        age=65,
        sex=SexEnum.MALE,
        activity_level=ActivityLevelEnum.SEDENTARY,
        goal=GoalEnum.WEIGHT_LOSS,
    )
    assert res_male_low.calorie_target < 1500.0
    assert res_male_low.safety_warning is not None
    assert "unusually low" in res_male_low.safety_warning
    assert "1,500 kcal" in res_male_low.safety_warning

    # Normal male should not trigger warning
    res_male_normal = TargetCalculator.calculate(
        weight_kg=75.0,
        height_cm=178.0,
        age=25,
        sex=SexEnum.MALE,
        activity_level=ActivityLevelEnum.MODERATELY_ACTIVE,
        goal=GoalEnum.MAINTENANCE,
    )
    assert res_male_normal.safety_warning is None


def test_password_hashing_and_verification():
    """Test PBKDF2-HMAC-SHA256 password hashing and secure verification."""
    pwd = "superSecretPassword123!"
    hashed = hash_password(pwd)
    assert ":" in hashed
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrongPassword", hashed) is False


def test_meal_evaluation_insights():
    """Test deterministic meal evaluation service output."""
    res = MealEvaluationService.evaluate(
        meal_calories=500.0,
        meal_protein=35.0,
        meal_carbs=55.0,
        meal_fat=14.0,
        meal_fiber=7.0,
        remaining_calories=1000.0,
        target_calories=2200.0,
        daily_consumed_calories=1200.0,
    )
    assert res["fits_remaining_budget"] is True
    assert res["remaining_calories_after_meal"] == 500.0
    assert any("comfortably" in i for i in res["insights"])
    assert any("High protein density" in i or "protein" in i for i in res["insights"])
    assert any("Rich in dietary fiber" in i for i in res["insights"])


# ==========================================
# Integration Tests: Auth, Profile & Isolation
# ==========================================

def test_auth_registration_and_login(client: TestClient):
    """Test registering a new account and logging in."""
    email = f"user_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai"
    reg_res = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "name": "Jane Doe",
    })
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == email

    # Login with same credentials
    login_res = client.post("/api/auth/login", json={
        "email": email,
        "password": "Password123!",
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data


def test_profile_creation_and_target_retrieval(client: TestClient):
    """Test creating user profile, calculating targets deterministically, and fetching targets."""
    # Register user
    email = f"profile_user_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai"
    reg_res = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "name": "Arjun Sharma",
    })
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Upsert Profile
    profile_payload = {
        "age": 28,
        "sex": "MALE",
        "height_cm": 176.0,
        "weight_kg": 72.0,
        "activity_level": "MODERATELY_ACTIVE",
        "goal": "MUSCLE_GAIN",
    }
    prof_res = client.post("/api/profile", json=profile_payload, headers=headers)
    assert prof_res.status_code == 200
    data = prof_res.json()
    assert data["profile"]["age"] == 28
    assert data["profile"]["goal"] == "MUSCLE_GAIN"
    assert data["targets"]["calorie_target"] > 2000.0
    assert data["targets"]["protein_target_g"] == round(72.0 * 1.8, 1)  # 129.6 g

    # Retrieve targets via GET /api/profile/targets
    target_res = client.get("/api/profile/targets", headers=headers)
    assert target_res.status_code == 200
    t_data = target_res.json()
    assert t_data["protein_target_g"] == 129.6
    assert "Estimated daily target" in t_data["disclaimer"]


def test_user_data_isolation(client: TestClient):
    """
    Test user isolation: User A creates a meal; User B cannot view User A's meal (403 Forbidden).
    """
    # User A
    email_a = f"usera_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai"
    token_a = client.post("/api/auth/register", json={
        "email": email_a,
        "password": "Password123!",
        "name": "User A",
    }).json()["access_token"]

    # User B
    email_b = f"userb_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai"
    token_b = client.post("/api/auth/register", json={
        "email": email_b,
        "password": "Password123!",
        "name": "User B",
    }).json()["access_token"]

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates a meal
    meal_payload = {
        "meal_type": "lunch",
        "notes": "User A private meal",
        "items": [
            {
                "food_name": "Chicken Biryani",
                "serving_count": 1.0,
                "serving_size": 250.0,
                "serving_unit": "g",
                "calories": 420.0,
                "protein": 28.0,
                "carbohydrates": 45.0,
                "fat": 14.0,
                "fiber": 3.0,
            }
        ],
    }
    create_res = client.post("/api/meals", json=meal_payload, headers=headers_a)
    assert create_res.status_code == 201
    meal_id = create_res.json()["id"]

    # User A can access meal
    get_a = client.get(f"/api/meals/{meal_id}", headers=headers_a)
    assert get_a.status_code == 200

    # User B tries to access User A's meal -> 403 Forbidden
    get_b = client.get(f"/api/meals/{meal_id}", headers=headers_b)
    assert get_b.status_code == 403
    assert "do not have permission" in get_b.json()["detail"]


def test_daily_nutrition_aggregation_and_overage(client: TestClient):
    """
    Test daily tracking aggregation:
    - User logs meal
    - Daily nutrition sums calories/macros
    - Remaining and overage calculations
    """
    email = f"daily_user_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai"
    token = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "name": "Daily Tracker",
    }).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Setup profile with low calorie target (1500 kcal) for quick overage testing
    client.post("/api/profile", json={
        "age": 30,
        "sex": "FEMALE",
        "height_cm": 155.0,
        "weight_kg": 50.0,
        "activity_level": "SEDENTARY",
        "goal": "WEIGHT_LOSS",
    }, headers=headers)

    # Log Meal 1: 800 kcal
    client.post("/api/meals", json={
        "meal_type": "lunch",
        "items": [{
            "food_name": "Paneer Butter Masala",
            "serving_count": 2.0,
            "serving_size": 150.0,
            "serving_unit": "bowl",
            "calories": 400.0,
            "protein": 15.0,
            "carbohydrates": 12.0,
            "fat": 32.0,
            "fiber": 2.0,
        }],
    }, headers=headers)

    # Check daily nutrition
    daily_res1 = client.get("/api/daily-nutrition", headers=headers)
    assert daily_res1.status_code == 200
    d1 = daily_res1.json()
    assert d1["consumed"]["calories"] == 800.0
    assert d1["remaining"]["calories"] > 0
    assert d1["overage"]["is_over_target"] is False
    assert "remaining" in d1["overage"]["status_message"]

    # Log Meal 2: 1200 kcal -> Total 2000 kcal (exceeds target ~1050 kcal)
    client.post("/api/meals", json={
        "meal_type": "dinner",
        "items": [{
            "food_name": "Biryani Feast",
            "serving_count": 1.0,
            "serving_size": 500.0,
            "serving_unit": "plate",
            "calories": 1200.0,
            "protein": 45.0,
            "carbohydrates": 120.0,
            "fat": 50.0,
            "fiber": 6.0,
        }],
    }, headers=headers)

    # Check daily nutrition after overage
    daily_res2 = client.get("/api/daily-nutrition", headers=headers)
    assert daily_res2.status_code == 200
    d2 = daily_res2.json()
    assert d2["consumed"]["calories"] == 2000.0
    assert d2["remaining"]["calories"] == 0.0
    assert d2["overage"]["is_over_target"] is True
    assert "+9" in d2["overage"]["status_message"] or "over target" in d2["overage"]["status_message"]
    assert d2["meal_count"] == 2


def test_evaluate_meal_endpoint(client: TestClient):
    """Test POST /api/daily-nutrition/evaluate-meal integration."""
    email = f"eval_user_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai"
    token = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "name": "Eval User",
    }).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    client.post("/api/profile", json={
        "age": 25,
        "sex": "MALE",
        "height_cm": 175.0,
        "weight_kg": 70.0,
        "activity_level": "MODERATELY_ACTIVE",
        "goal": "MUSCLE_GAIN",
    }, headers=headers)

    eval_payload = {
        "meal_calories": 650.0,
        "meal_protein": 42.0,
        "meal_carbs": 70.0,
        "meal_fat": 18.0,
        "meal_fiber": 8.0,
    }
    res = client.post("/api/daily-nutrition/evaluate-meal", json=eval_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["meal_calories"] == 650.0
    assert len(data["insights"]) >= 3
    assert data["fits_remaining_budget"] is True


def test_unauthorized_endpoints_protection(client: TestClient):
    """Test that protected endpoints reject requests without valid credentials."""
    assert client.get("/api/profile").status_code == 401
    assert client.get("/api/profile/targets").status_code == 401
    assert client.get("/api/daily-nutrition").status_code == 401
    assert client.post("/api/daily-nutrition/evaluate-meal", json={"meal_calories": 500.0, "meal_protein": 20.0, "meal_carbs": 50.0, "meal_fat": 10.0}).status_code == 401

