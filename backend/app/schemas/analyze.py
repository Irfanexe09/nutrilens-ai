from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class EstimatedPortionSchema(BaseModel):
    value: float = Field(..., description="Estimated numeric portion quantity", ge=0)
    unit: str = Field(default="g", description="Unit of measurement (g, piece, bowl, cup)")
    display_text: Optional[str] = Field(None, description="Human readable display text, e.g. ~250 g")


class DetectedFoodSchema(BaseModel):
    name: str = Field(..., description="Identified food item name")
    estimated_portion: EstimatedPortionSchema = Field(..., description="Conservative estimated portion")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score (0.0 to 1.0)")
    description: Optional[str] = Field(None, description="Visual description of food appearance and ingredients")
    ingredients: List[str] = Field(default_factory=list, description="Visually identifiable components")
    uncertainties: List[str] = Field(default_factory=list, description="Specific uncertainties for this item")
    matched_food_id: Optional[int] = Field(None, description="Matched database food ID if matched")
    suggested_serving_size: Optional[float] = Field(None, description="Legacy serving size accessor")
    suggested_serving_unit: Optional[str] = Field(None, description="Legacy serving unit accessor")


# Alias for backwards compatibility
DetectedFoodItemSchema = DetectedFoodSchema


class FoodAnalysisData(BaseModel):
    foods: List[DetectedFoodSchema] = Field(default_factory=list, description="Structured detected food candidates")
    overall_confidence: float = Field(..., ge=0.0, le=1.0, description="Aggregate visual detection confidence")
    uncertainties: List[str] = Field(default_factory=list, description="Overall meal uncertainties")


class FoodAnalysisResponse(BaseModel):
    meal_id: str = Field(..., description="Unique ID generated for this analysis session")
    status: str = Field(default="success", description="Status: success, pending, or error")
    analysis: FoodAnalysisData = Field(..., description="Structured food identification and portion data")
    
    # Backwards-compatible accessors
    foods: List[DetectedFoodSchema] = Field(default_factory=list, description="Top-level food items list")
    overall_confidence: Optional[float] = Field(None, description="Top-level overall confidence")
    uncertainties: List[str] = Field(default_factory=list, description="Top-level uncertainties")
    
    notice: str = Field(
        default="Nutrition calculation will be available after confirmation.",
        description="Phase 2 transparency notice confirming calculations are deferred to confirmation phase."
    )
    image_metadata: Optional[Dict[str, Any]] = Field(None, description="Uploaded image file properties")
    provider: Optional[str] = Field(None, description="AI vision provider used")
    duration_ms: Optional[float] = Field(None, description="Analysis processing duration in milliseconds")
