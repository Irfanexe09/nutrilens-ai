from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.meal import Meal
from app.models.meal_item import MealItem
from app.schemas.meal import MealCreate
from app.nutrition.engine import MealNutritionSummary


class MealRepository:
    """Repository handling database operations for meals and meal items."""

    @staticmethod
    def get_by_id(db: Session, meal_id: str) -> Optional[Meal]:
        return db.query(Meal).filter(Meal.id == meal_id).first()

    @staticmethod
    def list_meals(
        db: Session, skip: int = 0, limit: int = 20
    ) -> Tuple[List[Meal], int]:
        total = db.query(Meal).count()
        meals = (
            db.query(Meal)
            .order_by(Meal.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return meals, total

    @staticmethod
    def create(
        db: Session,
        meal_in: MealCreate,
        summary: MealNutritionSummary,
        image_filename: Optional[str] = None,
    ) -> Meal:
        db_meal = Meal(
            user_id=meal_in.user_id,
            image_url=meal_in.image_url,
            image_filename=image_filename,
            status="confirmed" if meal_in.items else "pending",
            meal_type=meal_in.meal_type or "lunch",
            total_calories=summary.total_calories,
            total_protein=summary.total_protein,
            total_carbohydrates=summary.total_carbohydrates,
            total_fat=summary.total_fat,
            total_fiber=summary.total_fiber,
            uncertainty_calories=summary.uncertainty_calories,
            notes=meal_in.notes,
        )
        db.add(db_meal)
        db.flush()  # Generate meal id

        for item_data, calculated in zip(meal_in.items, summary.items):
            db_item = MealItem(
                meal_id=db_meal.id,
                food_id=item_data.food_id,
                food_name=item_data.food_name,
                serving_count=calculated.serving_count,
                serving_size=calculated.serving_size,
                serving_unit=calculated.serving_unit,
                calories=calculated.calories,
                protein=calculated.protein,
                carbohydrates=calculated.carbohydrates,
                fat=calculated.fat,
                fiber=calculated.fiber,
                confidence_score=item_data.confidence_score,
                uncertainty_pct=calculated.uncertainty_pct,
            )
            db.add(db_item)

        db.commit()
        db.refresh(db_meal)
        return db_meal
