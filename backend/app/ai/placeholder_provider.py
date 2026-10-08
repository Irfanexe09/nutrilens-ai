import time
from typing import List, Dict, Any
from app.ai.base import (
    AIProvider,
    AIAnalysisResult,
    DetectedItemCandidate,
    EstimatedPortion,
    AIRecommendation,
)


class PlaceholderAIProvider(AIProvider):
    """
    Fallback / Placeholder AI Provider for testing and offline environments.
    Strictly avoids fabricating nutrition values, but returns structured food candidates
    matching the Phase 2 contract for offline development and testing.
    """

    async def analyze_food_image(
        self, image_bytes: bytes, filename: str
    ) -> AIAnalysisResult:
        fname = filename.lower()
        candidates: List[DetectedItemCandidate] = []

        # Provide representative structure based on filename hint or default
        if "dosa" in fname:
            candidates.append(
                DetectedItemCandidate(
                    name="Masala Dosa",
                    confidence=0.88,
                    estimated_portion=EstimatedPortion(value=180.0, unit="piece", display_text="~180 g (1 piece)"),
                    description="Crisp fermented crepe with spiced potato masala filling",
                    ingredients=["rice & lentil batter", "potatoes", "onions", "mustard seeds"],
                    uncertainties=["Amount of ghee/oil brushed during cooking is unverified"],
                )
            )
            candidates.append(
                DetectedItemCandidate(
                    name="Sambar",
                    confidence=0.82,
                    estimated_portion=EstimatedPortion(value=150.0, unit="bowl", display_text="~150 ml"),
                    description="Lentil stew with vegetables and tamarind",
                    ingredients=["toor dal", "vegetables", "sambar spices"],
                    uncertainties=["Exact lentil thickness and sodium levels cannot be determined"],
                )
            )
        elif "biryani" in fname:
            candidates.append(
                DetectedItemCandidate(
                    name="Chicken Biryani",
                    confidence=0.86,
                    estimated_portion=EstimatedPortion(value=300.0, unit="g", display_text="~300 g"),
                    description="Layered spiced basmati rice with visible chicken pieces and caramelized onions",
                    ingredients=["basmati rice", "chicken", "spices", "fried onions"],
                    uncertainties=["Ghee and cooking fat absorption cannot be determined visually", "Exact meat-to-rice ratio is approximate"],
                )
            )
            candidates.append(
                DetectedItemCandidate(
                    name="Cucumber Raita",
                    confidence=0.80,
                    estimated_portion=EstimatedPortion(value=100.0, unit="bowl", display_text="~100 g"),
                    description="Curd side dish with grated cucumber and cumin powder",
                    ingredients=["curd/yogurt", "cucumber", "cumin"],
                    uncertainties=["Fat percentage of yogurt (whole vs skim) cannot be determined visually"],
                )
            )
        else:
            candidates.append(
                DetectedItemCandidate(
                    name="Indian Thali Assortment",
                    confidence=0.78,
                    estimated_portion=EstimatedPortion(value=250.0, unit="g", display_text="~250 g"),
                    description="Composite meal plate with visible grain and curry items",
                    ingredients=["grains", "lentils", "vegetables"],
                    uncertainties=["Portion depth and volume are estimated from 2D angle", "Oil and seasoning levels cannot be verified visually"],
                )
            )

        return AIAnalysisResult(
            status="success",
            detected_foods=candidates,
            overall_confidence=0.82,
            uncertainties=[
                "Exact oil and spice quantity cannot be determined visually from the photograph",
                "Portion sizes are approximated from standard plate dimensions",
            ],
            recommendations=[],
            phase_notice="Structured food detection generated via Placeholder AI Provider. Connect GEMINI_API_KEY for live multimodal vision.",
            processing_metadata={
                "filename": filename,
                "file_size_bytes": len(image_bytes),
                "provider": "PlaceholderAIProvider",
                "phase": 2,
            },
        )

    async def identify_food_items(
        self, image_bytes: bytes
    ) -> List[DetectedItemCandidate]:
        res = await self.analyze_food_image(image_bytes, "food.jpg")
        return res.detected_foods

    async def generate_meal_recommendations(
        self, meal_summary: Dict[str, Any], user_goal: str = "balanced"
    ) -> List[AIRecommendation]:
        return []
