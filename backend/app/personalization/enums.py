from enum import Enum
from typing import Dict, Any


class SexEnum(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"


class ActivityLevelEnum(str, Enum):
    SEDENTARY = "SEDENTARY"
    LIGHTLY_ACTIVE = "LIGHTLY_ACTIVE"
    MODERATELY_ACTIVE = "MODERATELY_ACTIVE"
    VERY_ACTIVE = "VERY_ACTIVE"
    EXTRA_ACTIVE = "EXTRA_ACTIVE"


class GoalEnum(str, Enum):
    WEIGHT_LOSS = "WEIGHT_LOSS"
    MAINTENANCE = "MAINTENANCE"
    WEIGHT_GAIN = "WEIGHT_GAIN"
    MUSCLE_GAIN = "MUSCLE_GAIN"
    GENERAL_HEALTH = "GENERAL_HEALTH"


ACTIVITY_MULTIPLIERS: Dict[ActivityLevelEnum, float] = {
    ActivityLevelEnum.SEDENTARY: 1.2,
    ActivityLevelEnum.LIGHTLY_ACTIVE: 1.375,
    ActivityLevelEnum.MODERATELY_ACTIVE: 1.55,
    ActivityLevelEnum.VERY_ACTIVE: 1.725,
    ActivityLevelEnum.EXTRA_ACTIVE: 1.9,
}

ACTIVITY_METADATA: Dict[ActivityLevelEnum, Dict[str, Any]] = {
    ActivityLevelEnum.SEDENTARY: {
        "label": "Sedentary",
        "description": "Little or no structured exercise",
        "multiplier": 1.2,
    },
    ActivityLevelEnum.LIGHTLY_ACTIVE: {
        "label": "Lightly Active",
        "description": "Light exercise 1–3 days/week",
        "multiplier": 1.375,
    },
    ActivityLevelEnum.MODERATELY_ACTIVE: {
        "label": "Moderately Active",
        "description": "Moderate exercise 3–5 days/week",
        "multiplier": 1.55,
    },
    ActivityLevelEnum.VERY_ACTIVE: {
        "label": "Very Active",
        "description": "Hard exercise 6–7 days/week",
        "multiplier": 1.725,
    },
    ActivityLevelEnum.EXTRA_ACTIVE: {
        "label": "Extra Active",
        "description": "Very demanding physical activity or physical job",
        "multiplier": 1.9,
    },
}

GOAL_METADATA: Dict[GoalEnum, Dict[str, Any]] = {
    GoalEnum.WEIGHT_LOSS: {
        "label": "Weight Loss",
        "description": "Sustainable caloric deficit with elevated protein protection",
        "calorie_adjustment": -400.0,
        "protein_per_kg": 1.4,
    },
    GoalEnum.MAINTENANCE: {
        "label": "Weight Maintenance",
        "description": "Energy balance to maintain stable weight and lean mass",
        "calorie_adjustment": 0.0,
        "protein_per_kg": 1.2,
    },
    GoalEnum.WEIGHT_GAIN: {
        "label": "Weight Gain",
        "description": "Controlled caloric surplus for progressive weight gain",
        "calorie_adjustment": 350.0,
        "protein_per_kg": 1.4,
    },
    GoalEnum.MUSCLE_GAIN: {
        "label": "Muscle Gain",
        "description": "Moderate surplus combined with high protein for hypertrophy",
        "calorie_adjustment": 250.0,
        "protein_per_kg": 1.8,
    },
    GoalEnum.GENERAL_HEALTH: {
        "label": "General Health",
        "description": "Nutrient-dense balanced nutrition for long-term health and vitality",
        "calorie_adjustment": 0.0,
        "protein_per_kg": 1.1,
    },
}
