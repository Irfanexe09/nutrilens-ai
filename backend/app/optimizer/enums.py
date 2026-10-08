from enum import Enum


class MealIssueEnum(str, Enum):
    """
    Measurable, deterministic nutritional imbalances identified in a meal.
    Avoids subjective 'good/bad' classification in favor of objective nutritional flags.
    """
    HIGH_CALORIE = "HIGH_CALORIE"
    LOW_PROTEIN = "LOW_PROTEIN"
    LOW_FIBER = "LOW_FIBER"
    HIGH_FAT = "HIGH_FAT"
    HIGH_SODIUM = "HIGH_SODIUM"
    HIGH_SUGAR = "HIGH_SUGAR"


class ModificationTypeEnum(str, Enum):
    """
    Validated candidate modification action types.
    """
    REDUCE_PORTION = "REDUCE_PORTION"
    INCREASE_PORTION = "INCREASE_PORTION"
    ADD_FOOD = "ADD_FOOD"
    REMOVE_FOOD = "REMOVE_FOOD"
    REPLACE_FOOD = "REPLACE_FOOD"
