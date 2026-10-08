from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.nutrition.provider import DatabaseNutritionProvider
from app.nutrition.calculation_service import (
    NutritionCalculationService,
    ConfirmedFoodItemInput,
    FoodNotFoundError,
)
from app.nutrition.portion_converter import (
    UnsupportedUnitError,
    InvalidPortionError,
)
from app.schemas.nutrition import (
    NutritionCalculationRequest,
    MealNutritionCalculationResponse,
    ItemNutritionCalculationResponse,
)
from app.schemas.food import FoodItemListResponse, FoodItemResponse
from app.services.food_service import FoodService

router = APIRouter(prefix="/nutrition", tags=["Nutrition Engine"])


@router.post(
    "/calculate",
    response_model=MealNutritionCalculationResponse,
    status_code=status.HTTP_200_OK,
    summary="Deterministically calculate nutritional macros for confirmed food items",
)
def calculate_nutrition(
    req: NutritionCalculationRequest, db: Session = Depends(get_db)
):
    """
    Deterministically computes composite macronutrients, Atwater energy distribution,
    and calibrated uncertainty margins for a set of confirmed food items.
    
    CRITICAL ARCHITECTURAL GUARANTEE:
    - This calculation is 100% deterministic and programmatic.
    - Zero LLM arithmetic or calorie guessing.
    - Units (g, ml, pieces, servings) are converted against verified database references.
    """
    provider = DatabaseNutritionProvider(db)
    service = NutritionCalculationService(provider)

    inputs = [
        ConfirmedFoodItemInput(
            food_id=item.food_id,
            food_name=item.food_name,
            portion_value=item.portion_value,
            portion_unit=item.portion_unit,
            is_exact_weight=item.is_exact_weight,
            confidence_score=item.confidence_score,
        )
        for item in req.items
    ]

    try:
        result = service.calculate_meal(inputs)
    except FoodNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
    except (UnsupportedUnitError, InvalidPortionError) as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Deterministic nutrition calculation encountered an error: {str(e)}",
        )

    # Convert dataclass result to pydantic response
    items_response = [
        ItemNutritionCalculationResponse(
            food_id=i.food_id,
            food_name=i.food_name,
            category=i.category,
            portion_value=i.portion_value,
            portion_unit=i.portion_unit,
            gram_weight=i.gram_weight,
            scaling_factor=i.scaling_factor,
            calories=i.calories,
            protein=i.protein,
            carbohydrates=i.carbohydrates,
            fat=i.fat,
            fiber=i.fiber,
            sugar=i.sugar,
            sodium=i.sodium,
            calorie_min=i.calorie_min,
            calorie_max=i.calorie_max,
            uncertainty_calories=i.uncertainty_calories,
            uncertainty_pct=i.uncertainty_pct,
            confidence_level=i.confidence_level,
            data_source=i.data_source,
            conversion_notes=i.conversion_notes,
        )
        for i in result.items
    ]

    return MealNutritionCalculationResponse(
        total_calories=result.total_calories,
        total_protein=result.total_protein,
        total_carbohydrates=result.total_carbohydrates,
        total_fat=result.total_fat,
        total_fiber=result.total_fiber,
        total_sugar=result.total_sugar,
        total_sodium=result.total_sodium,
        calorie_min=result.calorie_min,
        calorie_max=result.calorie_max,
        uncertainty_calories=result.uncertainty_calories,
        confidence_level=result.confidence_level,
        uncertainty_explanation=result.uncertainty_explanation,
        formatted_estimate=result.formatted_estimate,
        macro_distribution=result.macro_distribution,
        items=items_response,
    )


@router.get(
    "/foods",
    response_model=FoodItemListResponse,
    summary="Search verified nutrition database",
)
def list_or_search_nutrition_foods(
    q: Optional[str] = Query(None, description="Search by dish name or category"),
    category: Optional[str] = Query(None, description="Filter by dish category"),
    is_indian: Optional[bool] = Query(None, description="Filter for Indian regional cuisine"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Alias endpoint for querying verified food composition items."""
    service = FoodService(db)
    items, total = service.search_foods(
        query=q,
        category=category,
        is_indian=is_indian,
        skip=skip,
        limit=limit,
    )
    return FoodItemListResponse(
        total=total,
        items=[FoodItemResponse.model_validate(item) for item in items],
    )
