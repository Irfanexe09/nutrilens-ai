from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.core.security import get_current_user_optional
from app.optimizer.service import MealOptimizationService
from app.schemas.optimization import MealOptimizationResponse, ApplyOptimizationRequest
from app.schemas.meal import MealResponse

router = APIRouter(prefix="/meals", tags=["Meal Optimizer"])


@router.post("/{meal_id}/optimize", response_model=MealOptimizationResponse)
async def optimize_meal(
    meal_id: str,
    goal: Optional[str] = Query(None, description="Optional target goal override (e.g. WEIGHT_LOSS, MUSCLE_GAIN)"),
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Analyzes an existing meal against the user's nutritional goals and remaining daily budget.
    Deterministically computes candidate modifications with honest uncertainty intervals.
    """
    user_id = current_user.id if current_user else None
    service = MealOptimizationService(db)
    return await service.optimize_meal(meal_id=meal_id, current_user_id=user_id, override_goal=goal)


@router.post(
    "/{meal_id}/apply-optimization",
    response_model=MealResponse,
    status_code=status.HTTP_201_CREATED,
)
def apply_optimization(
    meal_id: str,
    req: ApplyOptimizationRequest,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Applies an optimization suggestion by persisting a NEW versioned meal record
    with parent linkage, preserving the original meal intact for an auditable history.
    """
    user_id = current_user.id if current_user else None
    service = MealOptimizationService(db)
    new_meal = service.apply_optimization(meal_id=meal_id, request=req, current_user_id=user_id)

    formatted = f"Estimated: ~{int(round(new_meal.total_calories))} kcal (±{int(round(new_meal.uncertainty_calories))} kcal)"
    response_data = MealResponse.model_validate(new_meal)
    response_data.formatted_estimate = formatted
    return response_data
