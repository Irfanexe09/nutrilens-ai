from datetime import date, datetime, timezone
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.weight_entry import WeightEntry
from app.models.user import UserProfile, DailyNutritionTarget
from app.schemas.weight import WeightEntryCreate, WeightEntryUpdate
from app.personalization.target_service import TargetCalculator


class WeightService:
    def __init__(self, db: Session):
        self.db = db

    def _sync_profile_and_targets(self, user_id: str):
        """Update UserProfile.weight_kg and active DailyNutritionTarget from the latest weight entry."""
        latest_entry = (
            self.db.query(WeightEntry)
            .filter(WeightEntry.user_id == user_id)
            .order_by(desc(WeightEntry.date), desc(WeightEntry.created_at))
            .first()
        )
        if not latest_entry:
            return

        profile = self.db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
        if not profile:
            return

        # Update profile weight
        profile.weight_kg = latest_entry.weight_kg
        profile.updated_at = datetime.now(timezone.utc)

        # Recalculate targets
        try:
            calc = TargetCalculator.calculate(
                weight_kg=profile.weight_kg,
                height_cm=profile.height_cm,
                age=profile.age,
                sex=profile.sex,
                activity_level=profile.activity_level,
                goal=profile.goal,
            )

            # Deactivate older targets
            self.db.query(DailyNutritionTarget).filter(
                DailyNutritionTarget.user_id == user_id,
                DailyNutritionTarget.is_active.is_(True),
            ).update({"is_active": False})

            # Create new active target
            new_target = DailyNutritionTarget(
                user_id=user_id,
                bmr=calc.bmr,
                tdee=calc.tdee,
                calorie_target=calc.calorie_target,
                protein_target_g=calc.protein_target_g,
                carbohydrates_target_g=calc.carbohydrates_target_g,
                fat_target_g=calc.fat_target_g,
                fiber_target_g=calc.fiber_target_g,
                safety_warning=calc.safety_warning,
                disclaimer=calc.disclaimer,
                is_active=True,
            )
            self.db.add(new_target)
        except Exception:
            # If target recalculation encounters partial profile, leave target untouched
            pass

    def create_entry(self, user_id: str, entry_in: WeightEntryCreate) -> WeightEntry:
        entry = WeightEntry(
            user_id=user_id,
            weight_kg=round(entry_in.weight_kg, 2),
            date=entry_in.date,
            notes=entry_in.notes,
        )
        self.db.add(entry)
        self.db.flush()

        # Check if this new entry is the latest entry
        self._sync_profile_and_targets(user_id)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def list_entries(
        self,
        user_id: str,
        skip: int = 0,
        limit: int = 50,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Tuple[List[WeightEntry], int, Optional[WeightEntry], Optional[float], Optional[str]]:
        query = self.db.query(WeightEntry).filter(WeightEntry.user_id == user_id)
        if start_date:
            query = query.filter(WeightEntry.date >= start_date)
        if end_date:
            query = query.filter(WeightEntry.date <= end_date)

        total = query.count()
        entries = (
            query.order_by(desc(WeightEntry.date), desc(WeightEntry.created_at))
            .offset(skip)
            .limit(limit)
            .all()
        )

        latest = entries[0] if entries else None

        # Calculate trend if we have at least 2 entries
        change_kg: Optional[float] = None
        trend: Optional[str] = None
        if len(entries) >= 2:
            newest = entries[0].weight_kg
            oldest = entries[-1].weight_kg
            diff = round(newest - oldest, 2)
            change_kg = diff
            if diff < -0.2:
                trend = "DECREASING"
            elif diff > 0.2:
                trend = "INCREASING"
            else:
                trend = "STABLE"

        return entries, total, latest, change_kg, trend

    def get_entry(self, user_id: str, entry_id: str) -> Optional[WeightEntry]:
        return (
            self.db.query(WeightEntry)
            .filter(WeightEntry.id == entry_id, WeightEntry.user_id == user_id)
            .first()
        )

    def update_entry(
        self, user_id: str, entry_id: str, update_in: WeightEntryUpdate
    ) -> Optional[WeightEntry]:
        entry = self.get_entry(user_id, entry_id)
        if not entry:
            return None

        if update_in.weight_kg is not None:
            entry.weight_kg = round(update_in.weight_kg, 2)
        if update_in.date is not None:
            entry.date = update_in.date
        if update_in.notes is not None:
            entry.notes = update_in.notes

        entry.updated_at = datetime.now(timezone.utc)
        self.db.flush()

        self._sync_profile_and_targets(user_id)
        self.db.commit()
        self.db.refresh(entry)
        return entry

    def delete_entry(self, user_id: str, entry_id: str) -> bool:
        entry = self.get_entry(user_id, entry_id)
        if not entry:
            return False

        self.db.delete(entry)
        self.db.flush()

        self._sync_profile_and_targets(user_id)
        self.db.commit()
        return True
