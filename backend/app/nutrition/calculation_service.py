"""
NutriLens Deterministic Nutrition Calculation Service.

Strictly Programmatic & Deterministic:
- NO LLM arithmetic or calorie guessing.
- All nutritional calculations are derived from verified reference database records.
- Converts units to grams and computes precise macros, energy distribution, and uncertainty intervals.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict
import math
from app.models.food import FoodItem
from app.nutrition.provider import NutritionDataProvider
from app.nutrition.portion_converter import PortionConverter, ConvertedPortion, InvalidPortionError, UnsupportedUnitError


class FoodNotFoundError(ValueError):
    """Raised when a food item cannot be located in the nutrition data provider."""
    pass


@dataclass
class ConfirmedFoodItemInput:
    food_id: Optional[int] = None
    food_name: str = ""
    portion_value: float = 100.0
    portion_unit: str = "g"
    is_exact_weight: bool = False
    confidence_score: Optional[float] = None


@dataclass
class ItemNutritionResult:
    food_id: Optional[int]
    food_name: str
    category: str
    portion_value: float
    portion_unit: str
    gram_weight: float
    scaling_factor: float
    calories: float
    protein: float
    carbohydrates: float
    fat: float
    fiber: float
    sugar: float
    sodium: float
    calorie_min: float
    calorie_max: float
    uncertainty_calories: float
    uncertainty_pct: float
    confidence_level: str
    data_source: str
    conversion_notes: str


@dataclass
class MealNutritionCalculationResult:
    total_calories: float
    total_protein: float
    total_carbohydrates: float
    total_fat: float
    total_fiber: float
    total_sugar: float
    total_sodium: float
    calorie_min: float
    calorie_max: float
    uncertainty_calories: float
    confidence_level: str
    uncertainty_explanation: str
    formatted_estimate: str
    macro_distribution: Dict[str, float]
    items: List[ItemNutritionResult] = field(default_factory=list)


class NutritionCalculationService:
    """
    Core service coordinating food lookup, portion conversion, and deterministic macro calculation.
    """

    def __init__(self, provider: NutritionDataProvider):
        self.provider = provider

    def calculate_food_item(
        self, item_input: ConfirmedFoodItemInput
    ) -> ItemNutritionResult:
        """
        Deterministically calculates macros for a single confirmed food item.
        """
        # 1. Lookup food record
        food: Optional[FoodItem] = None
        if item_input.food_id:
            food = self.provider.get_food_by_id(item_input.food_id)
        if not food and item_input.food_name:
            food = self.provider.get_food_by_name(item_input.food_name)

        if not food:
            raise FoodNotFoundError(
                f"Food item '{item_input.food_name or item_input.food_id}' not found in the verified nutrition database."
            )

        # 2. Convert portion to grams
        converted: ConvertedPortion = PortionConverter.convert_to_grams(
            food=food,
            value=item_input.portion_value,
            unit=item_input.portion_unit,
        )

        k = converted.scaling_factor

        # 3. Deterministic arithmetic per reference portion
        calories = round(food.calories * k, 1)
        protein = round(food.protein * k, 1)
        carbs = round(food.carbohydrates * k, 1)
        fat = round(food.fat * k, 1)
        fiber = round((food.fiber or 0.0) * k, 1)
        sugar = round((food.sugar or 0.0) * k, 1)
        sodium = round((food.sodium or 0.0) * k, 1)

        # 4. Uncertainty & confidence assessment
        # Recipe variance from food record (e.g. 10%)
        recipe_variance_ratio = (food.uncertainty_pct or 10.0) / 100.0

        if item_input.is_exact_weight:
            # Weighed scale measurement: only recipe variance applies
            total_variance_ratio = recipe_variance_ratio
            confidence_level = "HIGH"
        else:
            # Visual estimate: quadratic sum of recipe variance and portion volume variance (~12%)
            portion_variance_ratio = 0.12
            total_variance_ratio = math.sqrt(
                math.pow(recipe_variance_ratio, 2) + math.pow(portion_variance_ratio, 2)
            )
            confidence_level = "MEDIUM"

        delta_cal = round(calories * total_variance_ratio, 1)
        cal_min = max(0.0, round(calories - delta_cal, 1))
        cal_max = round(calories + delta_cal, 1)

        return ItemNutritionResult(
            food_id=food.id,
            food_name=food.name,
            category=food.category,
            portion_value=item_input.portion_value,
            portion_unit=item_input.portion_unit,
            gram_weight=converted.gram_weight,
            scaling_factor=converted.scaling_factor,
            calories=calories,
            protein=protein,
            carbohydrates=carbs,
            fat=fat,
            fiber=fiber,
            sugar=sugar,
            sodium=sodium,
            calorie_min=cal_min,
            calorie_max=cal_max,
            uncertainty_calories=delta_cal,
            uncertainty_pct=round(total_variance_ratio * 100, 1),
            confidence_level=confidence_level,
            data_source=food.data_source or "ICMR-NIN IFCT 2017 & USDA FoodData Central",
            conversion_notes=converted.conversion_notes,
        )

    def calculate_meal(
        self, items: List[ConfirmedFoodItemInput]
    ) -> MealNutritionCalculationResult:
        """
        Deterministically aggregates multiple items into a total meal breakdown.
        """
        if not items:
            return MealNutritionCalculationResult(
                total_calories=0.0,
                total_protein=0.0,
                total_carbohydrates=0.0,
                total_fat=0.0,
                total_fiber=0.0,
                total_sugar=0.0,
                total_sodium=0.0,
                calorie_min=0.0,
                calorie_max=0.0,
                uncertainty_calories=0.0,
                confidence_level="HIGH",
                uncertainty_explanation="No food items present in meal.",
                formatted_estimate="Estimated: 0 kcal",
                macro_distribution={"protein_pct": 0.0, "carbohydrates_pct": 0.0, "fat_pct": 0.0},
                items=[],
            )

        calculated_items: List[ItemNutritionResult] = [
            self.calculate_food_item(item) for item in items
        ]

        total_calories = round(sum(i.calories for i in calculated_items), 1)
        total_protein = round(sum(i.protein for i in calculated_items), 1)
        total_carbs = round(sum(i.carbohydrates for i in calculated_items), 1)
        total_fat = round(sum(i.fat for i in calculated_items), 1)
        total_fiber = round(sum(i.fiber for i in calculated_items), 1)
        total_sugar = round(sum(i.sugar for i in calculated_items), 1)
        total_sodium = round(sum(i.sodium for i in calculated_items), 1)

        # Statistical root-sum-square composite uncertainty for independent ingredients
        variance_sq_sum = sum(math.pow(i.uncertainty_calories, 2) for i in calculated_items)
        composite_delta = round(math.sqrt(variance_sq_sum), 1)

        calorie_min = max(0.0, round(total_calories - composite_delta, 1))
        calorie_max = round(total_calories + composite_delta, 1)

        # Macro distribution (Atwater caloric contributions)
        energy_from_p = total_protein * 4.0
        energy_from_c = total_carbs * 4.0
        energy_from_f = total_fat * 9.0
        macro_total = energy_from_p + energy_from_c + energy_from_f

        if macro_total > 0:
            pct_p = round((energy_from_p / macro_total) * 100, 1)
            pct_c = round((energy_from_c / macro_total) * 100, 1)
            pct_f = round((energy_from_f / macro_total) * 100, 1)
        else:
            pct_p, pct_c, pct_f = 0.0, 0.0, 0.0

        # Meal confidence determination
        all_exact = all(i.confidence_level == "HIGH" for i in calculated_items)
        any_low = any(i.confidence_level == "LOW" for i in calculated_items)

        if all_exact:
            confidence_level = "HIGH"
            explanation = "High confidence: all portions were verified by gram weight against verified nutritional records."
        elif any_low:
            confidence_level = "LOW"
            explanation = "Lower confidence: portion estimation or food matching contains elevated uncertainty."
        else:
            confidence_level = "MEDIUM"
            explanation = "Medium confidence: portions are visually estimated from photography with ±10–15% variance. Weighed confirmation provides exact precision."

        formatted_estimate = f"Estimated: ~{int(round(total_calories))} kcal (±{int(round(composite_delta))} kcal)"

        return MealNutritionCalculationResult(
            total_calories=total_calories,
            total_protein=total_protein,
            total_carbohydrates=total_carbs,
            total_fat=total_fat,
            total_fiber=total_fiber,
            total_sugar=total_sugar,
            total_sodium=total_sodium,
            calorie_min=calorie_min,
            calorie_max=calorie_max,
            uncertainty_calories=composite_delta,
            confidence_level=confidence_level,
            uncertainty_explanation=explanation,
            formatted_estimate=formatted_estimate,
            macro_distribution={
                "protein_pct": pct_p,
                "carbohydrates_pct": pct_c,
                "fat_pct": pct_f,
            },
            items=calculated_items,
        )
