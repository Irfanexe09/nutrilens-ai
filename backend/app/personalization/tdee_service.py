from typing import Union
from app.personalization.enums import ActivityLevelEnum, ACTIVITY_MULTIPLIERS


class TDEECalculator:
    """
    Deterministic implementation of Total Daily Energy Expenditure (TDEE).
    Multiplies BMR by the standardized physical activity level coefficient.
    """

    @staticmethod
    def calculate(
        bmr: float,
        activity_level: Union[str, ActivityLevelEnum],
    ) -> float:
        """
        Calculates TDEE in kcal/day.
        TDEE = BMR * activity_multiplier
        """
        if bmr <= 0:
            raise ValueError("BMR must be greater than 0 kcal")

        if isinstance(activity_level, str):
            try:
                activity_enum = ActivityLevelEnum(activity_level.upper())
            except ValueError:
                raise ValueError(
                    f"Unsupported activity level '{activity_level}'. "
                    f"Allowed values: {[e.value for e in ActivityLevelEnum]}"
                )
        else:
            activity_enum = activity_level

        multiplier = ACTIVITY_MULTIPLIERS.get(activity_enum)
        if multiplier is None:
            raise ValueError(f"No multiplier found for activity level '{activity_level}'")

        tdee = float(bmr) * multiplier
        return round(tdee, 1)
