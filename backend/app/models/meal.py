import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, Text
from sqlalchemy.orm import relationship
from app.database.base import Base


class Meal(Base):
    __tablename__ = "meals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(64), nullable=True, index=True)  # Cleanly nullable for Phase 1
    image_url = Column(String(500), nullable=True)
    image_filename = Column(String(255), nullable=True)
    
    # State tracking: 'pending', 'analyzed', 'confirmed'
    status = Column(String(32), default="pending", nullable=False, index=True)
    meal_type = Column(String(32), nullable=True)  # breakfast, lunch, dinner, snack
    
    # Aggregated deterministic totals
    total_calories = Column(Float, default=0.0, nullable=False)
    total_protein = Column(Float, default=0.0, nullable=False)
    total_carbohydrates = Column(Float, default=0.0, nullable=False)
    total_fat = Column(Float, default=0.0, nullable=False)
    total_fiber = Column(Float, default=0.0, nullable=False)
    total_sugar = Column(Float, default=0.0, nullable=False)
    total_sodium = Column(Float, default=0.0, nullable=False)
    uncertainty_calories = Column(Float, default=0.0, nullable=False)  # e.g., ±45 kcal
    confidence_level = Column(String(32), default="MEDIUM", nullable=False)
    
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    items = relationship("MealItem", back_populates="meal", cascade="all, delete-orphan", lazy="joined")
