import os
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.food import FoodItem
from app.schemas.food import FoodItemCreate
from app.repositories.food_repository import FoodRepository


class FoodService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = FoodRepository()

    def get_food(self, food_id: int) -> Optional[FoodItem]:
        return self.repo.get_by_id(self.db, food_id)

    def search_foods(
        self,
        query: Optional[str] = None,
        category: Optional[str] = None,
        is_indian: Optional[bool] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[FoodItem], int]:
        return self.repo.search(
            self.db,
            query=query,
            category=category,
            is_indian=is_indian,
            skip=skip,
            limit=limit,
        )

    def create_food(self, food_in: FoodItemCreate) -> FoodItem:
        return self.repo.create(self.db, food_in)

    def seed_database(self, force_refresh: bool = False) -> int:
        """Finds seed file and populates initial items if empty or updates fields."""
        current_dir = os.path.dirname(os.path.abspath(__file__))
        candidate_paths = [
            # 1. Bundled inside backend/data (container runtime)
            os.path.join(os.path.dirname(os.path.dirname(current_dir)), "data", "nutrition", "indian_foods_seed.json"),
            # 2. Repo root data/nutrition (monorepo local development)
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(current_dir))), "data", "nutrition", "indian_foods_seed.json"),
            # 3. Standard container mount path
            "/app/data/nutrition/indian_foods_seed.json",
        ]
        seed_path = None
        for p in candidate_paths:
            if os.path.exists(p):
                seed_path = p
                break

        if not seed_path:
            return 0
        return self.repo.seed_initial_foods(self.db, seed_path, force_refresh=force_refresh)
