from datetime import datetime
from typing import List, Optional, Dict
from pydantic import BaseModel, ConfigDict, Field


class MealItemBase(BaseModel):
    food_id: Optional[int] = None
    food_name: str = Field(..., max_length=120)
    serving_count: float = Field(1.0, gt=0)
    serving_size: float = Field(..., gt=0)
    serving_unit: str = Field(..., max_length=30)
    gram_weight: Optional[float] = Field(None, ge=0)
    calories: float = Field(..., ge=0)
    protein: float = Field(..., ge=0)
    carbohydrates: float = Field(..., ge=0)
    fat: float = Field(..., ge=0)
    fiber: float = Field(0.0, ge=0)
    sugar: float = Field(0.0, ge=0)
    sodium: float = Field(0.0, ge=0)
    confidence_score: Optional[float] = Field(None, ge=0, le=1.0)
    uncertainty_pct: float = Field(10.0, ge=0, le=100)


class MealItemCreate(MealItemBase):
    pass


class MealItemResponse(MealItemBase):
    id: int
    meal_id: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class MealBase(BaseModel):
    user_id: Optional[str] = None
    image_url: Optional[str] = None
    meal_type: Optional[str] = Field("lunch", max_length=32)
    notes: Optional[str] = None


class MealCreate(MealBase):
    items: List[MealItemCreate] = []


class NutritionBreakdownResponse(BaseModel):
    total_calories: float
    total_protein: float
    total_carbohydrates: float
    total_fat: float
    total_fiber: float
    total_sugar: float = 0.0
    total_sodium: float = 0.0
    calorie_min: float
    calorie_max: float
    uncertainty_calories: float
    confidence_level: str = "MEDIUM"
    uncertainty_explanation: Optional[str] = None
    formatted_estimate: str
    macro_distribution: Dict[str, float]


class MealResponse(MealBase):
    id: str
    status: str
    total_calories: float
    total_protein: float
    total_carbohydrates: float
    total_fat: float
    total_fiber: float
    total_sugar: float = 0.0
    total_sodium: float = 0.0
    uncertainty_calories: float
    confidence_level: Optional[str] = "MEDIUM"
    formatted_estimate: Optional[str] = None
    parent_meal_id: Optional[str] = None
    is_optimized_version: bool = False
    optimization_notes: Optional[str] = None
    items: List[MealItemResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class MealListResponse(BaseModel):
    total: int
    meals: List[MealResponse]


class CalculateMealRequest(BaseModel):
    items: List[MealItemCreate]
