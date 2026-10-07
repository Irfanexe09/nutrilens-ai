from fastapi import APIRouter
from app.api.v1.endpoints import health, foods, meals, analyze

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(foods.router)
api_router.include_router(meals.router)
api_router.include_router(analyze.router)
