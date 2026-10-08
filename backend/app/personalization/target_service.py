from typing import Union, Optional
from dataclasses import dataclass
from app.personalization.enums import (
    SexEnum,
    ActivityLevelEnum,
    GoalEnum,
    GOAL_METADATA,
)
from app.personalization.bmr_service import BMRCalculator
from app.personalization.tdee_service import TDEECalculator


@dataclass
class CalculatedDailyTarget:
    bmr: float
    tdee: float
    calorie_target: float
    protein_target_g: float
    carbohydrates_target_g: float
    fat_target_g: float
    fiber_target_g: float
    safety_warning: Optional[str]
    disclaimer: str


class TargetCalculator:
    """
    Deterministic calculation engine for personalized caloric and macronutrient targets.
    Enforces internal caloric consistency and medical safety guardrails.
    """

    DISCLAIMER: str = (
        "Estimated daily target for informational and educational purposes only. "
        "Not a medical diagnosis or nutritional prescription."
    )

    @classmethod
    def calculate(
        cls,
        weight_kg: float,
        height_cm: float,
        age: int,
        sex: Union[str, SexEnum],
        activity_level: Union[str, ActivityLevelEnum],
        goal: Union[str, GoalEnum],
    ) -> CalculatedDailyTarget:
        # Validate and normalize sex
        if isinstance(sex, str):
            try:
                sex_enum = SexEnum(sex.upper())
            except ValueError:
                raise ValueError(f"Invalid sex: '{sex}'. Must be MALE or FEMALE.")
        else:
            sex_enum = sex

        # Validate and normalize activity level
        if isinstance(activity_level, str):
            try:
                activity_enum = ActivityLevelEnum(activity_level.upper())
            except ValueError:
                raise ValueError(f"Invalid activity level: '{activity_level}'.")
        else:
            activity_enum = activity_level

        # Validate and normalize goal
        if isinstance(goal, str):
            try:
                goal_enum = GoalEnum(goal.upper())
            except ValueError:
                raise ValueError(f"Invalid goal: '{goal}'.")
        else:
            goal_enum = goal

        # 1. Deterministic BMR (Mifflin-St Jeor)
        bmr = BMRCalculator.calculate(
            weight_kg=weight_kg,
            height_cm=height_cm,
            age=age,
            sex=sex_enum,
        )

        # 2. Deterministic TDEE
        tdee = TDEECalculator.calculate(
            bmr=bmr,
            activity_level=activity_enum,
        )

        # 3. Calorie Target based on Goal
        goal_info = GOAL_METADATA.get(goal_enum)
        if not goal_info:
            raise ValueError(f"Missing configuration for goal '{goal_enum}'")

        calorie_adjustment = goal_info["calorie_adjustment"]
        raw_calorie_target = tdee + calorie_adjustment
        # Ensure non-negative baseline
        calorie_target = max(500.0, raw_calorie_target)

        # 4. Protein Target (g/kg body weight)
        protein_per_kg = goal_info["protein_per_kg"]
        protein_target_g = round(weight_kg * protein_per_kg, 1)
        protein_calories = protein_target_g * 4.0

        # 5. Fat Target (25% of daily target calories)
        fat_calories = 0.25 * calorie_target
        fat_target_g = round(fat_calories / 9.0, 1)

        # 6. Carbohydrate Target (Remainder of target calories for caloric consistency)
        carbs_calories = calorie_target - protein_calories - fat_calories
        carbohydrates_target_g = round(max(0.0, carbs_calories / 4.0), 1)

        # 7. Fiber Target (14g per 1000 kcal target, min 25g)
        fiber_target_g = round(max(25.0, (calorie_target / 1000.0) * 14.0), 1)

        # 8. Clinical Safety Warning (Not replacing calculated value with medical prescription)
        safety_warning: Optional[str] = None
        if sex_enum == SexEnum.MALE and calorie_target < 1500.0:
            safety_warning = (
                f"Your calculated target of {int(round(calorie_target))} kcal is unusually low. "
                "For safety, adult males should generally not consume below 1,500 kcal without clinical supervision. "
                "Please consult a qualified healthcare professional rather than following an automated target."
            )
        elif sex_enum == SexEnum.FEMALE and calorie_target < 1200.0:
            safety_warning = (
                f"Your calculated target of {int(round(calorie_target))} kcal is unusually low. "
                "For safety, adult females should generally not consume below 1,200 kcal without clinical supervision. "
                "Please consult a qualified healthcare professional rather than following an automated target."
            )

        return CalculatedDailyTarget(
            bmr=round(bmr, 1),
            tdee=round(tdee, 1),
            calorie_target=round(calorie_target, 1),
            protein_target_g=protein_target_g,
            carbohydrates_target_g=carbohydrates_target_g,
            fat_target_g=fat_target_g,
            fiber_target_g=fiber_target_g,
            safety_warning=safety_warning,
            disclaimer=cls.DISCLAIMER,
        )
