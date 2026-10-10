from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User, UserProfile
from app.core.security import get_current_user
from app.personalization.daily_tracking_service import DailyTrackingService
from app.personalization.meal_evaluation_service import MealEvaluationService
from app.analytics.service import WeeklyAnalyticsService
from app.schemas.daily_nutrition import (
    DailyNutritionResponse,
    WeeklyAnalyticsResponse,
    EvaluateMealRequest,
    EvaluateMealResponse,
)

router = APIRouter(prefix="/daily-nutrition", tags=["Daily Nutrition & Tracking"])


@router.get("", response_model=DailyNutritionResponse)
def get_daily_nutrition(
    target_date: Optional[date] = Query(None, description="Target date in YYYY-MM-DD format (defaults to today)"),
    tz_offset_minutes: int = Query(0, description="Client timezone offset in minutes: (UTC - Local)"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve aggregated nutrition for a given local date, comparing consumed totals
    against personalized targets and reporting remaining, overage, and 4-slot meal timeline.
    """
    service = DailyTrackingService(db)
    result = service.get_daily_nutrition(
        user_id=user.id, target_date=target_date, tz_offset_minutes=tz_offset_minutes
    )
    return result


@router.get("/weekly", response_model=WeeklyAnalyticsResponse)
def get_weekly_analytics(
    end_date: Optional[date] = Query(None, description="End date for the analytics window in YYYY-MM-DD format"),
    days: int = Query(7, ge=1, le=30, description="Number of days to inspect (default 7)"),
    tz_offset_minutes: int = Query(0, description="Client timezone offset in minutes: (UTC - Local)"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieve 7-day nutrition analytics and deterministic trend insights.
    Distinguishes unlogged days from zero-intake days, computes averages across logged days only,
    and returns period-over-period comparisons with factual summaries.
    """
    analytics_service = WeeklyAnalyticsService(db)
    try:
        result = analytics_service.get_weekly_analytics(
            user_id=user.id,
            end_date=end_date,
            days=days,
            tz_offset_minutes=tz_offset_minutes,
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


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
