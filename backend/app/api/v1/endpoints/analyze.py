from fastapi import APIRouter, UploadFile, File, Request, status
from app.schemas.analyze import FoodAnalysisResponse
from app.services.analysis_service import AnalysisService
from app.core.rate_limit import analysis_rate_limiter, get_client_ip

router = APIRouter()


@router.post(
    "/analyze",
    response_model=FoodAnalysisResponse,
    status_code=status.HTTP_200_OK,
    tags=["Analysis"],
)
async def analyze_food_image(
    request: Request,
    image: UploadFile = File(..., description="Uploaded food photograph (JPEG, PNG, or WEBP, max 10MB)"),
):
    """
    Accept a food image for multimodal AI vision analysis.
    
    Identifies visible food items, estimates conservative portion sizes, generates
    confidence scores, and documents visual uncertainties.
    
    Protected by rate limiting against excessive AI consumption.
    Note: The AI strictly avoids calculating or hallucinating calorie/macro values.
    Nutrition calculation is deferred to the subsequent confirmation step.
    """
    client_ip = get_client_ip(request)
    analysis_rate_limiter.check_rate_limit(client_ip)

    return await AnalysisService.process_food_image(image)
