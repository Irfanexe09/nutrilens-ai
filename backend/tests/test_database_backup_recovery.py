import os
import sqlite3
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database.base import Base
from app.models.user import User, UserProfile, DailyNutritionTarget
from app.models.food import FoodItem
from app.models.meal import Meal
from app.models.meal_item import MealItem
from app.core.security import hash_password, verify_password
from app.services.food_service import FoodService


def test_disposable_database_backup_and_recovery_cycle(tmp_path):
    """
    Automated disaster recovery test performing a complete backup and restore cycle
    against disposable database instances without touching the development database.
    Verifies schema integrity, seed rows, user data, meals, and password verification.
    """
    # 1. Create primary disposable database file
    source_db_path = tmp_path / "source_disposable.db"
    backup_sql_path = tmp_path / "disposable_backup.sql"
    restored_db_path = tmp_path / "restored_disposable.db"

    source_engine = create_engine(f"sqlite:///{source_db_path}")
    SourceSession = sessionmaker(bind=source_engine)

    # 2. Initialize schema and seed data
    Base.metadata.create_all(bind=source_engine)
    source_session = SourceSession()

    food_service = FoodService(source_session)
    seeded_count = food_service.seed_database()
    assert seeded_count > 0

    # 3. Insert user, profile, target, and meal data into source
    user = User(
        email="recovery_tester@nutrilens.app",
        name="Recovery Tester",
        hashed_password=hash_password("RecoverySecurePassword123!"),
    )
    source_session.add(user)
    source_session.commit()
    source_session.refresh(user)

    meal = Meal(
        user_id=user.id,
        meal_type="lunch",
        notes="Pre-backup test meal",
        total_calories=520.0,
        total_protein=28.0,
        total_carbohydrates=60.0,
        total_fat=18.0,
        total_fiber=6.0,
        uncertainty_calories=35.0,
    )
    source_session.add(meal)
    source_session.commit()
    source_session.refresh(meal)

    meal_item = MealItem(
        meal_id=meal.id,
        food_name="Paneer Butter Masala",
        serving_count=1.0,
        serving_size=200.0,
        serving_unit="g",
        calories=520.0,
        protein=28.0,
        carbohydrates=60.0,
        fat=18.0,
        fiber=6.0,
        uncertainty_pct=8.0,
    )
    source_session.add(meal_item)
    source_session.commit()

    source_food_count = source_session.query(FoodItem).count()
    source_user_count = source_session.query(User).count()
    source_meal_count = source_session.query(Meal).count()
    source_session.close()
    source_engine.dispose()

    # 4. Perform complete backup dump of the disposable source database
    conn_src = sqlite3.connect(str(source_db_path))
    with open(str(backup_sql_path), "w", encoding="utf-8") as f:
        for line in conn_src.iterdump():
            f.write(f"{line}\n")
    conn_src.close()

    assert backup_sql_path.exists()
    assert backup_sql_path.stat().st_size > 0

    # 5. Restore the SQL backup into an entirely new disposable target database
    conn_dest = sqlite3.connect(str(restored_db_path))
    with open(str(backup_sql_path), "r", encoding="utf-8") as f:
        sql_script = f.read()
    conn_dest.executescript(sql_script)
    conn_dest.close()

    # 6. Verify restored database using SQLAlchemy engine
    restored_engine = create_engine(f"sqlite:///{restored_db_path}")
    RestoredSession = sessionmaker(bind=restored_engine)
    restored_session = RestoredSession()

    restored_food_count = restored_session.query(FoodItem).count()
    restored_user_count = restored_session.query(User).count()
    restored_meal_count = restored_session.query(Meal).count()

    assert restored_food_count == source_food_count
    assert restored_user_count == source_user_count
    assert restored_meal_count == source_meal_count

    restored_user = restored_session.query(User).filter(User.email == "recovery_tester@nutrilens.app").first()
    assert restored_user is not None
    assert restored_user.name == "Recovery Tester"
    assert verify_password("RecoverySecurePassword123!", restored_user.hashed_password) is True

    restored_meal = restored_session.query(Meal).filter(Meal.user_id == restored_user.id).first()
    assert restored_meal is not None
    assert restored_meal.notes == "Pre-backup test meal"
    assert restored_meal.total_calories == 520.0
    assert len(restored_meal.items) == 1
    assert restored_meal.items[0].food_name == "Paneer Butter Masala"

    restored_session.close()
    restored_engine.dispose()
