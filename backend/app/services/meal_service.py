from datetime import date
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.meal import Meal
from app.schemas.meal import (
    MealCreate,
    MealItemCreate,
    NutritionBreakdownResponse,
)
from app.repositories.meal_repository import MealRepository
from app.repositories.food_repository import FoodRepository
from app.nutrition.engine import (
    NutritionEngine,
    ItemNutritionalInput,
    MealNutritionSummary,
)


class MealService:
    def __init__(self, db: Session):
        self.db = db
        self.meal_repo = MealRepository()
        self.food_repo = FoodRepository()

    def _convert_to_engine_inputs(
        self, items: List[MealItemCreate]
    ) -> List[ItemNutritionalInput]:
        inputs: List[ItemNutritionalInput] = []
        for item in items:
            # If item references an existing food_id, use its database verified base macros
            base_cal = item.calories
            base_pro = item.protein
            base_carb = item.carbohydrates
            base_fat = item.fat
            base_fib = item.fiber
            base_sug = getattr(item, "sugar", 0.0)
            base_sod = getattr(item, "sodium", 0.0)
            uncert = item.uncertainty_pct

            if item.food_id:
                db_food = self.food_repo.get_by_id(self.db, item.food_id)
                if db_food:
                    base_cal = db_food.calories
                    base_pro = db_food.protein
                    base_carb = db_food.carbohydrates
                    base_fat = db_food.fat
                    base_fib = db_food.fiber
                    base_sug = db_food.sugar
                    base_sod = db_food.sodium
                    uncert = db_food.uncertainty_pct

            inputs.append(
                ItemNutritionalInput(
                    food_name=item.food_name,
                    serving_count=item.serving_count,
                    base_serving_size=item.serving_size,
                    base_serving_unit=item.serving_unit,
                    base_calories=base_cal,
                    base_protein=base_pro,
                    base_carbohydrates=base_carb,
                    base_fat=base_fat,
                    base_fiber=base_fib,
                    base_sugar=base_sug,
                    base_sodium=base_sod,
                    uncertainty_pct=uncert,
                )
            )
        return inputs

    def calculate_nutrition(
        self, items: List[MealItemCreate]
    ) -> NutritionBreakdownResponse:
        inputs = self._convert_to_engine_inputs(items)
        summary: MealNutritionSummary = NutritionEngine.calculate_meal(inputs)
        return NutritionBreakdownResponse(
            total_calories=summary.total_calories,
            total_protein=summary.total_protein,
            total_carbohydrates=summary.total_carbohydrates,
            total_fat=summary.total_fat,
            total_fiber=summary.total_fiber,
            total_sugar=getattr(summary, "total_sugar", 0.0),
            total_sodium=getattr(summary, "total_sodium", 0.0),
            calorie_min=summary.calorie_min,
            calorie_max=summary.calorie_max,
            uncertainty_calories=summary.uncertainty_calories,
            confidence_level=getattr(summary, "confidence_level", "MEDIUM"),
            uncertainty_explanation=getattr(summary, "uncertainty_explanation", None),
            formatted_estimate=summary.formatted_estimate,
            macro_distribution=summary.macro_distribution,
        )

    def create_meal(
        self, meal_in: MealCreate, image_filename: Optional[str] = None
    ) -> Meal:
        inputs = self._convert_to_engine_inputs(meal_in.items)
        summary = NutritionEngine.calculate_meal(inputs)
        return self.meal_repo.create(
            self.db, meal_in, summary, image_filename=image_filename
        )

    def get_meal(self, meal_id: str) -> Optional[Meal]:
        return self.meal_repo.get_by_id(self.db, meal_id)

    def list_meals(
        self,
        skip: int = 0,
        limit: int = 20,
        user_id: Optional[str] = None,
        guest_only: bool = False,
        meal_type: Optional[str] = None,
        target_date: Optional[date] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        is_optimized_version: Optional[bool] = None,
        tz_offset_minutes: int = 0,
    ) -> Tuple[List[Meal], int]:
        return self.meal_repo.list_meals(
            self.db,
            skip=skip,
            limit=limit,
            user_id=user_id,
            guest_only=guest_only,
            meal_type=meal_type,
            target_date=target_date,
            start_date=start_date,
            end_date=end_date,
            is_optimized_version=is_optimized_version,
            tz_offset_minutes=tz_offset_minutes,
        )
