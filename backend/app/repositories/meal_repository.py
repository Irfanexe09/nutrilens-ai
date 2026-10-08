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
        db: Session, skip: int = 0, limit: int = 20, user_id: Optional[str] = None
    ) -> Tuple[List[Meal], int]:
        query = db.query(Meal)
        if user_id is not None:
            query = query.filter(Meal.user_id == user_id)
        total = query.count()
        meals = (
            query
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
            total_sugar=getattr(summary, "total_sugar", 0.0),
            total_sodium=getattr(summary, "total_sodium", 0.0),
            uncertainty_calories=summary.uncertainty_calories,
            confidence_level=getattr(summary, "confidence_level", "MEDIUM"),
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
                gram_weight=getattr(calculated, "gram_weight", getattr(item_data, "gram_weight", None)),
                calories=calculated.calories,
                protein=calculated.protein,
                carbohydrates=calculated.carbohydrates,
                fat=calculated.fat,
                fiber=calculated.fiber,
                sugar=getattr(calculated, "sugar", getattr(item_data, "sugar", 0.0)),
                sodium=getattr(calculated, "sodium", getattr(item_data, "sodium", 0.0)),
                confidence_score=item_data.confidence_score,
                uncertainty_pct=calculated.uncertainty_pct,
            )
            db.add(db_item)

        db.commit()
        db.refresh(db_meal)
        return db_meal
