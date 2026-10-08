from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base


class MealItem(Base):
    __tablename__ = "meal_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    meal_id = Column(String(36), ForeignKey("meals.id", ondelete="CASCADE"), nullable=False, index=True)
    food_id = Column(Integer, ForeignKey("food_items.id"), nullable=True)
    
    food_name = Column(String(120), nullable=False)
    serving_count = Column(Float, default=1.0, nullable=False)
    serving_size = Column(Float, nullable=False)
    serving_unit = Column(String(30), nullable=False)
    gram_weight = Column(Float, nullable=True)  # Normalized weight in grams
    
    # Calculated deterministic values for this portion
    calories = Column(Float, nullable=False)
    protein = Column(Float, nullable=False)
    carbohydrates = Column(Float, nullable=False)
    fat = Column(Float, nullable=False)
    fiber = Column(Float, nullable=False, default=0.0)
    sugar = Column(Float, nullable=False, default=0.0)
    sodium = Column(Float, nullable=False, default=0.0)
    
    # Uncertainty and detection confidence
    confidence_score = Column(Float, nullable=True)  # Detection confidence (e.g. 0.94)
    uncertainty_pct = Column(Float, default=10.0)   # Cooked recipe variation (e.g. 10%)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    meal = relationship("Meal", back_populates="items")
    food_item = relationship("FoodItem", back_populates="meal_items")
