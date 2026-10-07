from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.services.food_service import FoodService
from app.schemas.food import (
    FoodItemResponse,
    FoodItemListResponse,
    FoodItemCreate,
)

router = APIRouter()


@router.get("/foods", response_model=FoodItemListResponse, tags=["Foods"])
def list_foods(
    q: Optional[str] = Query(None, description="Search query across food name, category, or local name"),
    category: Optional[str] = Query(None, description="Filter by category"),
    is_indian: Optional[bool] = Query(None, description="Filter by Indian cuisine dishes"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Retrieve food items from the nutrition database with search and category filtering."""
    service = FoodService(db)
    items, total = service.search_foods(
        query=q, category=category, is_indian=is_indian, skip=skip, limit=limit
    )
    return FoodItemListResponse(total=total, items=items)


@router.get("/foods/{food_id}", response_model=FoodItemResponse, tags=["Foods"])
def get_food(food_id: int, db: Session = Depends(get_db)):
    """Fetch details and deterministic macro breakdown for a specific food item."""
    service = FoodService(db)
    item = service.get_food(food_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Food item with id {food_id} not found",
        )
    return item


@router.post("/foods", response_model=FoodItemResponse, status_code=status.HTTP_201_CREATED, tags=["Foods"])
def create_food(food_in: FoodItemCreate, db: Session = Depends(get_db)):
    """Add a new verified food item to the nutrition database."""
    service = FoodService(db)
    return service.create_food(food_in)
