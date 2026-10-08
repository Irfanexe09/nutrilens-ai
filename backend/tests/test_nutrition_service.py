import pytest
from fastapi.testclient import TestClient
from app.nutrition.provider import DatabaseNutritionProvider
from app.nutrition.portion_converter import PortionConverter, InvalidPortionError, UnsupportedUnitError
from app.nutrition.calculation_service import (
    NutritionCalculationService,
    ConfirmedFoodItemInput,
    FoodNotFoundError,
)
from app.models.food import FoodItem


def test_100g_reference_food_calculation(db_session):
    """Verifies that calculating for the 100g base serving yields exact database reference macros."""
    provider = DatabaseNutritionProvider(db_session)
    service = NutritionCalculationService(provider)

    biryani = provider.get_food_by_name("Chicken Biryani")
    assert biryani is not None

    item_input = ConfirmedFoodItemInput(
        food_id=biryani.id,
        food_name=biryani.name,
        portion_value=100.0,
        portion_unit="g",
        is_exact_weight=True,
    )
    res = service.calculate_food_item(item_input)

    assert res.gram_weight == 100.0
    assert res.scaling_factor == 1.0
    assert res.calories == biryani.calories
    assert res.protein == biryani.protein
    assert res.carbohydrates == biryani.carbohydrates
    assert res.fat == biryani.fat
    assert res.confidence_level == "HIGH"


def test_scaled_portion_calculation(db_session):
    """Verifies proportional scaling for an estimated portion (e.g. 250g Chicken Biryani)."""
    provider = DatabaseNutritionProvider(db_session)
    service = NutritionCalculationService(provider)

    biryani = provider.get_food_by_name("Chicken Biryani")
    assert biryani is not None

    item_input = ConfirmedFoodItemInput(
        food_id=biryani.id,
        food_name=biryani.name,
        portion_value=250.0,
        portion_unit="g",
        is_exact_weight=False,
    )
    res = service.calculate_food_item(item_input)

    # 250g / 100g = 2.5 multiplier
    expected_calories = round(biryani.calories * 2.5, 1)
    expected_protein = round(biryani.protein * 2.5, 1)
    expected_carbs = round(biryani.carbohydrates * 2.5, 1)
    expected_fat = round(biryani.fat * 2.5, 1)

    assert res.gram_weight == 250.0
    assert res.scaling_factor == 2.5
    assert res.calories == expected_calories
    assert res.protein == expected_protein
    assert res.carbohydrates == expected_carbs
    assert res.fat == expected_fat
    # Visual estimate should yield MEDIUM confidence
    assert res.confidence_level == "MEDIUM"
    assert res.calorie_min < res.calories < res.calorie_max


def test_piece_based_food_conversion(db_session):
    """Verifies piece-to-gram conversion (e.g. 2 pieces of Chapati / Roti, 3 Idlis)."""
    provider = DatabaseNutritionProvider(db_session)
    service = NutritionCalculationService(provider)

    roti = provider.get_food_by_name("Chapati / Roti")
    assert roti is not None
    assert roti.piece_weight_g == 40.0  # 1 roti = 40g

    # 2 pieces of chapati = 80g
    item_input = ConfirmedFoodItemInput(
        food_id=roti.id,
        food_name=roti.name,
        portion_value=2.0,
        portion_unit="piece",
        is_exact_weight=True,
    )
    res = service.calculate_food_item(item_input)

    assert res.gram_weight == 80.0
    assert res.scaling_factor == 0.8
    assert res.calories == round(roti.calories * 0.8, 1)
    assert res.protein == round(roti.protein * 0.8, 1)

    # 3 pieces of idli (1 idli = 40g -> 120g)
    idli = provider.get_food_by_name("Idli")
    assert idli is not None
    idli_input = ConfirmedFoodItemInput(
        food_id=idli.id,
        food_name=idli.name,
        portion_value=3.0,
        portion_unit="pieces",
        is_exact_weight=False,
    )
    idli_res = service.calculate_food_item(idli_input)
    assert idli_res.gram_weight == 120.0
    assert idli_res.scaling_factor == 1.2
    assert idli_res.calories == round(idli.calories * 1.2, 1)


def test_milliliter_density_conversion(db_session):
    """Verifies ml-to-gram conversion using food-specific density factor."""
    provider = DatabaseNutritionProvider(db_session)
    service = NutritionCalculationService(provider)

    curd = provider.get_food_by_name("Curd / Dahi")
    assert curd is not None
    assert curd.density_g_per_ml == 1.04

    # 200 ml curd with density 1.04 = 208g
    item_input = ConfirmedFoodItemInput(
        food_id=curd.id,
        food_name=curd.name,
        portion_value=200.0,
        portion_unit="ml",
        is_exact_weight=True,
    )
    res = service.calculate_food_item(item_input)

    assert res.gram_weight == 208.0
    assert res.scaling_factor == 2.08
    assert res.calories == round(curd.calories * 2.08, 1)
    assert res.protein == round(curd.protein * 2.08, 1)


def test_serving_unit_conversion(db_session):
    """Verifies serving/plate conversion based on reference serving size."""
    provider = DatabaseNutritionProvider(db_session)
    service = NutritionCalculationService(provider)

    dal = provider.get_food_by_name("Dal Tadka")
    assert dal is not None

    item_input = ConfirmedFoodItemInput(
        food_id=dal.id,
        food_name=dal.name,
        portion_value=1.5,
        portion_unit="serving",
    )
    res = service.calculate_food_item(item_input)

    assert res.scaling_factor == 1.5
    assert res.calories == round(dal.calories * 1.5, 1)


def test_composite_meal_aggregation(db_session):
    """Verifies deterministic summation of multiple meal items, composite uncertainty, and Atwater distribution."""
    provider = DatabaseNutritionProvider(db_session)
    service = NutritionCalculationService(provider)

    items = [
        ConfirmedFoodItemInput(
            food_name="Chicken Biryani",
            portion_value=250.0,
            portion_unit="g",
            is_exact_weight=False,
        ),
        ConfirmedFoodItemInput(
            food_name="Cucumber Raita",
            portion_value=120.0,
            portion_unit="g",
            is_exact_weight=False,
        ),
    ]

    meal_summary = service.calculate_meal(items)

    assert len(meal_summary.items) == 2
    assert meal_summary.total_calories == round(
        meal_summary.items[0].calories + meal_summary.items[1].calories, 1
    )
    assert meal_summary.total_protein == round(
        meal_summary.items[0].protein + meal_summary.items[1].protein, 1
    )
    assert meal_summary.calorie_min < meal_summary.total_calories < meal_summary.calorie_max
    assert meal_summary.uncertainty_calories > 0
    assert "protein_pct" in meal_summary.macro_distribution
    assert "carbohydrates_pct" in meal_summary.macro_distribution
    assert "fat_pct" in meal_summary.macro_distribution
    # Atwater percentage sum ~ 100%
    pct_sum = sum(meal_summary.macro_distribution.values())
    assert 99.0 <= pct_sum <= 101.0


def test_zero_or_negative_portion_error(db_session):
    """Verifies that portion <= 0 raises InvalidPortionError."""
    provider = DatabaseNutritionProvider(db_session)
    service = NutritionCalculationService(provider)

    biryani = provider.get_food_by_name("Chicken Biryani")
    assert biryani is not None

    with pytest.raises(InvalidPortionError) as exc_info:
        service.calculate_food_item(
            ConfirmedFoodItemInput(
                food_id=biryani.id,
                food_name=biryani.name,
                portion_value=0.0,
                portion_unit="g",
            )
        )
    assert "greater than zero" in str(exc_info.value).lower()

    with pytest.raises(InvalidPortionError):
        service.calculate_food_item(
            ConfirmedFoodItemInput(
                food_id=biryani.id,
                food_name=biryani.name,
                portion_value=-50.0,
                portion_unit="g",
            )
        )


def test_unsupported_unit_error(db_session):
    """Verifies that unsupported or incompatible units raise UnsupportedUnitError."""
    provider = DatabaseNutritionProvider(db_session)
    service = NutritionCalculationService(provider)

    biryani = provider.get_food_by_name("Chicken Biryani")
    assert biryani is not None

    # 'gallons' is not a supported unit
    with pytest.raises(UnsupportedUnitError) as exc_info:
        service.calculate_food_item(
            ConfirmedFoodItemInput(
                food_id=biryani.id,
                food_name=biryani.name,
                portion_value=2.0,
                portion_unit="gallons",
            )
        )
    assert "unsupported unit" in str(exc_info.value).lower()

    # 'piece' is not supported on a dish without piece_weight_g (like Biryani or Rice)
    with pytest.raises(UnsupportedUnitError):
        service.calculate_food_item(
            ConfirmedFoodItemInput(
                food_id=biryani.id,
                food_name=biryani.name,
                portion_value=2.0,
                portion_unit="piece",
            )
        )


def test_missing_food_error(db_session):
    """Verifies that querying a non-existent food raises FoodNotFoundError."""
    provider = DatabaseNutritionProvider(db_session)
    service = NutritionCalculationService(provider)

    with pytest.raises(FoodNotFoundError) as exc_info:
        service.calculate_food_item(
            ConfirmedFoodItemInput(
                food_name="Unknown Extraterrestrial Plant",
                portion_value=100.0,
                portion_unit="g",
            )
        )
    assert "not found" in str(exc_info.value).lower()


def test_confidence_level_computation(db_session):
    """Verifies HIGH confidence when weighed exact vs MEDIUM when visually estimated."""
    provider = DatabaseNutritionProvider(db_session)
    service = NutritionCalculationService(provider)

    # Weighed scale meal
    exact_items = [
        ConfirmedFoodItemInput(
            food_name="Boiled Egg",
            portion_value=2.0,
            portion_unit="piece",
            is_exact_weight=True,
        ),
        ConfirmedFoodItemInput(
            food_name="Chapati / Roti",
            portion_value=2.0,
            portion_unit="piece",
            is_exact_weight=True,
        ),
    ]
    exact_meal = service.calculate_meal(exact_items)
    assert exact_meal.confidence_level == "HIGH"
    assert "high confidence" in exact_meal.uncertainty_explanation.lower()

    # Visually estimated meal
    estimated_items = [
        ConfirmedFoodItemInput(
            food_name="Boiled Egg",
            portion_value=2.0,
            portion_unit="piece",
            is_exact_weight=False,
        ),
    ]
    estimated_meal = service.calculate_meal(estimated_items)
    assert estimated_meal.confidence_level == "MEDIUM"


def test_api_nutrition_calculate_endpoint(client: TestClient):
    """Integration test for POST /api/nutrition/calculate."""
    payload = {
        "items": [
            {
                "food_name": "Chicken Biryani",
                "portion_value": 250.0,
                "portion_unit": "g",
                "is_exact_weight": False,
            },
            {
                "food_name": "Cucumber Raita",
                "portion_value": 100.0,
                "portion_unit": "g",
                "is_exact_weight": True,
            },
        ]
    }
    response = client.post("/api/nutrition/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["total_calories"] > 0
    assert data["total_protein"] > 0
    assert data["total_carbohydrates"] > 0
    assert data["total_fat"] > 0
    assert "confidence_level" in data
    assert "macro_distribution" in data
    assert len(data["items"]) == 2
    assert data["items"][0]["food_name"] == "Chicken Biryani"


def test_api_meal_persistence_and_retrieval(client: TestClient):
    """Integration test for saving a meal and retrieving it with full calculated breakdown."""
    payload = {
        "meal_type": "lunch",
        "notes": "Sunday Indian lunch",
        "items": [
            {
                "food_name": "Chicken Biryani",
                "serving_count": 1.0,
                "serving_size": 100.0,
                "serving_unit": "g",
                "calories": 154.0,
                "protein": 8.1,
                "carbohydrates": 18.6,
                "fat": 5.1,
                "fiber": 1.1,
                "uncertainty_pct": 10.0,
            },
            {
                "food_name": "Cucumber Raita",
                "serving_count": 1.0,
                "serving_size": 100.0,
                "serving_unit": "g",
                "calories": 62.0,
                "protein": 3.5,
                "carbohydrates": 5.6,
                "fat": 2.8,
                "fiber": 0.7,
                "uncertainty_pct": 6.0,
            },
        ],
    }
    # 1. Create meal
    create_res = client.post("/api/meals", json=payload)
    assert create_res.status_code == 201
    meal_data = create_res.json()
    meal_id = meal_data["id"]
    assert meal_data["total_calories"] == 216.0
    assert meal_data["total_protein"] == 11.6
    assert len(meal_data["items"]) == 2

    # 2. Retrieve meal by ID
    get_res = client.get(f"/api/meals/{meal_id}")
    assert get_res.status_code == 200
    retrieved = get_res.json()
    assert retrieved["id"] == meal_id
    assert retrieved["total_calories"] == 216.0
    assert retrieved["meal_type"] == "lunch"
    assert "Estimated:" in retrieved["formatted_estimate"]
