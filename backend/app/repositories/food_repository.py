import os
import json
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.food import FoodItem
from app.schemas.food import FoodItemCreate


class FoodRepository:
    """Repository handling database queries and seed persistence for Food items."""

    @staticmethod
    def get_by_id(db: Session, food_id: int) -> Optional[FoodItem]:
        return db.query(FoodItem).filter(FoodItem.id == food_id).first()

    @staticmethod
    def get_by_name(db: Session, name: str) -> Optional[FoodItem]:
        return db.query(FoodItem).filter(FoodItem.name.ilike(name.strip())).first()

    @staticmethod
    def search(
        db: Session,
        query: Optional[str] = None,
        category: Optional[str] = None,
        is_indian: Optional[bool] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> Tuple[List[FoodItem], int]:
        q = db.query(FoodItem)
        if query:
            clean = f"%{query.strip()}%"
            q = q.filter(
                or_(
                    FoodItem.name.ilike(clean),
                    FoodItem.local_name.ilike(clean),
                    FoodItem.category.ilike(clean),
                )
            )
        if category:
            q = q.filter(FoodItem.category == category)
        if is_indian is not None:
            q = q.filter(FoodItem.is_indian_dish == is_indian)

        total = q.count()
        items = q.order_by(FoodItem.name.asc()).offset(skip).limit(limit).all()
        return items, total

    @staticmethod
    def create(db: Session, food_in: FoodItemCreate) -> FoodItem:
        db_item = FoodItem(**food_in.model_dump())
        db.add(db_item)
        db.commit()
        db.refresh(db_item)
        return db_item

    @staticmethod
    def seed_initial_foods(db: Session, seed_file_path: str) -> int:
        """Seeds food database with initial data if table is empty."""
        if db.query(FoodItem).count() > 0:
            return 0

        if not os.path.exists(seed_file_path):
            return 0

        with open(seed_file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        added = 0
        for item in data:
            db_item = FoodItem(
                name=item["name"],
                local_name=item.get("local_name"),
                category=item["category"],
                serving_size=float(item["serving_size"]),
                serving_unit=item["serving_unit"],
                calories=float(item["calories"]),
                protein=float(item["protein"]),
                carbohydrates=float(item["carbohydrates"]),
                fat=float(item["fat"]),
                fiber=float(item.get("fiber", 0.0)),
                sugar=float(item.get("sugar", 0.0)),
                sodium=float(item.get("sodium", 0.0)),
                is_indian_dish=item.get("is_indian_dish", True),
                uncertainty_pct=float(item.get("uncertainty_pct", 10.0)),
                description=item.get("description"),
            )
            db.add(db_item)
            added += 1

        db.commit()
        return added
