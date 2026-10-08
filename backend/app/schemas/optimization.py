import uuid
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field
from app.optimizer.enums import MealIssueEnum, ModificationTypeEnum


class MealModification(BaseModel):
    type: ModificationTypeEnum
    food_id: Optional[int] = None
    food_name: str
    original_portion: Optional[float] = None
    new_portion: Optional[float] = None
    unit: str = "g"
    percentage: Optional[float] = None
    reason: str


class NutritionSnapshot(BaseModel):
    calories: float
    protein: float
    carbohydrates: float
    fat: float
    fiber: float
    sugar: float = 0.0
    sodium: float = 0.0
    calorie_min: float = 0.0
    calorie_max: float = 0.0
    uncertainty_calories: float = 0.0
    confidence_level: str = "MEDIUM"
    formatted_estimate: str


class CandidateItemSchema(BaseModel):
    food_id: Optional[int] = None
    food_name: str
    portion_value: float
    portion_unit: str = "g"
    calories: float
    protein: float
    carbohydrates: float
    fat: float
    fiber: float = 0.0
    sugar: float = 0.0
    sodium: float = 0.0
    confidence_score: Optional[float] = None
    uncertainty_pct: float = 10.0


class OptimizationRecommendation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    changes: List[str]
    modifications: List[MealModification]
    original_nutrition: NutritionSnapshot
    optimized_nutrition: NutritionSnapshot
    calorie_delta: float
    protein_delta: float
    fiber_delta: float
    score: float
    confidence: str = "MEDIUM"
    explanation: str
    items: List[CandidateItemSchema]


class MealOptimizationResponse(BaseModel):
    meal_id: str
    goal: str
    issues: List[MealIssueEnum]
    status_summary: str
    recommendations: List[OptimizationRecommendation]


class ApplyOptimizationRequest(BaseModel):
    recommendation_id: Optional[str] = None
    notes: Optional[str] = None
    items: List[CandidateItemSchema]
