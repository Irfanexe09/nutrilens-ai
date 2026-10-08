from typing import Dict, Any, List
from app.personalization.enums import GoalEnum


class MealEvaluationService:
    """
    Deterministic meal evaluation insights engine.
    Evaluates how a candidate meal fits within the user's remaining daily nutritional budget
    and offers concrete, evidence-based macro and fiber feedback.
    """

    @staticmethod
    def evaluate(
        meal_calories: float,
        meal_protein: float,
        meal_carbs: float,
        meal_fat: float,
        meal_fiber: float,
        remaining_calories: float,
        target_calories: float,
        daily_consumed_calories: float,
        user_goal: str = GoalEnum.MAINTENANCE.value,
    ) -> Dict[str, Any]:
        insights: List[str] = []

        # 1. Caloric Budget Impact Analysis
        if remaining_calories > 0:
            if meal_calories <= remaining_calories:
                pct_of_remaining = round((meal_calories / remaining_calories) * 100)
                insights.append(
                    f"This meal fits comfortably within your remaining daily budget "
                    f"({pct_of_remaining}% of your remaining {int(round(remaining_calories))} kcal)."
                )
            else:
                overage = round(meal_calories - remaining_calories)
                insights.append(
                    f"This meal exceeds your remaining daily calorie budget by ~{int(overage)} kcal "
                    f"({int(round(meal_calories))} kcal vs {int(round(remaining_calories))} kcal remaining)."
                )
        else:
            insights.append(
                f"You have already met your estimated daily calorie target. "
                f"This meal adds ~{int(round(meal_calories))} kcal to your daily total."
            )

        # 2. Protein Density Assessment
        if meal_calories > 0:
            protein_cal_pct = (meal_protein * 4.0 / meal_calories) * 100.0
            if protein_cal_pct >= 25.0:
                insights.append(
                    f"High protein density ({round(protein_cal_pct, 1)}% of meal energy) — "
                    "excellent for muscle preservation and satiety."
                )
            elif protein_cal_pct >= 15.0:
                insights.append(
                    f"Moderate protein density ({round(protein_cal_pct, 1)}% of meal energy), "
                    f"providing {round(meal_protein, 1)}g of protein."
                )
            else:
                insights.append(
                    f"Lower protein density ({round(protein_cal_pct, 1)}% of meal energy). "
                    "Consider pairing with a protein-rich side like paneer, dal, curd, or grilled chicken."
                )

        # 3. Dietary Fiber Evaluation
        if meal_fiber >= 6.0:
            insights.append(
                f"Rich in dietary fiber ({round(meal_fiber, 1)}g), which supports digestive health and prolonged fullness."
            )
        elif meal_fiber >= 3.0:
            insights.append(
                f"Provides a beneficial {round(meal_fiber, 1)}g of dietary fiber towards your daily fiber goal."
            )
        else:
            insights.append(
                f"Contains modest dietary fiber ({round(meal_fiber, 1)}g). "
                "Adding a side salad or raw vegetables would boost the micronutrient and fiber balance."
            )

        # 4. Overall Fit Score / Recommendation Summary
        fits_budget = (remaining_calories <= 0 and meal_calories <= 300) or (meal_calories <= remaining_calories * 1.1)

        return {
            "meal_calories": round(meal_calories, 1),
            "remaining_calories_before_meal": round(remaining_calories, 1),
            "remaining_calories_after_meal": round(max(0.0, remaining_calories - meal_calories), 1),
            "fits_remaining_budget": fits_budget,
            "insights": insights,
        }
