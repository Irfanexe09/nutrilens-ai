from app.nutrition.engine import (
    NutritionEngine,
    ItemNutritionalInput,
)


def test_single_item_deterministic_calculation():
    item = ItemNutritionalInput(
        food_name="Chicken Biryani",
        serving_count=1.5,
        base_serving_size=350.0,
        base_serving_unit="plate",
        base_calories=540.0,
        base_protein=28.5,
        base_carbohydrates=65.0,
        base_fat=18.0,
        base_fiber=3.8,
        uncertainty_pct=10.0,
    )
    result = NutritionEngine.calculate_item(item)

    assert result.food_name == "Chicken Biryani"
    assert result.serving_count == 1.5
    assert result.serving_size == 525.0
    assert result.calories == 810.0  # 540 * 1.5
    assert result.protein == 42.8   # 28.5 * 1.5 = 42.75 -> round to 42.8
    assert result.carbohydrates == 97.5  # 65.0 * 1.5
    assert result.fat == 27.0
    assert result.fiber == 5.7
    assert result.uncertainty_calories == 81.0  # 10% of 810
    assert result.calorie_min == 729.0
    assert result.calorie_max == 891.0


def test_composite_meal_nutrition_and_uncertainty():
    biryani = ItemNutritionalInput(
        food_name="Chicken Biryani",
        serving_count=1.0,
        base_serving_size=350.0,
        base_serving_unit="plate",
        base_calories=540.0,
        base_protein=28.5,
        base_carbohydrates=65.0,
        base_fat=18.0,
        base_fiber=3.8,
        uncertainty_pct=10.0,
    )
    raita = ItemNutritionalInput(
        food_name="Cucumber Raita",
        serving_count=1.0,
        base_serving_size=120.0,
        base_serving_unit="bowl",
        base_calories=75.0,
        base_protein=4.2,
        base_carbohydrates=6.8,
        base_fat=3.4,
        base_fiber=0.8,
        uncertainty_pct=6.0,
    )

    summary = NutritionEngine.calculate_meal([biryani, raita])

    assert summary.total_calories == 615.0
    assert summary.total_protein == 32.7
    assert summary.total_carbohydrates == 71.8
    assert summary.total_fat == 21.4
    assert summary.total_fiber == 4.6
    assert summary.calorie_min < summary.total_calories
    assert summary.calorie_max > summary.total_calories
    assert "Estimated: ~615 kcal" in summary.formatted_estimate
    assert "protein_pct" in summary.macro_distribution
    assert "carbohydrates_pct" in summary.macro_distribution
    assert "fat_pct" in summary.macro_distribution


def test_determinism_across_multiple_runs():
    item = ItemNutritionalInput(
        food_name="Masala Dosa",
        serving_count=2.0,
        base_serving_size=180.0,
        base_serving_unit="piece",
        base_calories=310.0,
        base_protein=6.5,
        base_carbohydrates=48.0,
        base_fat=10.5,
        base_fiber=3.2,
        uncertainty_pct=10.0,
    )
    
    first = NutritionEngine.calculate_meal([item])
    for _ in range(10):
        subsequent = NutritionEngine.calculate_meal([item])
        assert subsequent.total_calories == first.total_calories
        assert subsequent.total_protein == first.total_protein
        assert subsequent.calorie_min == first.calorie_min
        assert subsequent.calorie_max == first.calorie_max
