"""
NutriLens Deterministic Nutrition Calculation Engine.

Rules & Principles:
1. Nutrition calculations MUST be deterministic and derived directly from verified food item data.
2. The AI identifies items and estimates portions; the calculation engine computes macros.
3. Cooked foods have natural variances (oil absorption, density, moisture). The engine computes
   honest uncertainty intervals rather than claiming false precision (e.g., 'Estimated: 720 kcal' with ±10% margin).
"""

from dataclasses import dataclass
from typing import List, Optional, Dict, Any
import math


@dataclass
class ItemNutritionalInput:
    food_name: str
    serving_count: float
    base_serving_size: float
    base_serving_unit: str
    base_calories: float
    base_protein: float
    base_carbohydrates: float
    base_fat: float
    base_fiber: float = 0.0
    base_sugar: float = 0.0
    base_sodium: float = 0.0
    uncertainty_pct: float = 10.0  # Recipe/portion variance percentage


@dataclass
class ItemNutritionalOutput:
    food_name: str
    serving_count: float
    serving_size: float
    serving_unit: str
    calories: float
    protein: float
    carbohydrates: float
    fat: float
    fiber: float
    sugar: float = 0.0
    sodium: float = 0.0
    calorie_min: float = 0.0
    calorie_max: float = 0.0
    uncertainty_calories: float = 0.0
    uncertainty_pct: float = 10.0


@dataclass
class MealNutritionSummary:
    total_calories: float
    total_protein: float
    total_carbohydrates: float
    total_fat: float
    total_fiber: float
    calorie_min: float
    calorie_max: float
    uncertainty_calories: float
    formatted_estimate: str
    macro_distribution: Dict[str, float]  # Percentage of calories from protein, carbs, fat
    items: List[ItemNutritionalOutput]
    total_sugar: float = 0.0
    total_sodium: float = 0.0
    confidence_level: str = "MEDIUM"
    uncertainty_explanation: str = "Portion estimate derived from visible serving volume."


class NutritionEngine:
    """Deterministic calculation and uncertainty engine for food items and composite meals."""

    @staticmethod
    def calculate_item(item: ItemNutritionalInput) -> ItemNutritionalOutput:
        """
        Calculates macros for a single item scaled by serving_count.
        """
        count = max(0.0, float(item.serving_count))
        
        calories = round(item.base_calories * count, 1)
        protein = round(item.base_protein * count, 1)
        carbs = round(item.base_carbohydrates * count, 1)
        fat = round(item.base_fat * count, 1)
        fiber = round(item.base_fiber * count, 1)
        sugar = round((item.base_sugar or 0.0) * count, 1)
        sodium = round((item.base_sodium or 0.0) * count, 1)
        
        # Uncertainty delta calculation
        variance_ratio = (item.uncertainty_pct or 10.0) / 100.0
        delta = round(calories * variance_ratio, 1)
        calorie_min = max(0.0, round(calories - delta, 1))
        calorie_max = round(calories + delta, 1)

        return ItemNutritionalOutput(
            food_name=item.food_name,
            serving_count=count,
            serving_size=round(item.base_serving_size * count, 1),
            serving_unit=item.base_serving_unit,
            calories=calories,
            protein=protein,
            carbohydrates=carbs,
            fat=fat,
            fiber=fiber,
            sugar=sugar,
            sodium=sodium,
            calorie_min=calorie_min,
            calorie_max=calorie_max,
            uncertainty_calories=delta,
            uncertainty_pct=item.uncertainty_pct,
        )

    @classmethod
    def calculate_meal(cls, items: List[ItemNutritionalInput]) -> MealNutritionSummary:
        """
        Deterministically aggregates items and computes total macros, macro distributions,
        and composite uncertainty bounds.
        """
        calculated_items: List[ItemNutritionalOutput] = [
            cls.calculate_item(item) for item in items
        ]

        total_calories = round(sum(i.calories for i in calculated_items), 1)
        total_protein = round(sum(i.protein for i in calculated_items), 1)
        total_carbs = round(sum(i.carbohydrates for i in calculated_items), 1)
        total_fat = round(sum(i.fat for i in calculated_items), 1)
        total_fiber = round(sum(i.fiber for i in calculated_items), 1)
        total_sugar = round(sum(i.sugar for i in calculated_items), 1)
        total_sodium = round(sum(i.sodium for i in calculated_items), 1)

        # Statistical root-sum-square or linear composite uncertainty
        # For food portions, quadratic sum of variances accounts for independent errors:
        # sigma_total = sqrt(sum(sigma_i^2))
        if calculated_items:
            variance_sq_sum = sum(math.pow(i.uncertainty_calories, 2) for i in calculated_items)
            composite_delta = round(math.sqrt(variance_sq_sum), 1)
        else:
            composite_delta = 0.0

        calorie_min = max(0.0, round(total_calories - composite_delta, 1))
        calorie_max = round(total_calories + composite_delta, 1)

        # Macro distribution based on Atwater energy contributions
        # Protein: 4 kcal/g, Carbs: 4 kcal/g, Fat: 9 kcal/g
        energy_from_protein = total_protein * 4.0
        energy_from_carbs = total_carbs * 4.0
        energy_from_fat = total_fat * 9.0
        macro_energy_total = energy_from_protein + energy_from_carbs + energy_from_fat

        if macro_energy_total > 0:
            pct_protein = round((energy_from_protein / macro_energy_total) * 100, 1)
            pct_carbs = round((energy_from_carbs / macro_energy_total) * 100, 1)
            pct_fat = round((energy_from_fat / macro_energy_total) * 100, 1)
        else:
            pct_protein, pct_carbs, pct_fat = 0.0, 0.0, 0.0

        # Human-readable honest estimation string
        if total_calories > 0:
            formatted_estimate = f"Estimated: ~{int(round(total_calories))} kcal (±{int(round(composite_delta))} kcal)"
        else:
            formatted_estimate = "Estimated: 0 kcal"

        return MealNutritionSummary(
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
            formatted_estimate=formatted_estimate,
            macro_distribution={
                "protein_pct": pct_protein,
                "carbohydrates_pct": pct_carbs,
                "fat_pct": pct_fat,
            },
            items=calculated_items,
        )
