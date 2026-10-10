from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.meal_service import MealService
from app.models.user import User
from app.core.security import get_current_user_optional
from app.schemas.meal import (
    MealCreate,
    MealResponse,
    MealListResponse,
    CalculateMealRequest,
    NutritionBreakdownResponse,
)

router = APIRouter()


@router.post("/meals", response_model=MealResponse, status_code=status.HTTP_201_CREATED, tags=["Meals"])
def create_meal(
    meal_in: MealCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Save a confirmed meal with deterministically calculated nutritional totals
    and honest uncertainty intervals. Attaches authenticated user identity if logged in.
    """
    if current_user:
        meal_in.user_id = current_user.id
    else:
        meal_in.user_id = None

    service = MealService(db)
    meal = service.create_meal(meal_in)
    
    # Enrich with formatted estimate
    formatted = f"Estimated: ~{int(round(meal.total_calories))} kcal (±{int(round(meal.uncertainty_calories))} kcal)"
    response_data = MealResponse.model_validate(meal)
    response_data.formatted_estimate = formatted
    return response_data


@router.get("/meals/{meal_id}", response_model=MealResponse, tags=["Meals"])
def get_meal(
    meal_id: str,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Retrieve an analyzed or saved meal by its ID with user authorization check."""
    service = MealService(db)
    meal = service.get_meal(meal_id)
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meal with ID '{meal_id}' not found",
        )

    # User isolation: If meal has an owner, verify requester authentication and ownership
    if meal.user_id is not None:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required to access this meal",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if meal.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this meal",
            )

    formatted = f"Estimated: ~{int(round(meal.total_calories))} kcal (±{int(round(meal.uncertainty_calories))} kcal)"
    response_data = MealResponse.model_validate(meal)
    response_data.formatted_estimate = formatted
    return response_data


@router.get("/meals", response_model=MealListResponse, tags=["Meals"])
def list_meals(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    meal_type: Optional[str] = Query(None, description="Filter by meal type: breakfast, lunch, dinner, snack"),
    date_filter: Optional[date] = Query(None, alias="date", description="Filter for specific local date"),
    start_date: Optional[date] = Query(None, description="Start date for range filter"),
    end_date: Optional[date] = Query(None, description="End date for range filter"),
    is_optimized_version: Optional[bool] = Query(None, description="Filter optimized versions or original meals"),
    tz_offset_minutes: int = Query(0, description="Client timezone offset in minutes"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """List recorded meals with pagination and history filters, isolated by user if authenticated."""
    service = MealService(db)
    user_id = current_user.id if current_user else None
    guest_only = current_user is None
    meals, total = service.list_meals(
        skip=skip,
        limit=limit,
        user_id=user_id,
        guest_only=guest_only,
        meal_type=meal_type,
        target_date=date_filter,
        start_date=start_date,
        end_date=end_date,
        is_optimized_version=is_optimized_version,
        tz_offset_minutes=tz_offset_minutes,
    )
    
    enriched_meals = []
    for m in meals:
        formatted = f"Estimated: ~{int(round(m.total_calories))} kcal (±{int(round(m.uncertainty_calories))} kcal)"
        mr = MealResponse.model_validate(m)
        mr.formatted_estimate = formatted
        enriched_meals.append(mr)

    return MealListResponse(total=total, meals=enriched_meals)


@router.post("/meals/calculate", response_model=NutritionBreakdownResponse, tags=["Meals"])
def calculate_meal_preview(req: CalculateMealRequest, db: Session = Depends(get_db)):
    """
    Deterministically calculates composite macros, energy distribution,
    and honest uncertainty bounds for a set of meal items without persisting.
    """
    service = MealService(db)
    return service.calculate_nutrition(req.items)
