from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    foods,
    meals,
    analyze,
    nutrition,
    auth,
    profile,
    daily_nutrition,
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(daily_nutrition.router)
api_router.include_router(foods.router)
api_router.include_router(meals.router)
api_router.include_router(analyze.router)
api_router.include_router(nutrition.router)
