from typing import List, Dict, Any, Optional
from app.optimizer.enums import MealIssueEnum


class MealIssueAnalyzer:
    """
    Deterministic rule-based analyzer identifying measurable nutritional imbalances.
    Uses objective thresholds rather than ambiguous 'healthy/unhealthy' labeling.
    """

    @staticmethod
    def identify_issues(
        meal_calories: float,
        meal_protein: float,
        meal_carbs: float,
        meal_fat: float,
        meal_fiber: float,
        meal_sodium: float = 0.0,
        meal_sugar: float = 0.0,
        daily_target_calories: float = 2000.0,
        remaining_calories: float = 1200.0,
        goal: str = "MAINTENANCE",
    ) -> List[MealIssueEnum]:
        issues: List[MealIssueEnum] = []
        goal_upper = str(goal).upper()

        # 1. High Calorie Density / Budget Depletion
        # Checks whether this meal heavily exhausts or exceeds the user's remaining daily allowance
        if meal_calories > remaining_calories and remaining_calories > 0:
            issues.append(MealIssueEnum.HIGH_CALORIE)
        elif remaining_calories > 0 and (meal_calories / remaining_calories) > 0.65:
            issues.append(MealIssueEnum.HIGH_CALORIE)
        elif goal_upper == "WEIGHT_LOSS" and meal_calories > 700.0:
            if MealIssueEnum.HIGH_CALORIE not in issues:
                issues.append(MealIssueEnum.HIGH_CALORIE)

        # 2. Low Protein Content relative to energy and goal
        if meal_calories >= 250.0:
            protein_cal_pct = (meal_protein * 4.0 / meal_calories) if meal_calories > 0 else 0.0
            if protein_cal_pct < 0.15:
                issues.append(MealIssueEnum.LOW_PROTEIN)
            elif meal_calories >= 400.0 and meal_protein < 18.0:
                if MealIssueEnum.LOW_PROTEIN not in issues:
                    issues.append(MealIssueEnum.LOW_PROTEIN)
            elif goal_upper in ("MUSCLE_GAIN", "WEIGHT_LOSS") and meal_protein < 22.0:
                if MealIssueEnum.LOW_PROTEIN not in issues:
                    issues.append(MealIssueEnum.LOW_PROTEIN)

        # 3. Low Dietary Fiber Contribution
        if meal_calories >= 300.0 and meal_fiber < 3.0:
            issues.append(MealIssueEnum.LOW_FIBER)

        # 4. Disproportionately High Fat Content
        if meal_calories >= 250.0:
            fat_cal_pct = (meal_fat * 9.0 / meal_calories) if meal_calories > 0 else 0.0
            if fat_cal_pct > 0.40:
                issues.append(MealIssueEnum.HIGH_FAT)

        # 5. High Sodium Burden
        if meal_sodium >= 800.0:
            issues.append(MealIssueEnum.HIGH_SODIUM)

        # 6. High Simple Sugar Content
        if meal_sugar >= 20.0:
            issues.append(MealIssueEnum.HIGH_SUGAR)

        return issues
