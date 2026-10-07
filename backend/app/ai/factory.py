from typing import Optional
from app.core.config import settings
from app.ai.base import AIProvider
from app.ai.placeholder_provider import PlaceholderAIProvider


def get_ai_provider(provider_type: Optional[str] = None) -> AIProvider:
    """
    Factory function to retrieve the configured AI provider instance.
    Enables zero-touch swapping in Phase 2 (e.g. Gemini, YOLO, OpenAI).
    """
    selected = provider_type or settings.AI_PROVIDER

    if selected == "placeholder":
        return PlaceholderAIProvider()
    
    # Future providers (Phase 2):
    # elif selected == "gemini":
    #     return GeminiVisionAIProvider()
    
    # Default fallback
    return PlaceholderAIProvider()
