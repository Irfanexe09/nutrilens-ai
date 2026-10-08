from typing import Union
from app.personalization.enums import SexEnum


class BMRCalculator:
    """
    Deterministic implementation of the Mifflin-St Jeor equation for Basal Metabolic Rate (BMR).
    All calculations are programmatic and deterministic.
    """

    @staticmethod
    def calculate(
        weight_kg: float,
        height_cm: float,
        age: int,
        sex: Union[str, SexEnum],
    ) -> float:
        """
        Calculates BMR in kcal/day.
        
        Mifflin-St Jeor formula:
        - Male:   10 * weight_kg + 6.25 * height_cm - 5 * age + 5
        - Female: 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
        """
        if weight_kg <= 0:
            raise ValueError("Weight must be greater than 0 kg")
        if height_cm <= 0:
            raise ValueError("Height must be greater than 0 cm")
        if age <= 0:
            raise ValueError("Age must be greater than 0 years")

        normalized_sex = sex.value if isinstance(sex, SexEnum) else str(sex).upper()

        base = (10.0 * float(weight_kg)) + (6.25 * float(height_cm)) - (5.0 * float(age))

        if normalized_sex == SexEnum.MALE.value:
            bmr = base + 5.0
        elif normalized_sex == SexEnum.FEMALE.value:
            bmr = base - 161.0
        else:
            raise ValueError(f"Unsupported sex '{sex}'. Must be MALE or FEMALE.")

        return round(bmr, 1)
