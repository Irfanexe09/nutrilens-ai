from typing import List, Optional, Dict, Any
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
    time_logged: Optional[str] = None
    calories: float
    protein: float
    carbohydrates: float
    fat: float
    fiber: float
    formatted_estimate: str
    item_count: int
    food_names: List[str] = Field(default_factory=list)
    parent_meal_id: Optional[str] = None
    is_optimized_version: bool = False
    optimization_notes: Optional[str] = None
    notes: Optional[str] = None


class DailyNutritionResponse(BaseModel):
    date: str
    target: DailyTargetSummary
    consumed: ConsumedSummary
    remaining: RemainingSummary
    overage: OverageSummary
    percentages: PercentagesSummary
    meals: List[DailyMealSummary]
    meal_count: int
    data_completeness: str = "UNLOGGED"  # UNLOGGED, PARTIAL, LOGGED
    timeline: Optional[Dict[str, List[DailyMealSummary]]] = None


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


# ==========================================
# Phase 6: Weekly Analytics & Trends Schemas
# ==========================================

class DayAnalyticsItem(BaseModel):
    date: str
    day_name: str  # Mon, Tue, etc.
    has_logs: bool
    data_completeness: str  # UNLOGGED, PARTIAL, LOGGED
    meal_count: int
    calories: Optional[float] = None
    protein: Optional[float] = None
    carbohydrates: Optional[float] = None
    fat: Optional[float] = None
    fiber: Optional[float] = None
    calorie_target: float
    protein_target: float
    is_over_calorie_target: bool = False
    overage_calories: float = 0.0
    calorie_percentage: float = 0.0
    protein_target_met: bool = False


class PeriodComparisonSummary(BaseModel):
    has_comparison: bool
    prev_period_logged_days: int
    prev_period_average_calories: Optional[float] = None
    calorie_difference: Optional[float] = None
    percent_change: Optional[float] = None
    message: Optional[str] = None


class WeeklyTrendInsights(BaseModel):
    logged_days_count: int
    total_days: int = 7
    average_calories_logged_days: Optional[float] = None
    average_protein_logged_days: Optional[float] = None
    average_carbs_logged_days: Optional[float] = None
    average_fat_logged_days: Optional[float] = None
    average_fiber_logged_days: Optional[float] = None
    protein_target_met_days: int = 0
    highest_calorie_day: Optional[Dict[str, Any]] = None
    lowest_calorie_day: Optional[Dict[str, Any]] = None
    previous_period_comparison: Optional[PeriodComparisonSummary] = None
    insights_statements: List[str] = Field(default_factory=list)
    disclaimer: str = (
        "Trend statistics reflect recorded meals only and do not establish unlogged consumption or clinical body weight changes."
    )


class WeeklyAnalyticsResponse(BaseModel):
    start_date: str
    end_date: str
    days: List[DayAnalyticsItem]
    insights: WeeklyTrendInsights
