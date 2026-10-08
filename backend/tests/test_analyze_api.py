import io
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import settings
from app.ai.base import (
    AIAnalysisResult,
    DetectedItemCandidate,
    EstimatedPortion,
    AIProviderError,
    AIProviderConfigError,
    AIProviderTimeoutError,
    AIProviderResponseError,
)
from app.schemas.analyze import (
    EstimatedPortionSchema,
    DetectedFoodSchema,
    FoodAnalysisData,
    FoodAnalysisResponse,
)


# --- 1. Valid Image Upload (with Mocked AI Provider) ---
def test_analyze_valid_image(client: TestClient, sample_image_bytes: bytes):
    mock_result = AIAnalysisResult(
        status="success",
        detected_foods=[
            DetectedItemCandidate(
                name="Chicken Biryani",
                confidence=0.89,
                estimated_portion=EstimatedPortion(value=300.0, unit="g", display_text="~300 g"),
                description="Long grain basmati rice with visible chicken pieces and saffron hue",
                ingredients=["basmati rice", "chicken", "spices"],
                uncertainties=["Ghee and cooking fat quantity cannot be verified visually"],
            ),
            DetectedItemCandidate(
                name="Cucumber Raita",
                confidence=0.85,
                estimated_portion=EstimatedPortion(value=100.0, unit="bowl", display_text="~100 g"),
                description="Curd side dish with grated cucumber",
                ingredients=["curd", "cucumber"],
                uncertainties=["Fat percentage of yogurt cannot be determined visually"],
            ),
        ],
        overall_confidence=0.87,
        uncertainties=[
            "Oil quantity cannot be determined from the image",
            "Portion size is estimated from the visible serving",
        ],
        phase_notice="Food analysis completed.",
    )

    with patch("app.services.analysis_service.get_ai_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.analyze_food_image.return_value = mock_result
        mock_get_provider.return_value = mock_provider

        files = {"image": ("meal.jpg", sample_image_bytes, "image/jpeg")}
        response = client.post("/api/analyze", files=files)

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "success"
        assert "meal_id" in data
        assert "analysis" in data

        analysis = data["analysis"]
        assert len(analysis["foods"]) == 2
        assert analysis["overall_confidence"] == 0.87
        assert len(analysis["uncertainties"]) >= 2

        first_food = analysis["foods"][0]
        assert first_food["name"] == "Chicken Biryani"
        assert first_food["confidence"] == 0.89
        assert first_food["estimated_portion"]["value"] == 300.0
        assert first_food["estimated_portion"]["unit"] == "g"
        assert first_food["estimated_portion"]["display_text"] == "~300 g"
        assert any("rice" in ing.lower() for ing in first_food["ingredients"])

        # Verify notice that nutrition calculation is deferred
        assert "Nutrition calculation will be available after confirmation." in data["notice"]
        assert data["image_metadata"]["original_filename"] == "meal.jpg"


# --- 2. Invalid File Type ---
def test_analyze_unsupported_media_type(client: TestClient):
    files = {"image": ("document.pdf", b"%PDF-1.4 garbage content", "application/pdf")}
    response = client.post("/api/analyze", files=files)
    assert response.status_code == 415
    assert "unsupported image format" in response.json()["detail"].lower()


# --- 3. Oversized File (>10MB) ---
def test_analyze_oversized_file(client: TestClient):
    # Create fake oversized payload greater than 10MB
    oversized_bytes = b"0" * (10 * 1024 * 1024 + 1024)
    files = {"image": ("huge_photo.jpg", oversized_bytes, "image/jpeg")}
    response = client.post("/api/analyze", files=files)
    assert response.status_code == 413
    assert "exceeds maximum allowable size" in response.json()["detail"].lower()


# --- 4. Empty Upload ---
def test_analyze_empty_file(client: TestClient):
    files = {"image": ("empty.jpg", b"", "image/jpeg")}
    response = client.post("/api/analyze", files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


# --- 5. Corrupted Image ---
def test_analyze_corrupted_image(client: TestClient):
    files = {"image": ("corrupted.jpg", b"not-a-real-jpeg-header-binary", "image/jpeg")}
    response = client.post("/api/analyze", files=files)
    assert response.status_code == 400
    assert "not a valid image" in response.json()["detail"].lower()


# --- 6. Malformed AI Response (AI Provider Response Error) ---
def test_analyze_malformed_ai_response(client: TestClient, sample_image_bytes: bytes):
    with patch("app.services.analysis_service.get_ai_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.analyze_food_image.side_effect = AIProviderResponseError("Malformed JSON returned by provider")
        mock_get_provider.return_value = mock_provider

        files = {"image": ("test.jpg", sample_image_bytes, "image/jpeg")}
        response = client.post("/api/analyze", files=files)

        assert response.status_code == 502
        assert "food analysis failed" in response.json()["detail"].lower()


# --- 7. AI Timeout ---
def test_analyze_ai_timeout(client: TestClient, sample_image_bytes: bytes):
    with patch("app.services.analysis_service.get_ai_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.analyze_food_image.side_effect = AIProviderTimeoutError("Request timed out after 25 seconds")
        mock_get_provider.return_value = mock_provider

        files = {"image": ("test.jpg", sample_image_bytes, "image/jpeg")}
        response = client.post("/api/analyze", files=files)

        assert response.status_code == 504
        assert "timed out" in response.json()["detail"].lower()


# --- 8. AI Provider Generic Failure ---
def test_analyze_ai_provider_failure(client: TestClient, sample_image_bytes: bytes):
    with patch("app.services.analysis_service.get_ai_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.analyze_food_image.side_effect = AIProviderError("Gemini 500 internal server error")
        mock_get_provider.return_value = mock_provider

        files = {"image": ("test.jpg", sample_image_bytes, "image/jpeg")}
        response = client.post("/api/analyze", files=files)

        assert response.status_code == 502
        assert "food analysis failed" in response.json()["detail"].lower()


# --- 9. AI Provider Missing Configuration ---
def test_analyze_ai_provider_config_error(client: TestClient, sample_image_bytes: bytes):
    with patch("app.services.analysis_service.get_ai_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.analyze_food_image.side_effect = AIProviderConfigError("GEMINI_API_KEY missing")
        mock_get_provider.return_value = mock_provider

        files = {"image": ("test.jpg", sample_image_bytes, "image/jpeg")}
        response = client.post("/api/analyze", files=files)

        assert response.status_code == 503
        assert "gemini_api_key" in response.json()["detail"].lower()


# --- 10. Pydantic / Schema Validation ---
def test_pydantic_schemas_validation():
    # Valid schema creation
    portion = EstimatedPortionSchema(value=250.0, unit="g", display_text="~250 g")
    food = DetectedFoodSchema(
        name="Masala Dosa",
        estimated_portion=portion,
        confidence=0.92,
        description="Crisp crepe with spiced potato filling",
        ingredients=["rice", "urad dal", "potatoes"],
        uncertainties=["Oil brushing quantity unverified"],
    )
    analysis = FoodAnalysisData(
        foods=[food],
        overall_confidence=0.90,
        uncertainties=["Oil amount unknown"],
    )
    resp = FoodAnalysisResponse(
        meal_id="test-session-uuid",
        status="success",
        analysis=analysis,
    )
    assert resp.analysis.foods[0].name == "Masala Dosa"
    assert resp.analysis.foods[0].confidence == 0.92
    assert resp.notice == "Nutrition calculation will be available after confirmation."

    # Invalid confidence score (> 1.0) must fail validation
    with pytest.raises(ValidationError):
        DetectedFoodSchema(
            name="Invalid Food",
            estimated_portion=portion,
            confidence=1.5,  # Out of range [0, 1]
        )

    # Negative portion value must fail validation
    with pytest.raises(ValidationError):
        EstimatedPortionSchema(value=-10.0, unit="g")
