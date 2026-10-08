from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class NutritionCalculationItemRequest(BaseModel):
    food_id: Optional[int] = None
    food_name: str = Field(..., min_length=1, max_length=120)
    portion_value: float = Field(..., gt=0, description="Numerical quantity (> 0)")
    portion_unit: str = Field("g", min_length=1, max_length=30, description="Unit (g, ml, piece, serving, etc.)")
    is_exact_weight: bool = Field(False, description="True if weighed exactly on scale; False if visual estimate")
    confidence_score: Optional[float] = Field(None, ge=0, le=1.0)


class NutritionCalculationRequest(BaseModel):
    items: List[NutritionCalculationItemRequest] = Field(..., min_length=1)


class ItemNutritionCalculationResponse(BaseModel):
    food_id: Optional[int] = None
    food_name: str
    category: str
    portion_value: float
    portion_unit: str
    gram_weight: float
    scaling_factor: float
    calories: float
    protein: float
    carbohydrates: float
    fat: float
    fiber: float
    sugar: float
    sodium: float
    calorie_min: float
    calorie_max: float
    uncertainty_calories: float
    uncertainty_pct: float
    confidence_level: str
    data_source: str
    conversion_notes: str


class MealNutritionCalculationResponse(BaseModel):
    total_calories: float
    total_protein: float
    total_carbohydrates: float
    total_fat: float
    total_fiber: float
    total_sugar: float
    total_sodium: float
    calorie_min: float
    calorie_max: float
    uncertainty_calories: float
    confidence_level: str
    uncertainty_explanation: str
    formatted_estimate: str
    macro_distribution: Dict[str, float]
    items: List[ItemNutritionCalculationResponse]
