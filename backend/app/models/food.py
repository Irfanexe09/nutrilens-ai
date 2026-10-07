from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from app.database.base import Base


class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(120), nullable=False, index=True)
    local_name = Column(String(120), nullable=True)  # Native script or alternate name
    category = Column(String(60), nullable=False, index=True)
    serving_size = Column(Float, nullable=False, default=100.0)
    serving_unit = Column(String(30), nullable=False, default="g")
    
    # Deterministic macro profile per serving
    calories = Column(Float, nullable=False)
    protein = Column(Float, nullable=False)
    carbohydrates = Column(Float, nullable=False)
    fat = Column(Float, nullable=False)
    fiber = Column(Float, nullable=False, default=0.0)
    sugar = Column(Float, nullable=False, default=0.0)
    sodium = Column(Float, nullable=False, default=0.0)  # in mg
    
    # Metadata
    is_indian_dish = Column(Boolean, default=True, index=True)
    uncertainty_pct = Column(Float, default=10.0)  # Standard recipe variance (e.g., ±10%)
    description = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    meal_items = relationship("MealItem", back_populates="food_item")
