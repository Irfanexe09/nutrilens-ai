from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.meal_service import MealService
from app.schemas.meal import (
    MealCreate,
    MealResponse,
    MealListResponse,
    CalculateMealRequest,
    NutritionBreakdownResponse,
)

router = APIRouter()


@router.post("/meals", response_model=MealResponse, status_code=status.HTTP_201_CREATED, tags=["Meals"])
def create_meal(meal_in: MealCreate, db: Session = Depends(get_db)):
    """
    Save a confirmed meal with deterministically calculated nutritional totals
    and honest uncertainty intervals.
    """
    service = MealService(db)
    meal = service.create_meal(meal_in)
    
    # Enrich with formatted estimate
    formatted = f"Estimated: ~{int(round(meal.total_calories))} kcal (±{int(round(meal.uncertainty_calories))} kcal)"
    response_data = MealResponse.model_validate(meal)
    response_data.formatted_estimate = formatted
    return response_data


@router.get("/meals/{meal_id}", response_model=MealResponse, tags=["Meals"])
def get_meal(meal_id: str, db: Session = Depends(get_db)):
    """Retrieve an analyzed or saved meal by its ID."""
    service = MealService(db)
    meal = service.get_meal(meal_id)
    if not meal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Meal with ID '{meal_id}' not found",
        )
    formatted = f"Estimated: ~{int(round(meal.total_calories))} kcal (±{int(round(meal.uncertainty_calories))} kcal)"
    response_data = MealResponse.model_validate(meal)
    response_data.formatted_estimate = formatted
    return response_data


@router.get("/meals", response_model=MealListResponse, tags=["Meals"])
def list_meals(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """List recorded meals with pagination."""
    service = MealService(db)
    meals, total = service.list_meals(skip=skip, limit=limit)
    
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
