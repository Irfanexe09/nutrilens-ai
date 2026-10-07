from typing import List, Dict, Any
from app.ai.base import (
    AIProvider,
    AIAnalysisResult,
    DetectedItemCandidate,
    AIRecommendation,
)


class PlaceholderAIProvider(AIProvider):
    """
    Phase 1 AI Provider: Honest placeholder implementation.
    Strictly avoids fabricating fake AI detections or calorie numbers.
    Maintains the full interface contract ready for Phase 2 multimodal vision activation.
    """

    async def analyze_food_image(
        self, image_bytes: bytes, filename: str
    ) -> AIAnalysisResult:
        return AIAnalysisResult(
            status="pending",
            detected_foods=[],
            overall_confidence=None,
            recommendations=[],
            phase_notice=(
                "Multimodal AI Vision & automated food detection will be activated in Phase 2. "
                "The deterministic nutrition calculation engine and food database are fully active."
            ),
            processing_metadata={
                "filename": filename,
                "file_size_bytes": len(image_bytes),
                "phase": 1,
                "provider": "PlaceholderAIProvider",
            },
        )

    async def identify_food_items(
        self, image_bytes: bytes
    ) -> List[DetectedItemCandidate]:
        return []

    async def generate_meal_recommendations(
        self, meal_summary: Dict[str, Any], user_goal: str = "balanced"
    ) -> List[AIRecommendation]:
        return []
