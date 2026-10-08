from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User, UserProfile
from app.core.security import get_current_user
from app.personalization.daily_tracking_service import DailyTrackingService
from app.personalization.meal_evaluation_service import MealEvaluationService
from app.schemas.daily_nutrition import (
    DailyNutritionResponse,
    EvaluateMealRequest,
    EvaluateMealResponse,
)

router = APIRouter(prefix="/daily-nutrition", tags=["Daily Nutrition & Tracking"])


@router.get("", response_model=DailyNutritionResponse)
def get_daily_nutrition(
    target_date: Optional[date] = Query(None, description="Optional target date in YYYY-MM-DD format (defaults to today)"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve aggregated nutrition for a given date, comparing consumed totals
    against personalized targets and reporting remaining / overage metrics.
    """
    service = DailyTrackingService(db)
    result = service.get_daily_nutrition(user_id=user.id, target_date=target_date)
    return result


@router.post("/evaluate-meal", response_model=EvaluateMealResponse)
def evaluate_meal(
    req: EvaluateMealRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Deterministically evaluates a candidate meal's fit against remaining daily budget,
    protein density, and dietary fiber goals.
    """
    service = DailyTrackingService(db)
    daily_data = service.get_daily_nutrition(user_id=user.id)
    
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    goal = profile.goal if profile else "MAINTENANCE"

    remaining_cals = daily_data["remaining"]["calories"]
    target_cals = daily_data["target"]["calorie_target"]
    consumed_cals = daily_data["consumed"]["calories"]

    evaluation = MealEvaluationService.evaluate(
        meal_calories=req.meal_calories,
        meal_protein=req.meal_protein,
        meal_carbs=req.meal_carbs,
        meal_fat=req.meal_fat,
        meal_fiber=req.meal_fiber,
        remaining_calories=remaining_cals,
        target_calories=target_cals,
        daily_consumed_calories=consumed_cals,
        user_goal=goal,
    )
    return evaluation
