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
    Accept a food image for nutritional analysis.
    
    Phase 1 Note:
    Validates uploaded image and returns the structured analysis pipeline schema.
    Clearly marks AI vision detection as scheduled for Phase 2, strictly avoiding
    synthetic or fabricated calorie values.
    """
    return await AnalysisService.process_food_image(image)
