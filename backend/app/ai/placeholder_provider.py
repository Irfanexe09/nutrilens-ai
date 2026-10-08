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

    async def explain_meal_optimization(
        self,
        goal: str,
        original_nutrition: Dict[str, Any],
        optimized_nutrition: Dict[str, Any],
        changes: List[str],
    ) -> str:
        orig_cal = original_nutrition.get("calories", 0)
        opt_cal = optimized_nutrition.get("calories", 0)
        orig_pro = original_nutrition.get("protein", 0)
        opt_pro = optimized_nutrition.get("protein", 0)
        orig_fib = original_nutrition.get("fiber", 0)
        opt_fib = optimized_nutrition.get("fiber", 0)

        cal_diff = round(opt_cal - orig_cal)
        pro_diff = round(opt_pro - orig_pro, 1)
        fib_diff = round(opt_fib - orig_fib, 1)

        parts = []
        if cal_diff < -50:
            parts.append(f"lowers total energy by ~{abs(cal_diff)} kcal to support your caloric target")
        elif cal_diff > 50:
            parts.append(f"adds ~{cal_diff} nutrient-dense kcal toward your energy requirement")

        if pro_diff >= 2.0:
            parts.append(f"boosts protein by +{pro_diff}g to enhance satiety and muscle preservation")
        elif pro_diff >= -1.0 and cal_diff < -50:
            parts.append("keeps essential protein density high")

        if fib_diff >= 1.5:
            parts.append(f"increases dietary fiber by +{fib_diff}g for sustained fullness and digestive balance")

        if parts:
            explanation = "This adjustment " + ", ".join(parts[:-1])
            if len(parts) > 1:
                explanation += f", and {parts[-1]}."
            else:
                explanation = f"This adjustment {parts[0]}."
            return explanation

        return "This modification refines the meal's macronutrient balance to better support your current goal."
