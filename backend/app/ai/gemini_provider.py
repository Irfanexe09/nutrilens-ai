import os
import json
import logging
import asyncio
import time
from typing import List, Dict, Any, Optional

from google import genai
from google.genai import types

from app.core.config import settings
from app.ai.base import (
    AIProvider,
    AIAnalysisResult,
    DetectedItemCandidate,
    EstimatedPortion,
    AIRecommendation,
    AIProviderError,
    AIProviderConfigError,
    AIProviderTimeoutError,
    AIProviderResponseError,
)
from app.ai.prompts import (
    FOOD_ANALYSIS_SYSTEM_PROMPT,
    FOOD_ANALYSIS_USER_PROMPT,
)

logger = logging.getLogger("nutrilens.ai.gemini")


class GeminiVisionAIProvider(AIProvider):
    """
    Multimodal AI Vision Provider powered by Google Gemini.
    Provides structured visual food recognition, conservative portion estimation,
    and visual uncertainty detection. Strictly omits calorie/macro calculations.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        self.api_key = api_key or settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
        self.model_name = model_name or settings.GEMINI_MODEL or "gemini-2.5-flash"
        self.timeout = timeout or settings.AI_TIMEOUT_SECONDS

        if self.api_key:
            self._client = genai.Client(api_key=self.api_key)
        else:
            self._client = None

    def _determine_mime_type(self, filename: str) -> str:
        ext = os.path.splitext(filename.lower())[1]
        if ext == ".png":
            return "image/png"
        elif ext == ".webp":
            return "image/webp"
        return "image/jpeg"

    async def analyze_food_image(
        self, image_bytes: bytes, filename: str
    ) -> AIAnalysisResult:
        if not self.api_key or not self._client:
            logger.error("GEMINI_API_KEY is not configured.")
            raise AIProviderConfigError(
                "Gemini API key is not configured. Please set the GEMINI_API_KEY environment variable."
            )

        mime_type = self._determine_mime_type(filename)
        start_time = time.time()
        logger.info(
            f"Starting multimodal food analysis with model '{self.model_name}' for file '{filename}' ({len(image_bytes)} bytes)..."
        )

        try:
            image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
            content_config = types.GenerateContentConfig(
                system_instruction=FOOD_ANALYSIS_SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.2,
            )

            # Enforce async timeout
            response = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=self.model_name,
                    contents=[image_part, FOOD_ANALYSIS_USER_PROMPT],
                    config=content_config,
                ),
                timeout=self.timeout,
            )
        except asyncio.TimeoutError:
            duration = round((time.time() - start_time) * 1000, 2)
            logger.error(f"Gemini API request timed out after {self.timeout}s (elapsed: {duration}ms).")
            raise AIProviderTimeoutError(
                f"Food analysis timed out after {self.timeout} seconds. The vision service is experiencing high latency."
            )
        except Exception as e:
            duration = round((time.time() - start_time) * 1000, 2)
            logger.error(f"Gemini API invocation failed after {duration}ms: {e}")
            raise AIProviderError(f"Multimodal vision provider error: {str(e)}")

        duration_ms = round((time.time() - start_time) * 1000, 2)
        logger.info(f"Gemini API responded in {duration_ms}ms.")

        raw_text = response.text or "{}"
        try:
            data = json.loads(raw_text)
        except Exception as e:
            logger.error(f"Failed to parse JSON from Gemini response: {raw_text[:200]}...")
            raise AIProviderResponseError(
                f"Vision provider returned non-JSON or malformed output: {str(e)}"
            )

        # Parse structured detected foods
        raw_foods = data.get("foods", [])
        detected_candidates: List[DetectedItemCandidate] = []

        for item in raw_foods:
            name = item.get("name", "Unknown Food").strip()
            conf = float(item.get("confidence", 0.7))
            conf = max(0.0, min(1.0, conf))

            portion_data = item.get("estimated_portion", {})
            try:
                p_val = float(portion_data.get("value", 100.0))
            except (ValueError, TypeError):
                p_val = 100.0
            p_unit = str(portion_data.get("unit", "g"))
            p_display = portion_data.get("display_text")

            portion = EstimatedPortion(
                value=p_val,
                unit=p_unit,
                display_text=p_display,
            )

            detected_candidates.append(
                DetectedItemCandidate(
                    name=name,
                    confidence=conf,
                    estimated_portion=portion,
                    description=item.get("description"),
                    ingredients=item.get("ingredients", []),
                    uncertainties=item.get("uncertainties", []),
                )
            )

        overall_conf = float(data.get("overall_confidence", 0.75))
        overall_conf = max(0.0, min(1.0, overall_conf))
        uncertainties = data.get("uncertainties", [])
        if not uncertainties and detected_candidates:
            uncertainties = [
                "Exact oil and seasoning content cannot be determined from the image",
                "Portion size is estimated from the visible angle and plate perspective",
            ]

        return AIAnalysisResult(
            status="success",
            detected_foods=detected_candidates,
            overall_confidence=overall_conf,
            uncertainties=uncertainties,
            recommendations=[],
            phase_notice="Food items and portions estimated via Multimodal Vision AI. Nutrition calculations are performed deterministically in the subsequent step.",
            processing_metadata={
                "provider": "GeminiVisionAIProvider",
                "model": self.model_name,
                "duration_ms": duration_ms,
                "items_detected": len(detected_candidates),
            },
        )

    async def identify_food_items(
        self, image_bytes: bytes
    ) -> List[DetectedItemCandidate]:
        result = await self.analyze_food_image(image_bytes, "image.jpg")
        return result.detected_foods

    async def generate_meal_recommendations(
        self, meal_summary: Dict[str, Any], user_goal: str = "balanced"
    ) -> List[AIRecommendation]:
        # Recommendations will be expanded in future phases
        return []
