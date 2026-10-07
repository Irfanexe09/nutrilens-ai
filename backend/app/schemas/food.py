from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


class FoodItemBase(BaseModel):
    name: str = Field(..., max_length=120)
    local_name: Optional[str] = Field(None, max_length=120)
    category: str = Field(..., max_length=60)
    serving_size: float = Field(..., gt=0)
    serving_unit: str = Field(..., max_length=30)
    calories: float = Field(..., ge=0)
    protein: float = Field(..., ge=0)
    carbohydrates: float = Field(..., ge=0)
    fat: float = Field(..., ge=0)
    fiber: float = Field(0.0, ge=0)
    sugar: float = Field(0.0, ge=0)
    sodium: float = Field(0.0, ge=0)
    is_indian_dish: bool = True
    uncertainty_pct: float = Field(10.0, ge=0, le=100)
    description: Optional[str] = None


class FoodItemCreate(FoodItemBase):
    pass


class FoodItemResponse(FoodItemBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class FoodItemListResponse(BaseModel):
    total: int
    items: List[FoodItemResponse]
