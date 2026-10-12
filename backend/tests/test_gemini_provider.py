import json
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.ai.base import (
    AIProviderConfigError,
    AIProviderUnavailableError,
    AIProviderTimeoutError,
    AIProviderResponseError,
    AIProviderError,
)
from app.ai.gemini_provider import GeminiVisionAIProvider
from app.ai.placeholder_provider import PlaceholderAIProvider
from google.genai.errors import ClientError, ServerError


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
        api_key="mock_gemini_test_key_sample_1234567890",
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
    assert "mock_gemini_test_key_sample_1234567890" not in error_message


@pytest.mark.asyncio
async def test_gemini_provider_redacts_api_key_on_unexpected_error():
    """Verify that any unexpected error containing the API key is redacted."""
    secret_key = "mock_super_secret_key_should_be_redacted"
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


@pytest.mark.asyncio
async def test_gemini_provider_transient_503_retries_and_succeeds():
    """Verify that a transient 503 error on the primary model is retried and succeeds."""
    provider = GeminiVisionAIProvider(
        api_key="test_key_transient",
        max_retries=2,
        retry_base_delay=0.001,
        retry_max_delay=0.01,
    )

    mock_503 = ServerError(
        code=503,
        response_json={
            "error": {
                "code": 503,
                "message": "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
                "status": "UNAVAILABLE",
            }
        },
    )

    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "foods": [{"name": "Dal Tadka", "confidence": 0.92, "estimated_portion": {"value": 150, "unit": "g"}}],
        "overall_confidence": 0.90,
        "uncertainties": [],
    })

    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(side_effect=[mock_503, mock_response])
    provider._client = MagicMock()
    provider._client.aio = mock_aio

    result = await provider.analyze_food_image(b"fake_image", "dish.jpg")

    assert result.status == "success"
    assert mock_aio.models.generate_content.call_count == 2
    assert result.processing_metadata["attempts"] == 2
    assert result.processing_metadata["fallback_used"] is False
    assert result.processing_metadata["model"] == "gemini-3.8-flash"
    assert len(result.detected_foods) == 1
    assert result.detected_foods[0].name == "Dal Tadka"


@pytest.mark.asyncio
async def test_gemini_provider_transient_429_retries_and_succeeds():
    """Verify that a transient 429 rate limit error is retried and succeeds."""
    provider = GeminiVisionAIProvider(
        api_key="test_key_429",
        max_retries=2,
        retry_base_delay=0.001,
        retry_max_delay=0.01,
    )

    mock_429 = ClientError(
        code=429,
        response_json={"error": {"code": 429, "message": "Resource has been exhausted (rate limit).", "status": "RESOURCE_EXHAUSTED"}},
    )

    mock_response = MagicMock()
    mock_response.text = json.dumps({
        "foods": [{"name": "Roti", "confidence": 0.95, "estimated_portion": {"value": 60, "unit": "g"}}],
        "overall_confidence": 0.95,
        "uncertainties": [],
    })

    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(side_effect=[mock_429, mock_response])
    provider._client = MagicMock()
    provider._client.aio = mock_aio

    result = await provider.analyze_food_image(b"fake_image", "dish.jpg")

    assert result.status == "success"
    assert mock_aio.models.generate_content.call_count == 2
    assert result.processing_metadata["attempts"] == 2
    assert result.processing_metadata["fallback_used"] is False


@pytest.mark.asyncio
async def test_gemini_provider_transient_503_exhausts_retries_without_fallback():
    """Verify that exhausting retries with no fallback raises AIProviderUnavailableError."""
    provider = GeminiVisionAIProvider(
        api_key="test_key_exhaust",
        fallback_model=None,
        max_retries=2,
        retry_base_delay=0.001,
        retry_max_delay=0.01,
    )

    mock_503 = ServerError(
        code=503,
        response_json={"error": {"code": 503, "message": "This model is currently experiencing high demand.", "status": "UNAVAILABLE"}},
    )

    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(side_effect=mock_503)
    provider._client = MagicMock()
    provider._client.aio = mock_aio

    with pytest.raises(AIProviderUnavailableError) as exc_info:
        await provider.analyze_food_image(b"fake_image", "dish.jpg")

    # 1 initial + 2 retries = 3 total attempts
    assert mock_aio.models.generate_content.call_count == 3
    assert "currently experiencing high demand" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_gemini_provider_transient_503_transitions_to_fallback_model():
    """Verify that when the primary model exhausts retries on 503, the fallback model is called and succeeds."""
    provider = GeminiVisionAIProvider(
        api_key="test_key_fallback",
        model_name="gemini-3.8-flash",
        fallback_model="gemini-2.0-flash",
        max_retries=1,
        retry_base_delay=0.001,
        retry_max_delay=0.01,
    )

    mock_503 = ServerError(
        code=503,
        response_json={"error": {"code": 503, "message": "High demand on 3.8 flash", "status": "UNAVAILABLE"}},
    )

    mock_fallback_response = MagicMock()
    mock_fallback_response.text = json.dumps({
        "foods": [{"name": "Vegetable Pulao", "confidence": 0.88, "estimated_portion": {"value": 200, "unit": "g"}}],
        "overall_confidence": 0.88,
        "uncertainties": [],
    })

    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(side_effect=[mock_503, mock_503, mock_fallback_response])
    provider._client = MagicMock()
    provider._client.aio = mock_aio

    result = await provider.analyze_food_image(b"fake_image", "dish.jpg")

    assert result.status == "success"
    # Call 1: primary (3.8-flash) -> 503
    # Call 2: primary retry (3.8-flash) -> 503
    # Call 3: fallback (2.0-flash) -> success
    assert mock_aio.models.generate_content.call_count == 3
    calls = mock_aio.models.generate_content.call_args_list
    assert calls[0].kwargs["model"] == "gemini-3.8-flash"
    assert calls[1].kwargs["model"] == "gemini-3.8-flash"
    assert calls[2].kwargs["model"] == "gemini-2.0-flash"

    assert result.processing_metadata["model"] == "gemini-2.0-flash"
    assert result.processing_metadata["fallback_used"] is True
    assert result.processing_metadata["attempts"] == 3


@pytest.mark.asyncio
async def test_gemini_provider_both_primary_and_fallback_fail_raises_unavailable():
    """Verify that if primary retries and the single fallback attempt both fail, AIProviderUnavailableError is raised."""
    provider = GeminiVisionAIProvider(
        api_key="test_key_both_fail",
        model_name="gemini-3.8-flash",
        fallback_model="gemini-2.0-flash",
        max_retries=1,
        retry_base_delay=0.001,
        retry_max_delay=0.01,
    )

    mock_503 = ServerError(
        code=503,
        response_json={"error": {"code": 503, "message": "Capacity unavailable", "status": "UNAVAILABLE"}},
    )

    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(side_effect=mock_503)
    provider._client = MagicMock()
    provider._client.aio = mock_aio

    with pytest.raises(AIProviderUnavailableError) as exc_info:
        await provider.analyze_food_image(b"fake_image", "dish.jpg")

    # 2 calls on primary + 1 call on fallback = 3 calls total
    assert mock_aio.models.generate_content.call_count == 3
    assert "currently experiencing high demand" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_gemini_provider_permanent_401_auth_error_fails_immediately_without_retry():
    """Verify that HTTP 401 unauthorized error fails immediately with AIProviderConfigError without retrying."""
    provider = GeminiVisionAIProvider(
        api_key="invalid_secret_key_12345",
        fallback_model="gemini-2.0-flash",
        max_retries=2,
        retry_base_delay=0.001,
    )

    mock_401 = ClientError(
        code=401,
        response_json={"error": {"code": 401, "message": "API key not valid. Please pass a valid API key.", "status": "UNAUTHENTICATED"}},
    )

    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(side_effect=mock_401)
    provider._client = MagicMock()
    provider._client.aio = mock_aio

    with pytest.raises(AIProviderConfigError) as exc_info:
        await provider.analyze_food_image(b"fake_image", "dish.jpg")

    assert mock_aio.models.generate_content.call_count == 1
    assert "invalid or unauthorized" in str(exc_info.value).lower()
    assert "invalid_secret_key_12345" not in str(exc_info.value)


@pytest.mark.asyncio
async def test_gemini_provider_permanent_400_bad_request_fails_immediately():
    """Verify that HTTP 400 bad request fails immediately with AIProviderError without retrying."""
    provider = GeminiVisionAIProvider(
        api_key="valid_key",
        fallback_model="gemini-2.0-flash",
        max_retries=2,
        retry_base_delay=0.001,
    )

    mock_400 = ClientError(
        code=400,
        response_json={"error": {"code": 400, "message": "Invalid argument: image dimensions exceed limit.", "status": "INVALID_ARGUMENT"}},
    )

    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(side_effect=mock_400)
    provider._client = MagicMock()
    provider._client.aio = mock_aio

    with pytest.raises(AIProviderError) as exc_info:
        await provider.analyze_food_image(b"fake_image", "dish.jpg")

    assert mock_aio.models.generate_content.call_count == 1
    assert "invalid argument" in str(exc_info.value).lower()


def test_gemini_provider_sanitize_message_redacts_keys_and_query_params():
    """Verify that _sanitize_message redacts the configured API key and query parameters."""
    secret = "mock_secret_api_key_987654321"
    provider = GeminiVisionAIProvider(api_key=secret)

    raw_msg = f"Request to https://generativelanguage.googleapis.com/v1beta?key={secret}&model=gemini failed with key {secret}"
    sanitized = provider._sanitize_message(raw_msg)

    assert secret not in sanitized
    assert sanitized.count("[REDACTED_API_KEY]") == 2


@pytest.mark.asyncio
async def test_analyze_endpoint_returns_503_on_transient_high_demand(monkeypatch):
    """Verify that POST /api/analyze returns HTTP 503 with user-friendly detail on model high demand."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.rate_limit import analysis_rate_limiter

    analysis_rate_limiter.reset()

    mock_503_error = ServerError(
        code=503,
        response_json={
            "error": {
                "code": 503,
                "message": "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.",
                "status": "UNAVAILABLE",
            }
        },
    )

    mock_provider = GeminiVisionAIProvider(
        api_key="secret_test_key",
        model_name="gemini-3.8-flash",
        fallback_model=None,
        max_retries=0,
    )
    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(side_effect=mock_503_error)
    mock_provider._client = MagicMock()
    mock_provider._client.aio = mock_aio

    monkeypatch.setattr("app.services.analysis_service.get_ai_provider", lambda: mock_provider)

    client = TestClient(app, raise_server_exceptions=False)
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
        assert "experiencing high demand" in detail.lower()
        assert "try again" in detail.lower()
        assert "secret_test_key" not in detail
    finally:
        analysis_rate_limiter.reset()


def test_gemini_provider_configures_low_thinking_level_for_gemini_3():
    """Verify that Gemini 3.x models receive thinking_level='low' while Gemini 2.x models omit it."""
    provider = GeminiVisionAIProvider(api_key="test_key")

    cfg_38 = provider._build_content_config("gemini-3.8-flash")
    assert cfg_38.thinking_config is not None
    assert str(cfg_38.thinking_config.thinking_level).upper() in ("LOW", "THINKINGLEVEL.LOW")

    cfg_20 = provider._build_content_config("gemini-2.0-flash")
    assert cfg_20.thinking_config is None


def test_gemini_provider_extracts_retry_after_header():
    """Verify that _extract_retry_after extracts Retry-After from response headers."""
    provider = GeminiVisionAIProvider(api_key="test_key")

    mock_resp = MagicMock()
    mock_resp.headers = {"Retry-After": "3"}
    mock_err = ClientError(code=429, response_json={"error": {"code": 429}}, response=mock_resp)

    retry_after = provider._extract_retry_after(mock_err)
    assert retry_after == 3.0

    # Unreasonable Retry-After (> 10s) is ignored to preserve deadline
    mock_resp.headers = {"Retry-After": "120"}
    assert provider._extract_retry_after(mock_err) is None


@pytest.mark.asyncio
async def test_gemini_provider_per_attempt_timeout_transitions_to_fallback():
    """Verify that when primary model exceeds per-attempt timeout, the fallback model takes over and succeeds."""
    provider = GeminiVisionAIProvider(
        api_key="test_key_timeout_fb",
        model_name="gemini-3.8-flash",
        fallback_model="gemini-2.0-flash",
        timeout=1.0,
        per_attempt_timeout=0.02,
        max_retries=0,
    )

    async def slow_primary(*args, **kwargs):
        await asyncio.sleep(0.05)
        return MagicMock()

    mock_fallback_response = MagicMock()
    mock_fallback_response.text = json.dumps({
        "foods": [{"name": "Idli Sambar", "confidence": 0.94, "estimated_portion": {"value": 120, "unit": "g"}}],
        "overall_confidence": 0.94,
        "uncertainties": [],
    })

    async def mock_generate_content(*args, **kwargs):
        model = kwargs.get("model")
        if model == "gemini-3.8-flash":
            await asyncio.sleep(0.05)
            return MagicMock()
        return mock_fallback_response

    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(side_effect=mock_generate_content)
    provider._client = MagicMock()
    provider._client.aio = mock_aio

    result = await provider.analyze_food_image(b"fake_image", "dish.jpg", session_id="test-session-per-attempt")

    assert result.status == "success"
    assert result.processing_metadata["model"] == "gemini-2.0-flash"
    assert result.processing_metadata["fallback_used"] is True
    assert len(result.detected_foods) == 1
    assert result.detected_foods[0].name == "Idli Sambar"


@pytest.mark.asyncio
async def test_analyze_endpoint_returns_504_on_timeout(monkeypatch):
    """Verify that POST /api/analyze returns HTTP 504 with a safe, polite message when upstream times out."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.rate_limit import analysis_rate_limiter

    analysis_rate_limiter.reset()

    mock_provider = GeminiVisionAIProvider(
        api_key="secret_test_key",
        timeout=0.01,
        per_attempt_timeout=0.01,
        max_retries=0,
    )

    async def slow_generate(*args, **kwargs):
        await asyncio.sleep(0.05)
        return MagicMock()

    mock_aio = MagicMock()
    mock_aio.models.generate_content = slow_generate
    mock_provider._client = MagicMock()
    mock_provider._client.aio = mock_aio

    monkeypatch.setattr("app.services.analysis_service.get_ai_provider", lambda: mock_provider)

    client = TestClient(app, raise_server_exceptions=False)
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

        assert response.status_code == 504
        detail = response.json().get("detail", "")
        assert "timed out" in detail.lower()
        assert "try again" in detail.lower()
        assert "secret_test_key" not in detail
    finally:
        analysis_rate_limiter.reset()


@pytest.mark.asyncio
async def test_analyze_endpoint_never_fabricates_data_on_provider_failure(monkeypatch):
    """Verify that when AI provider fails, the endpoint returns strictly an error and never fabricates food results."""
    from fastapi.testclient import TestClient
    from app.main import app
    from app.core.rate_limit import analysis_rate_limiter

    analysis_rate_limiter.reset()

    mock_503 = ServerError(
        code=503,
        response_json={"error": {"code": 503, "message": "High demand", "status": "UNAVAILABLE"}},
    )

    mock_provider = GeminiVisionAIProvider(
        api_key="secret_test_key",
        max_retries=0,
    )
    mock_aio = MagicMock()
    mock_aio.models.generate_content = AsyncMock(side_effect=mock_503)
    mock_provider._client = MagicMock()
    mock_provider._client.aio = mock_aio

    monkeypatch.setattr("app.services.analysis_service.get_ai_provider", lambda: mock_provider)

    client = TestClient(app, raise_server_exceptions=False)
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
        body = response.json()
        assert "foods" not in body
        assert "analysis" not in body
        assert "calories" not in body
        assert "status" not in body or body["status"] != "success"
    finally:
        analysis_rate_limiter.reset()

