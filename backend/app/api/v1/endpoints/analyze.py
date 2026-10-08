from fastapi import APIRouter, UploadFile, File, status
from app.schemas.analyze import FoodAnalysisResponse
from app.services.analysis_service import AnalysisService

router = APIRouter()


@router.post(
    "/analyze",
    response_model=FoodAnalysisResponse,
    status_code=status.HTTP_200_OK,
    tags=["Analysis"],
)
async def analyze_food_image(
    image: UploadFile = File(..., description="Uploaded food photograph (JPEG, PNG, or WEBP, max 10MB)"),
):
    """
    Accept a food image for multimodal AI vision analysis.
    
    Identifies visible food items, estimates conservative portion sizes, generates
    confidence scores, and documents visual uncertainties.
    
    Note: The AI strictly avoids calculating or hallucinating calorie/macro values.
    Nutrition calculation is deferred to the subsequent confirmation step.
    """
    return await AnalysisService.process_food_image(image)
