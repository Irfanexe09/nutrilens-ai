import json
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.ai.base import (
    AIProviderConfigError,
    AIProviderTimeoutError,
    AIProviderResponseError,
    AIProviderError,
)
from app.ai.gemini_provider import GeminiVisionAIProvider
from app.ai.placeholder_provider import PlaceholderAIProvider


@pytest.mark.asyncio
async def test_gemini_provider_missing_key_raises_config_error():
    provider = GeminiVisionAIProvider(api_key=None)
    with pytest.raises(AIProviderConfigError) as exc_info:
        await provider.analyze_food_image(b"image_bytes", "food.jpg")
    assert "gemini api key is not configured" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_gemini_provider_successful_json_parsing():
    provider = GeminiVisionAIProvider(api_key="dummy_key_for_test")

    mock_json_payload = {
        "foods": [
            {
                "name": "Paneer Butter Masala",
                "estimated_portion": {
                    "value": 220,
                    "unit": "g",
                    "display_text": "~220 g",
                },
                "confidence": 0.91,
                "description": "Cubes of cottage cheese in tomato butter gravy",
                "ingredients": ["paneer", "tomato puree", "butter", "cream"],
                "uncertainties": ["Exact amount of butter and cream cannot be measured visually"],
            }
        ],
        "overall_confidence": 0.89,
        "uncertainties": [
            "Depth of bowl makes volume an approximation",
            "Hidden butter in gravy cannot be determined visually",
        ],
    }

    mock_response = MagicMock()
    mock_response.text = json.dumps(mock_json_payload)

    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(return_value=mock_response)
    provider._client = MagicMock()
    provider._client.aio = mock_aio

    result = await provider.analyze_food_image(b"fake_image_bytes", "dish.jpg")

    assert result.status == "success"
    assert len(result.detected_foods) == 1
    item = result.detected_foods[0]
    assert item.name == "Paneer Butter Masala"
    assert item.confidence == 0.91
    assert item.estimated_portion.value == 220.0
    assert item.estimated_portion.unit == "g"
    assert item.estimated_portion.display_text == "~220 g"
    assert "paneer" in item.ingredients
    assert result.overall_confidence == 0.89
    assert len(result.uncertainties) == 2


@pytest.mark.asyncio
async def test_gemini_provider_timeout_raises_timeout_error():
    provider = GeminiVisionAIProvider(api_key="dummy_key_for_test", timeout=0.01)

    async def slow_response(*args, **kwargs):
        await asyncio.sleep(0.05)
        return MagicMock()

    mock_aio = MagicMock()
    mock_aio.models.generate_content = slow_response
    provider._client = MagicMock()
    provider._client.aio = mock_aio

    with pytest.raises(AIProviderTimeoutError) as exc_info:
        await provider.analyze_food_image(b"fake_image_bytes", "dish.jpg")
    assert "timed out" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_gemini_provider_malformed_json_raises_response_error():
    provider = GeminiVisionAIProvider(api_key="dummy_key_for_test")

    mock_response = MagicMock()
    mock_response.text = "This is not valid JSON at all. Here is some prose about biryani."

    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(return_value=mock_response)
    provider._client = MagicMock()
    provider._client.aio = mock_aio

    with pytest.raises(AIProviderResponseError) as exc_info:
        await provider.analyze_food_image(b"fake_image_bytes", "dish.jpg")
    assert "non-json or malformed output" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_gemini_provider_generic_failure_raises_provider_error():
    provider = GeminiVisionAIProvider(api_key="dummy_key_for_test")

    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(side_effect=RuntimeError("Connection refused by upstream"))
    provider._client = MagicMock()
    provider._client.aio = mock_aio

    with pytest.raises(AIProviderError) as exc_info:
        await provider.analyze_food_image(b"fake_image_bytes", "dish.jpg")
    assert "connection refused" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_placeholder_provider_structured_output():
    placeholder = PlaceholderAIProvider()
    res = await placeholder.analyze_food_image(b"bytes", "biryani.jpg")

    assert res.status == "success"
    assert len(res.detected_foods) >= 1
    assert "Biryani" in res.detected_foods[0].name
    assert res.detected_foods[0].estimated_portion.value > 0
    assert len(res.uncertainties) >= 1
