"""
NutriLens Nutrition Data Provider Abstraction.

This abstraction decouples the deterministic nutrition calculation engine
from the underlying storage or data provider (SQLAlchemy/SQLite/Postgres,
USDA FoodData Central, ICMR-NIN IFCT API, Open Food Facts, etc.).
"""

from abc import ABC, abstractmethod
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.food import FoodItem


class NutritionDataProvider(ABC):
    """Abstract Base Class defining the contract for nutrition data providers."""

    @abstractmethod
    def get_food_by_id(self, food_id: int) -> Optional[FoodItem]:
        """Fetch food record by its unique identifier."""
        pass

    @abstractmethod
    def get_food_by_name(self, name: str) -> Optional[FoodItem]:
        """Fetch food record by name or common alias."""
        pass

    @abstractmethod
    def search_foods(
        self,
        query: Optional[str] = None,
        category: Optional[str] = None,
        is_indian: Optional[bool] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[FoodItem]:
        """Search foods by query and/or category."""
        pass


class DatabaseNutritionProvider(NutritionDataProvider):
    """
    Concrete implementation of NutritionDataProvider backed by the application database.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_food_by_id(self, food_id: int) -> Optional[FoodItem]:
        return self.db.query(FoodItem).filter(FoodItem.id == food_id).first()

    def get_food_by_name(self, name: str) -> Optional[FoodItem]:
        if not name:
            return None
        clean = name.strip()
        # 1. Exact case-insensitive match
        item = self.db.query(FoodItem).filter(FoodItem.name.ilike(clean)).first()
        if item:
            return item
        
        # 2. Substring matching
        item = (
            self.db.query(FoodItem)
            .filter(
                (FoodItem.name.ilike(f"%{clean}%"))
                | (FoodItem.local_name.ilike(f"%{clean}%"))
            )
            .first()
        )
        if item:
            return item

        # 3. Word-based reverse match (e.g. query "chicken biryani rice" matches "Chicken Biryani")
        words = clean.split()
        if len(words) > 1:
            for word in words:
                if len(word) >= 4:
                    candidate = self.db.query(FoodItem).filter(FoodItem.name.ilike(f"%{word}%")).first()
                    if candidate:
                        return candidate
        return None

    def search_foods(
        self,
        query: Optional[str] = None,
        category: Optional[str] = None,
        is_indian: Optional[bool] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[FoodItem]:
        from app.repositories.food_repository import FoodRepository
        items, _ = FoodRepository.search(
            self.db,
            query=query,
            category=category,
            is_indian=is_indian,
            skip=skip,
            limit=limit,
        )
        return items
