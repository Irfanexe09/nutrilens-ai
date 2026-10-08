from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from app.database.base import Base


class FoodItem(Base):
    __tablename__ = "food_items"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(120), nullable=False, index=True)
    local_name = Column(String(120), nullable=True)  # Native script / alternate name
    category = Column(String(60), nullable=False, index=True)
    
    # Reference serving base
    serving_size = Column(Float, nullable=False, default=100.0)
    serving_unit = Column(String(30), nullable=False, default="g")
    piece_weight_g = Column(Float, nullable=True)  # Weight in grams for 1 piece, if applicable
    density_g_per_ml = Column(Float, default=1.0)  # Density factor for ml conversions
    allowed_units = Column(String(120), default="g,serving")  # Comma-separated valid units
    
    # Deterministic macro profile per reference serving
    calories = Column(Float, nullable=False)
    protein = Column(Float, nullable=False)
    carbohydrates = Column(Float, nullable=False)
    fat = Column(Float, nullable=False)
    fiber = Column(Float, nullable=False, default=0.0)
    sugar = Column(Float, nullable=False, default=0.0)
    sodium = Column(Float, nullable=False, default=0.0)  # in mg
    
    # Metadata & Provenance
    is_indian_dish = Column(Boolean, default=True, index=True)
    uncertainty_pct = Column(Float, default=10.0)  # Standard recipe variance (e.g., ±10%)
    description = Column(Text, nullable=True)
    data_source = Column(String(120), default="ICMR-NIN IFCT & USDA FoodData Central")
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    meal_items = relationship("MealItem", back_populates="food_item")

    # Property aliases for protein_g, carbohydrates_g, etc.
    @property
    def protein_g(self) -> float:
        return self.protein

    @protein_g.setter
    def protein_g(self, val: float):
        if val is not None:
            self.protein = val

    @property
    def carbohydrates_g(self) -> float:
        return self.carbohydrates

    @carbohydrates_g.setter
    def carbohydrates_g(self, val: float):
        if val is not None:
            self.carbohydrates = val

    @property
    def fat_g(self) -> float:
        return self.fat

    @fat_g.setter
    def fat_g(self, val: float):
        if val is not None:
            self.fat = val

    @property
    def fiber_g(self) -> float:
        return self.fiber

    @fiber_g.setter
    def fiber_g(self, val: float):
        if val is not None:
            self.fiber = val

    @property
    def sugar_g(self) -> float:
        return self.sugar

    @sugar_g.setter
    def sugar_g(self, val: float):
        if val is not None:
            self.sugar = val

    @property
    def sodium_mg(self) -> float:
        return self.sodium

    @sodium_mg.setter
    def sodium_mg(self, val: float):
        if val is not None:
            self.sodium = val

