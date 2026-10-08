from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.personalization.enums import SexEnum, ActivityLevelEnum, GoalEnum


class ProfileBase(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    age: int = Field(..., ge=10, le=120, description="Age in years (10-120)")
    sex: SexEnum
    height_cm: float = Field(..., ge=50, le=280, description="Height in centimeters (50-280)")
    weight_kg: float = Field(..., ge=20, le=400, description="Weight in kilograms (20-400)")
    activity_level: ActivityLevelEnum
    goal: GoalEnum


class ProfileCreate(ProfileBase):
    pass


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = Field(None, ge=10, le=120)
    sex: Optional[SexEnum] = None
    height_cm: Optional[float] = Field(None, ge=50, le=280)
    weight_kg: Optional[float] = Field(None, ge=20, le=400)
    activity_level: Optional[ActivityLevelEnum] = None
    goal: Optional[GoalEnum] = None


class ProfileResponse(ProfileBase):
    id: str
    user_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class DailyTargetResponse(BaseModel):
    bmr: float
    tdee: float
    calorie_target: float
    protein_target_g: float
    carbohydrates_target_g: float
    fat_target_g: float
    fiber_target_g: float
    safety_warning: Optional[str] = None
    disclaimer: str
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class ProfileWithTargetResponse(BaseModel):
    profile: ProfileResponse
    targets: DailyTargetResponse
