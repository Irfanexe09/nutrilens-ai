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


def test_gemini_provider_default_model_and_prefix_stripping():
    """Verify GeminiVisionAIProvider defaults to gemini-3.8-flash and strips models/ prefix."""
    # 1. Default model
    p_default = GeminiVisionAIProvider(api_key="test_key")
    assert p_default.model_name == "gemini-3.8-flash"

    # 2. Stripping models/ prefix
    p_prefix = GeminiVisionAIProvider(api_key="test_key", model_name="models/gemini-3.8-flash")
    assert p_prefix.model_name == "gemini-3.8-flash"

    # 3. Explicit custom model
    p_custom = GeminiVisionAIProvider(api_key="test_key", model_name="gemini-custom-flash")
    assert p_custom.model_name == "gemini-custom-flash"


@pytest.mark.asyncio
async def test_gemini_provider_passes_configured_model_to_api_client():
    """Verify that image-analysis requests pass the configured model name to the Gemini client."""
    provider = GeminiVisionAIProvider(api_key="dummy_test_key", model_name="gemini-3.8-flash")

    mock_response = MagicMock()
    mock_response.text = json.dumps({"foods": [], "overall_confidence": 0.8, "uncertainties": []})

    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(return_value=mock_response)
    provider._client = MagicMock()
    provider._client.aio = mock_aio

    await provider.analyze_food_image(b"fake_image_bytes", "sample.jpg")

    # Verify generate_content was called with model='gemini-3.8-flash'
    assert mock_aio.models.generate_content.called
    call_kwargs = mock_aio.models.generate_content.call_args.kwargs
    assert call_kwargs["model"] == "gemini-3.8-flash"


@pytest.mark.asyncio
async def test_gemini_provider_unavailable_model_404_handled_safely():
    """Verify that an unavailable-model 404 from Gemini raises AIProviderConfigError without exposing secrets."""
    provider = GeminiVisionAIProvider(
        api_key="AIzaSySuperSecretKey1234567890",
        model_name="gemini-2.5-flash",
    )

    from google.genai.errors import ClientError

    mock_404_error = ClientError(
        code=404,
        response_json={
            "error": {
                "code": 404,
                "message": "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash.",
                "status": "NOT_FOUND",
            }
        },
    )

    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(side_effect=mock_404_error)
    provider._client = MagicMock()
    provider._client.aio = mock_aio

    with pytest.raises(AIProviderConfigError) as exc_info:
        await provider.analyze_food_image(b"fake_image_bytes", "sample.jpg")

    error_message = str(exc_info.value)
    assert "unavailable or deprecated" in error_message.lower()
    assert "gemini-3.8-flash" in error_message
    assert "gemini-2.5-flash" in error_message
    # Critical security assertion: API key must NOT be leaked
    assert "AIzaSySuperSecretKey1234567890" not in error_message


@pytest.mark.asyncio
async def test_gemini_provider_redacts_api_key_on_unexpected_error():
    """Verify that any unexpected error containing the API key is redacted."""
    secret_key = "AIzaSySuperSecretKeyShouldBeRedacted"
    provider = GeminiVisionAIProvider(api_key=secret_key)

    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(
        side_effect=RuntimeError(f"Upstream request failed at https://api.google.com/?key={secret_key}")
    )
    provider._client = MagicMock()
    provider._client.aio = mock_aio

    with pytest.raises(AIProviderError) as exc_info:
        await provider.analyze_food_image(b"fake_image_bytes", "sample.jpg")

    error_message = str(exc_info.value)
    assert secret_key not in error_message
    assert "[REDACTED_API_KEY]" in error_message


@pytest.mark.asyncio
async def test_analyze_endpoint_returns_503_on_unavailable_model(monkeypatch):
    """Verify that POST /api/analyze returns HTTP 503 with safe, actionable error on model 404."""
    from fastapi.testclient import TestClient
    from app.main import app
    from google.genai.errors import ClientError
    from app.core.rate_limit import analysis_rate_limiter

    analysis_rate_limiter.reset()

    mock_404_error = ClientError(
        code=404,
        response_json={
            "error": {
                "code": 404,
                "message": "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.8-flash.",
                "status": "NOT_FOUND",
            }
        },
    )

    mock_provider = GeminiVisionAIProvider(api_key="secret_test_key", model_name="gemini-2.5-flash")
    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(side_effect=mock_404_error)
    mock_provider._client = MagicMock()
    mock_provider._client.aio = mock_aio

    monkeypatch.setattr("app.services.analysis_service.get_ai_provider", lambda: mock_provider)

    client = TestClient(app, raise_server_exceptions=False)
    # 1x1 valid JPEG image bytes
    jpeg_bytes = (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00"
        b"\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f"
        b"\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' \",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0"
        b"\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01"
        b"\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda"
        b"\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
    )

    try:
        response = client.post(
            "/api/analyze",
            files={"image": ("food.jpg", jpeg_bytes, "image/jpeg")},
        )

        assert response.status_code == 503
        detail = response.json().get("detail", "")
        assert "unavailable or deprecated" in detail.lower()
        assert "gemini-3.8-flash" in detail
        assert "secret_test_key" not in detail
    finally:
        analysis_rate_limiter.reset()

