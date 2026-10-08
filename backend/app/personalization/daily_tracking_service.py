from datetime import date, datetime, time, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.meal import Meal
from app.models.user import DailyNutritionTarget, UserProfile


class DailyTrackingService:
    """
    Service responsible for aggregating consumed nutrition across all meals recorded
    on a specific date and comparing totals deterministically against the user's daily target.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_daily_nutrition(
        self,
        user_id: str,
        target_date: Optional[date] = None,
    ) -> Dict[str, Any]:
        if target_date is None:
            target_date = datetime.now(timezone.utc).date()

        # Date boundaries for the query
        start_dt = datetime.combine(target_date, time.min)
        end_dt = datetime.combine(target_date, time.max)

        # Retrieve all user's meals logged for this target date
        meals = (
            self.db.query(Meal)
            .filter(
                Meal.user_id == user_id,
                Meal.created_at >= start_dt,
                Meal.created_at <= end_dt,
            )
            .order_by(Meal.created_at.asc())
            .all()
        )

        # Sum consumed nutrition
        consumed_calories = sum(m.total_calories for m in meals)
        consumed_protein = sum(m.total_protein for m in meals)
        consumed_carbs = sum(m.total_carbohydrates for m in meals)
        consumed_fat = sum(m.total_fat for m in meals)
        consumed_fiber = sum(m.total_fiber for m in meals)

        # Retrieve active target for user
        active_target = (
            self.db.query(DailyNutritionTarget)
            .filter(
                DailyNutritionTarget.user_id == user_id,
                DailyNutritionTarget.is_active.is_(True),
            )
            .order_by(DailyNutritionTarget.created_at.desc())
            .first()
        )

        target_cals = active_target.calorie_target if active_target else 2000.0
        target_pro = active_target.protein_target_g if active_target else 100.0
        target_carbs = active_target.carbohydrates_target_g if active_target else 250.0
        target_fat = active_target.fat_target_g if active_target else 65.0
        target_fib = active_target.fiber_target_g if active_target else 28.0

        # Remaining and Overage calculations
        remaining_calories = max(0.0, target_cals - consumed_calories)
        overage_calories = max(0.0, consumed_calories - target_cals)
        is_over_calories = consumed_calories > target_cals

        if is_over_calories:
            calorie_status = f"+{int(round(overage_calories))} kcal over target"
        else:
            calorie_status = f"{int(round(remaining_calories))} kcal remaining"

        calorie_pct = round((consumed_calories / target_cals * 100), 1) if target_cals > 0 else 0.0
        protein_pct = round((consumed_protein / target_pro * 100), 1) if target_pro > 0 else 0.0
        carbs_pct = round((consumed_carbs / target_carbs * 100), 1) if target_carbs > 0 else 0.0
        fat_pct = round((consumed_fat / target_fat * 100), 1) if target_fat > 0 else 0.0
        fiber_pct = round((consumed_fiber / target_fib * 100), 1) if target_fib > 0 else 0.0

        formatted_meals = []
        for m in meals:
            formatted_meals.append({
                "id": m.id,
                "meal_type": m.meal_type or "meal",
                "image_url": m.image_url,
                "created_at": m.created_at.isoformat() if m.created_at else None,
                "calories": round(m.total_calories, 1),
                "protein": round(m.total_protein, 1),
                "carbohydrates": round(m.total_carbohydrates, 1),
                "fat": round(m.total_fat, 1),
                "fiber": round(m.total_fiber, 1),
                "formatted_estimate": f"Estimated: ~{int(round(m.total_calories))} kcal (±{int(round(m.uncertainty_calories))} kcal)",
                "item_count": len(m.items),
            })

        return {
            "date": target_date.isoformat(),
            "target": {
                "calorie_target": round(target_cals, 1),
                "protein_target_g": round(target_pro, 1),
                "carbohydrates_target_g": round(target_carbs, 1),
                "fat_target_g": round(target_fat, 1),
                "fiber_target_g": round(target_fib, 1),
                "has_custom_target": active_target is not None,
                "safety_warning": active_target.safety_warning if active_target else None,
                "disclaimer": active_target.disclaimer if active_target else "Estimated daily target for informational purposes only.",
            },
            "consumed": {
                "calories": round(consumed_calories, 1),
                "protein_g": round(consumed_protein, 1),
                "carbohydrates_g": round(consumed_carbs, 1),
                "fat_g": round(consumed_fat, 1),
                "fiber_g": round(consumed_fiber, 1),
            },
            "remaining": {
                "calories": round(remaining_calories, 1),
                "protein_g": round(max(0.0, target_pro - consumed_protein), 1),
                "carbohydrates_g": round(max(0.0, target_carbs - consumed_carbs), 1),
                "fat_g": round(max(0.0, target_fat - consumed_fat), 1),
                "fiber_g": round(max(0.0, target_fib - consumed_fiber), 1),
            },
            "overage": {
                "calories": round(overage_calories, 1),
                "is_over_target": is_over_calories,
                "status_message": calorie_status,
            },
            "percentages": {
                "calories": calorie_pct,
                "protein": protein_pct,
                "carbohydrates": carbs_pct,
                "fat": fat_pct,
                "fiber": fiber_pct,
            },
            "meals": formatted_meals,
            "meal_count": len(meals),
        }
