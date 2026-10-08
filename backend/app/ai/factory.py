import os
import logging
from typing import Optional
from app.core.config import settings
from app.ai.base import AIProvider
from app.ai.placeholder_provider import PlaceholderAIProvider
from app.ai.gemini_provider import GeminiVisionAIProvider

logger = logging.getLogger("nutrilens.ai.factory")


def get_ai_provider(provider_type: Optional[str] = None) -> AIProvider:
    """
    Factory function to retrieve the configured AI vision provider instance.
    Swappable between Gemini multimodal vision, placeholder, or future vision models.
    Falls back gracefully to PlaceholderAIProvider if GEMINI_API_KEY is not configured.
    """
    selected = (provider_type or settings.AI_PROVIDER or "gemini").lower().strip()

    if selected == "gemini":
        api_key = settings.GEMINI_API_KEY or os.environ.get("GEMINI_API_KEY")
        if api_key:
            return GeminiVisionAIProvider(api_key=api_key)
        else:
            logger.warning(
                "GEMINI_API_KEY is not set. Operating in graceful fallback mode using PlaceholderAIProvider."
            )
            return PlaceholderAIProvider()

    if selected == "placeholder":
        return PlaceholderAIProvider()

    logger.warning(f"Unrecognized AI_PROVIDER '{selected}'. Operating with PlaceholderAIProvider.")
    return PlaceholderAIProvider()
