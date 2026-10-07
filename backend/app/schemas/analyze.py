from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.meal import NutritionBreakdownResponse


class DetectedFoodItemSchema(BaseModel):
    name: str
    confidence: float
    matched_food_id: Optional[int] = None
    suggested_serving_size: Optional[float] = None
    suggested_serving_unit: Optional[str] = None
    bounding_box: Optional[List[float]] = None


class FoodAnalysisResponse(BaseModel):
    meal_id: str = Field(..., description="Unique ID generated for this analysis session")
    status: str = Field(..., description="Analysis status: pending, completed, or placeholder")
    foods: List[DetectedFoodItemSchema] = Field(default_factory=list, description="AI detected food items")
    nutrition: Optional[NutritionBreakdownResponse] = Field(None, description="Calculated meal nutrition")
    confidence: Optional[float] = Field(None, description="Overall detection confidence score")
    recommendations: List[str] = Field(default_factory=list, description="Personalized meal recommendations")
    notice: str = Field(
        default="AI multimodal vision analysis is scheduled for Phase 2. Deterministic nutrition calculation engine is active.",
        description="Clarification to avoid synthetic/fake AI claims."
    )
    image_metadata: Optional[Dict[str, Any]] = Field(None, description="Uploaded image file properties")
