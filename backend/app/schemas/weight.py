import datetime as dt
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class WeightEntryCreate(BaseModel):
    weight_kg: float = Field(..., gt=0, le=500, description="Body weight in kilograms")
    date: dt.date = Field(..., description="Date of measurement (YYYY-MM-DD)")
    notes: Optional[str] = Field(None, max_length=500, description="Optional personal notes")


class WeightEntryUpdate(BaseModel):
    weight_kg: Optional[float] = Field(None, gt=0, le=500, description="Body weight in kilograms")
    date: Optional[dt.date] = Field(None, description="Date of measurement (YYYY-MM-DD)")
    notes: Optional[str] = Field(None, max_length=500, description="Optional personal notes")


class WeightEntryResponse(BaseModel):
    id: str
    user_id: str
    weight_kg: float
    date: dt.date
    notes: Optional[str] = None
    created_at: Optional[dt.datetime] = None
    updated_at: Optional[dt.datetime] = None

    model_config = ConfigDict(from_attributes=True)


class WeightHistoryResponse(BaseModel):
    entries: List[WeightEntryResponse]
    total: int
    latest: Optional[WeightEntryResponse] = None
    change_kg: Optional[float] = None
    trend: Optional[str] = None  # "DECREASING", "INCREASING", "STABLE", or None
