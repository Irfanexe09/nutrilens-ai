from datetime import date, datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models.meal import Meal
from app.models.user import DailyNutritionTarget
from app.analytics.date_utils import (
    get_utc_bounds_for_local_date,
    get_local_date_for_utc_datetime,
)
from app.schemas.daily_nutrition import (
    DayAnalyticsItem,
    PeriodComparisonSummary,
    WeeklyTrendInsights,
    WeeklyAnalyticsResponse,
)


class WeeklyAnalyticsService:
    """
    Deterministic analytics service for multi-day intake tracking and trend analysis.
    Performs single-range database aggregation, handles unlogged days explicitly,
    respects client local calendar dates, and avoids unsupported clinical conclusions.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_weekly_analytics(
        self,
        user_id: str,
        end_date: Optional[date] = None,
        days: int = 7,
        tz_offset_minutes: int = 0,
    ) -> WeeklyAnalyticsResponse:
        # Determine client's current local date
        client_now = datetime.now(timezone.utc) - timedelta(minutes=tz_offset_minutes)
        client_today = client_now.date()

        if end_date is None:
            end_date = client_today
        elif end_date > client_today:
            raise ValueError(
                f"Cannot query future dates. Latest supported date is today ({client_today.isoformat()})."
            )

        days = max(1, min(days, 30))
        start_date = end_date - timedelta(days=days - 1)
        date_list = [start_date + timedelta(days=i) for i in range(days)]

        # UTC boundaries for single efficient current period query
        start_utc_curr, _ = get_utc_bounds_for_local_date(start_date, tz_offset_minutes)
        _, end_utc_curr = get_utc_bounds_for_local_date(end_date, tz_offset_minutes)

        curr_meals = (
            self.db.query(Meal)
            .filter(
                Meal.user_id == user_id,
                Meal.created_at >= start_utc_curr,
                Meal.created_at <= end_utc_curr,
            )
            .order_by(Meal.created_at.asc())
            .all()
        )

        # UTC boundaries for single efficient previous period query
        prev_end_date = start_date - timedelta(days=1)
        prev_start_date = prev_end_date - timedelta(days=days - 1)
        start_utc_prev, _ = get_utc_bounds_for_local_date(prev_start_date, tz_offset_minutes)
        _, end_utc_prev = get_utc_bounds_for_local_date(prev_end_date, tz_offset_minutes)

        prev_meals = (
            self.db.query(Meal)
            .filter(
                Meal.user_id == user_id,
                Meal.created_at >= start_utc_prev,
                Meal.created_at <= end_utc_prev,
            )
            .all()
        )

        # Active user nutrition targets
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

        # Group current period meals by local calendar date
        meals_by_date: Dict[date, List[Meal]] = {d: [] for d in date_list}
        for m in curr_meals:
            if m.created_at:
                m_local = get_local_date_for_utc_datetime(m.created_at, tz_offset_minutes)
                if m_local in meals_by_date:
                    meals_by_date[m_local].append(m)

        # Construct DayAnalyticsItem list with explicit distinction between logged and unlogged days
        day_items: List[DayAnalyticsItem] = []
        for d in date_list:
            d_meals = meals_by_date[d]
            day_name = d.strftime("%a")

            if len(d_meals) == 0:
                # Explicit unlogged day representation (NOT zero food consumption)
                day_items.append(
                    DayAnalyticsItem(
                        date=d.isoformat(),
                        day_name=day_name,
                        has_logs=False,
                        data_completeness="UNLOGGED",
                        meal_count=0,
                        calories=None,
                        protein=None,
                        carbohydrates=None,
                        fat=None,
                        fiber=None,
                        calorie_target=round(target_cals, 1),
                        protein_target=round(target_pro, 1),
                        is_over_calorie_target=False,
                        overage_calories=0.0,
                        calorie_percentage=0.0,
                        protein_target_met=False,
                    )
                )
            else:
                cals = round(sum(m.total_calories for m in d_meals), 1)
                pro = round(sum(m.total_protein for m in d_meals), 1)
                carbs = round(sum(m.total_carbohydrates for m in d_meals), 1)
                fat = round(sum(m.total_fat for m in d_meals), 1)
                fib = round(sum(m.total_fiber for m in d_meals), 1)
                is_over = cals > target_cals
                overage = round(max(0.0, cals - target_cals), 1)
                pct = round((cals / target_cals * 100), 1) if target_cals > 0 else 0.0
                pro_met = pro >= target_pro
                completeness = "LOGGED" if len(d_meals) >= 3 else "PARTIAL"

                day_items.append(
                    DayAnalyticsItem(
                        date=d.isoformat(),
                        day_name=day_name,
                        has_logs=True,
                        data_completeness=completeness,
                        meal_count=len(d_meals),
                        calories=cals,
                        protein=pro,
                        carbohydrates=carbs,
                        fat=fat,
                        fiber=fib,
                        calorie_target=round(target_cals, 1),
                        protein_target=round(target_pro, 1),
                        is_over_calorie_target=is_over,
                        overage_calories=overage,
                        calorie_percentage=pct,
                        protein_target_met=pro_met,
                    )
                )

        # Filter logged days for deterministic trend calculations
        logged_days = [d for d in day_items if d.has_logs and d.calories is not None]
        logged_count = len(logged_days)

        if logged_count > 0:
            avg_cals = round(sum(d.calories for d in logged_days) / logged_count, 1)
            avg_pro = round(sum(d.protein for d in logged_days if d.protein is not None) / logged_count, 1)
            avg_carbs = round(sum(d.carbohydrates for d in logged_days if d.carbohydrates is not None) / logged_count, 1)
            avg_fat = round(sum(d.fat for d in logged_days if d.fat is not None) / logged_count, 1)
            avg_fib = round(sum(d.fiber for d in logged_days if d.fiber is not None) / logged_count, 1)
            pro_met_count = sum(1 for d in logged_days if d.protein_target_met)
            highest_day_obj = max(logged_days, key=lambda d: d.calories or 0)
            highest_day = {"date": highest_day_obj.date, "calories": highest_day_obj.calories}
            lowest_day_obj = min(logged_days, key=lambda d: d.calories or 0)
            lowest_day = {"date": lowest_day_obj.date, "calories": lowest_day_obj.calories}
        else:
            avg_cals = None
            avg_pro = None
            avg_carbs = None
            avg_fat = None
            avg_fib = None
            pro_met_count = 0
            highest_day = None
            lowest_day = None

        # Previous period comparison
        prev_dates_with_meals: Dict[date, List[Meal]] = {}
        for m in prev_meals:
            if m.created_at:
                m_local = get_local_date_for_utc_datetime(m.created_at, tz_offset_minutes)
                prev_dates_with_meals.setdefault(m_local, []).append(m)

        prev_logged_days_count = len(prev_dates_with_meals)
        if prev_logged_days_count >= 1 and avg_cals is not None:
            prev_total_cals = sum(m.total_calories for m in prev_meals)
            prev_avg_cals = round(prev_total_cals / prev_logged_days_count, 1)
            diff_cals = round(avg_cals - prev_avg_cals, 1)
            pct_change = round((diff_cals / prev_avg_cals) * 100, 1) if prev_avg_cals > 0 else 0.0
            msg = (
                f"Average daily intake changed by {diff_cals:+g} kcal ({pct_change:+g}%) "
                f"compared to previous {days}-day period (across logged days)."
            )
            period_comparison = PeriodComparisonSummary(
                has_comparison=True,
                prev_period_logged_days=prev_logged_days_count,
                prev_period_average_calories=prev_avg_cals,
                calorie_difference=diff_cals,
                percent_change=pct_change,
                message=msg,
            )
        else:
            period_comparison = PeriodComparisonSummary(
                has_comparison=False,
                prev_period_logged_days=prev_logged_days_count,
                prev_period_average_calories=None,
                calorie_difference=None,
                percent_change=None,
                message="Insufficient prior period meal data for trend comparison.",
            )

        # Build factual insight statements
        insights_statements: List[str] = [
            f"Logged meals on {logged_count} of {days} days."
        ]
        if logged_count > 0:
            plural = "s" if logged_count != 1 else ""
            insights_statements.append(
                f"Average intake across {logged_count} logged day{plural}: {int(round(avg_cals))} kcal/day (Target: {int(round(target_cals))} kcal)."
            )
            insights_statements.append(
                f"Protein target was reached on {pro_met_count} of {logged_count} logged day{plural}."
            )
            if highest_day and lowest_day and highest_day["date"] != lowest_day["date"]:
                insights_statements.append(
                    f"Highest intake: {int(round(highest_day['calories']))} kcal ({highest_day['date']}); "
                    f"Lowest: {int(round(lowest_day['calories']))} kcal ({lowest_day['date']})."
                )
            if period_comparison.has_comparison and period_comparison.message:
                insights_statements.append(period_comparison.message)
        else:
            insights_statements.append(
                "No meals logged during this period. Log meals consistently to observe personal nutrition trends."
            )

        insights_obj = WeeklyTrendInsights(
            logged_days_count=logged_count,
            total_days=days,
            average_calories_logged_days=avg_cals,
            average_protein_logged_days=avg_pro,
            average_carbs_logged_days=avg_carbs,
            average_fat_logged_days=avg_fat,
            average_fiber_logged_days=avg_fib,
            protein_target_met_days=pro_met_count,
            highest_calorie_day=highest_day,
            lowest_calorie_day=lowest_day,
            previous_period_comparison=period_comparison,
            insights_statements=insights_statements,
        )

        return WeeklyAnalyticsResponse(
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat(),
            days=day_items,
            insights=insights_obj,
        )
