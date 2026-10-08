import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.meal import Meal
from app.models.meal_item import MealItem
from app.models.food import FoodItem
from app.nutrition.provider import DatabaseNutritionProvider
from app.nutrition.calculation_service import ConfirmedFoodItemInput, NutritionCalculationService
from app.optimizer.enums import MealIssueEnum, ModificationTypeEnum
from app.optimizer.rules import MealIssueAnalyzer
from app.optimizer.scoring import CandidateScorer
from app.optimizer.candidate_generator import CandidateGenerator
from app.optimizer.service import MealOptimizationService
from app.schemas.optimization import ApplyOptimizationRequest, CandidateItemSchema


# ==========================================
# Unit Tests: Rules & Scoring & Generation
# ==========================================

def test_meal_issue_analyzer_high_calorie():
    """Verify HIGH_CALORIE is flagged when meal consumes >65% remaining budget or >700 kcal on weight loss."""
    # Meal with 850 kcal when remaining budget is 1000 kcal (85% of budget)
    issues = MealIssueAnalyzer.identify_issues(
        meal_calories=850.0,
        meal_protein=30.0,
        meal_carbs=110.0,
        meal_fat=32.0,
        meal_fiber=5.0,
        daily_target_calories=2000.0,
        remaining_calories=1000.0,
        goal="WEIGHT_LOSS",
    )
    assert MealIssueEnum.HIGH_CALORIE in issues


def test_meal_issue_analyzer_low_protein():
    """Verify LOW_PROTEIN is flagged when protein calories are <15% of total energy."""
    # 600 kcal meal with only 12g protein -> 48 kcal from protein = 8% of energy
    issues = MealIssueAnalyzer.identify_issues(
        meal_calories=600.0,
        meal_protein=12.0,
        meal_carbs=90.0,
        meal_fat=20.0,
        meal_fiber=4.0,
        daily_target_calories=2000.0,
        remaining_calories=1500.0,
        goal="WEIGHT_LOSS",
    )
    assert MealIssueEnum.LOW_PROTEIN in issues


def test_meal_issue_analyzer_low_fiber():
    """Verify LOW_FIBER is flagged when fiber is <3g in a meal >=350 kcal."""
    issues = MealIssueAnalyzer.identify_issues(
        meal_calories=550.0,
        meal_protein=28.0,
        meal_carbs=60.0,
        meal_fat=20.0,
        meal_fiber=1.2,
        daily_target_calories=2000.0,
        remaining_calories=1500.0,
        goal="MAINTENANCE",
    )
    assert MealIssueEnum.LOW_FIBER in issues


def test_candidate_scorer_normalized_and_practical():
    """Verify scoring logic favors realistic modifications over extreme 75% calorie cuts."""
    orig = {"calories": 850.0, "protein": 32.0, "carbohydrates": 105.0, "fat": 35.0, "fiber": 4.0}
    
    # Practical candidate: 650 kcal, 30g protein (23% reduction, high protein preservation)
    opt_practical = {"calories": 650.0, "protein": 30.0, "carbohydrates": 80.0, "fat": 26.0, "fiber": 6.0}
    score_practical = CandidateScorer.score_candidate(
        goal="WEIGHT_LOSS",
        original_nutrition=orig,
        optimized_nutrition=opt_practical,
        remaining_calories=1200.0,
        daily_target_calories=2000.0,
    )
    assert 0.0 <= score_practical <= 1.0
    assert score_practical >= 0.75

    # Extreme candidate: 200 kcal, 8g protein (76% reduction, huge protein loss)
    opt_extreme = {"calories": 200.0, "protein": 8.0, "carbohydrates": 25.0, "fat": 7.0, "fiber": 2.0}
    score_extreme = CandidateScorer.score_candidate(
        goal="WEIGHT_LOSS",
        original_nutrition=orig,
        optimized_nutrition=opt_extreme,
        remaining_calories=1200.0,
        daily_target_calories=2000.0,
    )
    assert score_practical > score_extreme


def test_candidate_generator_deterministic_recalculation(db_session: Session):
    """
    Verify candidate generator generates candidates and passes modified portions
    through NutritionCalculationService rather than guessing numbers.
    """
    provider = DatabaseNutritionProvider(db_session)
    calc_service = NutritionCalculationService(provider)
    generator = CandidateGenerator(provider)

    biryani_food = provider.get_food_by_name("Chicken Biryani")
    assert biryani_food is not None

    items = [
        ConfirmedFoodItemInput(
            food_id=biryani_food.id,
            food_name=biryani_food.name,
            portion_value=350.0,
            portion_unit="g",
        )
    ]

    issues = [MealIssueEnum.HIGH_CALORIE, MealIssueEnum.LOW_FIBER]
    candidates = generator.generate_candidates(
        current_items=items,
        issues=issues,
        goal="WEIGHT_LOSS",
        remaining_calories=1200.0,
    )

    assert len(candidates) >= 2
    
    # Verify candidate 1 (reduce rice)
    cand1 = candidates[0]
    assert cand1["candidate_key"] == "reduce_base"
    reduced_inputs = cand1["modified_inputs"]
    assert len(reduced_inputs) == 1
    assert reduced_inputs[0].portion_value == round(350.0 * 0.75, 1)

    # Recalculate candidate 1 through NutritionCalculationService
    calc_res = calc_service.calculate_meal(reduced_inputs)
    assert calc_res.total_calories > 0
    # Original: 154 kcal/100g * 3.5 = 539.0 kcal. Reduced: 154 * 2.625 = ~404.2 kcal
    assert calc_res.total_calories < 539.0
    assert calc_res.confidence_level in ("HIGH", "MEDIUM")


# ==========================================
# Integration Tests: Endpoints & Isolation
# ==========================================

def test_optimize_meal_api_flow(client: TestClient):
    """
    Test full API flow:
    1. Register user
    2. Create a meal (Chicken Biryani)
    3. Call POST /api/meals/{meal_id}/optimize
    4. Verify 2-3 recommendations returned with deterministic recalculation and scores
    """
    email = f"opt_user_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai"
    auth_res = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "name": "Optimization Tester",
    })
    token = auth_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Set up user profile: Weight Loss goal
    client.post("/api/profile", json={
        "age": 28,
        "sex": "MALE",
        "height_cm": 178.0,
        "weight_kg": 76.0,
        "activity_level": "MODERATELY_ACTIVE",
        "goal": "WEIGHT_LOSS",
    }, headers=headers)

    # Fetch biryani food
    foods_res = client.get("/api/foods?q=Chicken Biryani")
    biryani_id = foods_res.json()["items"][0]["id"]

    # Create a substantial meal
    create_meal_payload = {
        "meal_type": "lunch",
        "notes": "Large lunch portion",
        "items": [
            {
                "food_id": biryani_id,
                "food_name": "Chicken Biryani",
                "serving_count": 3.5,
                "serving_size": 100.0,
                "serving_unit": "g",
                "gram_weight": 350.0,
                "calories": 539.0,
                "protein": 28.3,
                "carbohydrates": 65.1,
                "fat": 17.8,
                "fiber": 3.8,
            }
        ],
    }
    meal_res = client.post("/api/meals", json=create_meal_payload, headers=headers)
    assert meal_res.status_code == 201
    meal_id = meal_res.json()["id"]

    # Request Optimization
    opt_res = client.post(f"/api/meals/{meal_id}/optimize", headers=headers)
    assert opt_res.status_code == 200
    opt_data = opt_res.json()

    assert opt_data["meal_id"] == meal_id
    assert opt_data["goal"] == "WEIGHT_LOSS"
    assert len(opt_data["recommendations"]) >= 2

    # Validate recommendations structure
    rec1 = opt_data["recommendations"][0]
    assert rec1["title"] is not None
    assert rec1["score"] > 0
    assert "explanation" in rec1 and len(rec1["explanation"]) > 10
    assert rec1["original_nutrition"]["calories"] > 0
    assert rec1["optimized_nutrition"]["calories"] > 0
    assert rec1["confidence"] in ("HIGH", "MEDIUM")
    assert len(rec1["items"]) >= 1


def test_apply_optimization_preserves_original_meal(client: TestClient):
    """
    Verify applying an optimization:
    - Creates a new meal record linked to parent_meal_id
    - Original meal remains completely intact with original calories/macros
    """
    email = f"apply_user_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai"
    token = client.post("/api/auth/register", json={
        "email": email,
        "password": "Password123!",
        "name": "Apply Tester",
    }).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create initial meal
    initial_meal = client.post("/api/meals", json={
        "meal_type": "dinner",
        "items": [
            {
                "food_name": "Steamed Basmati Rice",
                "serving_count": 2.0,
                "serving_size": 100.0,
                "serving_unit": "g",
                "calories": 260.0,
                "protein": 5.4,
                "carbohydrates": 56.4,
                "fat": 0.6,
                "fiber": 0.8,
            }
        ],
    }, headers=headers).json()
    orig_meal_id = initial_meal["id"]

    # Get optimization suggestions
    opt_res = client.post(f"/api/meals/{orig_meal_id}/optimize?goal=WEIGHT_LOSS", headers=headers)
    assert opt_res.status_code == 200
    chosen_rec = opt_res.json()["recommendations"][0]

    # Apply the recommendation
    apply_payload = {
        "recommendation_id": chosen_rec["id"],
        "notes": f"Applied suggestion: {chosen_rec['title']}",
        "items": chosen_rec["items"],
    }
    apply_res = client.post(f"/api/meals/{orig_meal_id}/apply-optimization", json=apply_payload, headers=headers)
    assert apply_res.status_code == 201
    new_meal = apply_res.json()

    # 1. New meal is distinct and references parent
    assert new_meal["id"] != orig_meal_id
    assert new_meal["parent_meal_id"] == orig_meal_id
    assert new_meal["is_optimized_version"] is True

    # 2. Original meal is untouched and intact
    fetch_orig = client.get(f"/api/meals/{orig_meal_id}", headers=headers).json()
    assert fetch_orig["id"] == orig_meal_id
    assert fetch_orig["total_calories"] == initial_meal["total_calories"]
    assert fetch_orig["parent_meal_id"] is None
    assert fetch_orig["is_optimized_version"] is False


def test_user_cannot_optimize_another_users_meal(client: TestClient):
    """Verify User B cannot request optimization or apply changes to User A's meal (403 Forbidden)."""
    token_a = client.post("/api/auth/register", json={
        "email": f"usera_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai",
        "password": "Password123!",
        "name": "User A",
    }).json()["access_token"]

    token_b = client.post("/api/auth/register", json={
        "email": f"userb_{datetime.now(timezone.utc).timestamp()}@nutrilens.ai",
        "password": "Password123!",
        "name": "User B",
    }).json()["access_token"]

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # User A creates a meal
    meal_a = client.post("/api/meals", json={
        "meal_type": "lunch",
        "items": [{
            "food_name": "Dal Tadka",
            "serving_count": 1.0,
            "serving_size": 200.0,
            "serving_unit": "bowl",
            "calories": 180.0,
            "protein": 9.2,
            "carbohydrates": 24.0,
            "fat": 5.5,
            "fiber": 6.5,
        }],
    }, headers=headers_a).json()

    # User B tries to optimize User A's meal -> 403 Forbidden
    res_opt = client.post(f"/api/meals/{meal_a['id']}/optimize", headers=headers_b)
    assert res_opt.status_code == 403
    assert "permission" in res_opt.json()["detail"].lower()

    # User B tries to apply optimization to User A's meal -> 403 Forbidden
    res_apply = client.post(f"/api/meals/{meal_a['id']}/apply-optimization", json={
        "items": [{
            "food_name": "Dal Tadka",
            "portion_value": 150.0,
            "portion_unit": "g",
            "calories": 135.0,
            "protein": 6.9,
            "carbohydrates": 18.0,
            "fat": 4.1,
            "fiber": 4.9,
        }],
    }, headers=headers_b)
    assert res_apply.status_code == 403
    assert "permission" in res_apply.json()["detail"].lower()
