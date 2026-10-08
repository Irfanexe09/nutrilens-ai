from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, computed_field


class FoodItemBase(BaseModel):
    name: str = Field(..., max_length=120)
    local_name: Optional[str] = Field(None, max_length=120)
    category: str = Field(..., max_length=60)
    serving_size: float = Field(100.0, gt=0)
    serving_unit: str = Field("g", max_length=30)
    piece_weight_g: Optional[float] = Field(None, ge=0)
    density_g_per_ml: Optional[float] = Field(1.0, ge=0)
    allowed_units: Optional[str] = Field("g,serving", max_length=120)
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
    data_source: Optional[str] = "ICMR-NIN IFCT 2017 & USDA FoodData Central"

    @computed_field
    @property
    def protein_g(self) -> float:
        return self.protein

    @computed_field
    @property
    def carbohydrates_g(self) -> float:
        return self.carbohydrates

    @computed_field
    @property
    def fat_g(self) -> float:
        return self.fat

    @computed_field
    @property
    def fiber_g(self) -> float:
        return self.fiber

    @computed_field
    @property
    def sugar_g(self) -> float:
        return self.sugar

    @computed_field
    @property
    def sodium_mg(self) -> float:
        return self.sodium


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
