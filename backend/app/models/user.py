import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.database.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    targets = relationship(
        "DailyNutritionTarget",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="DailyNutritionTarget.created_at.desc()",
    )
    meals = relationship("Meal", back_populates="user", cascade="all, delete-orphan")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    name = Column(String(100), nullable=True)
    age = Column(Integer, nullable=False)
    sex = Column(String(20), nullable=False)  # MALE, FEMALE
    height_cm = Column(Float, nullable=False)
    weight_kg = Column(Float, nullable=False)
    activity_level = Column(String(50), nullable=False)  # SEDENTARY, etc.
    goal = Column(String(50), nullable=False)  # WEIGHT_LOSS, etc.

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="profile")


class DailyNutritionTarget(Base):
    __tablename__ = "daily_nutrition_targets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    bmr = Column(Float, nullable=False)
    tdee = Column(Float, nullable=False)
    calorie_target = Column(Float, nullable=False)
    protein_target_g = Column(Float, nullable=False)
    carbohydrates_target_g = Column(Float, nullable=False)
    fat_target_g = Column(Float, nullable=False)
    fiber_target_g = Column(Float, nullable=False)
    safety_warning = Column(Text, nullable=True)
    disclaimer = Column(
        String(500),
        default="Estimated daily target for informational and educational purposes only. Not a medical diagnosis or nutritional prescription.",
        nullable=False,
    )
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="targets")
