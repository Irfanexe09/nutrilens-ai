from typing import List, Optional
from pydantic import BaseModel, Field


class DailyTargetSummary(BaseModel):
    calorie_target: float
    protein_target_g: float
    carbohydrates_target_g: float
    fat_target_g: float
    fiber_target_g: float
    has_custom_target: bool
    safety_warning: Optional[str] = None
    disclaimer: str


class ConsumedSummary(BaseModel):
    calories: float
    protein_g: float
    carbohydrates_g: float
    fat_g: float
    fiber_g: float


class RemainingSummary(BaseModel):
    calories: float
    protein_g: float
    carbohydrates_g: float
    fat_g: float
    fiber_g: float


class OverageSummary(BaseModel):
    calories: float
    is_over_target: bool
    status_message: str


class PercentagesSummary(BaseModel):
    calories: float
    protein: float
    carbohydrates: float
    fat: float
    fiber: float


class DailyMealSummary(BaseModel):
    id: str
    meal_type: str
    image_url: Optional[str] = None
    created_at: Optional[str] = None
    calories: float
    protein: float
    carbohydrates: float
    fat: float
    fiber: float
    formatted_estimate: str
    item_count: int


class DailyNutritionResponse(BaseModel):
    date: str
    target: DailyTargetSummary
    consumed: ConsumedSummary
    remaining: RemainingSummary
    overage: OverageSummary
    percentages: PercentagesSummary
    meals: List[DailyMealSummary]
    meal_count: int


class EvaluateMealRequest(BaseModel):
    meal_calories: float = Field(..., ge=0)
    meal_protein: float = Field(..., ge=0)
    meal_carbs: float = Field(..., ge=0)
    meal_fat: float = Field(..., ge=0)
    meal_fiber: float = Field(0.0, ge=0)


class EvaluateMealResponse(BaseModel):
    meal_calories: float
    remaining_calories_before_meal: float
    remaining_calories_after_meal: float
    fits_remaining_budget: bool
    insights: List[str]
