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
def test_analyze_valid_image(client: TestClient, sample_image_bytes: bytes, auth_headers: dict):
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
        response = client.post("/api/analyze", files=files, headers=auth_headers)

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
def test_analyze_unsupported_media_type(client: TestClient, auth_headers: dict):
    files = {"image": ("document.pdf", b"%PDF-1.4 garbage content", "application/pdf")}
    response = client.post("/api/analyze", files=files, headers=auth_headers)
    assert response.status_code == 415
    assert "unsupported image format" in response.json()["detail"].lower()


# --- 3. Oversized File (>10MB) ---
def test_analyze_oversized_file(client: TestClient, auth_headers: dict):
    # Create fake oversized payload greater than 10MB
    oversized_bytes = b"0" * (10 * 1024 * 1024 + 1024)
    files = {"image": ("huge_photo.jpg", oversized_bytes, "image/jpeg")}
    response = client.post("/api/analyze", files=files, headers=auth_headers)
    assert response.status_code == 413
    assert "exceeds maximum allowable size" in response.json()["detail"].lower()


# --- 4. Empty Upload ---
def test_analyze_empty_file(client: TestClient, auth_headers: dict):
    files = {"image": ("empty.jpg", b"", "image/jpeg")}
    response = client.post("/api/analyze", files=files, headers=auth_headers)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


# --- 5. Corrupted Image ---
def test_analyze_corrupted_image(client: TestClient, auth_headers: dict):
    files = {"image": ("corrupted.jpg", b"not-a-real-jpeg-header-binary", "image/jpeg")}
    response = client.post("/api/analyze", files=files, headers=auth_headers)
    assert response.status_code == 400
    assert "not a valid image" in response.json()["detail"].lower()


# --- 6. Malformed AI Response (AI Provider Response Error) ---
def test_analyze_malformed_ai_response(client: TestClient, sample_image_bytes: bytes, auth_headers: dict):
    with patch("app.services.analysis_service.get_ai_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.analyze_food_image.side_effect = AIProviderResponseError("Malformed JSON returned by provider")
        mock_get_provider.return_value = mock_provider

        files = {"image": ("test.jpg", sample_image_bytes, "image/jpeg")}
        response = client.post("/api/analyze", files=files, headers=auth_headers)

        assert response.status_code == 502
        assert "food analysis failed" in response.json()["detail"].lower()


# --- 7. AI Timeout ---
def test_analyze_ai_timeout(client: TestClient, sample_image_bytes: bytes, auth_headers: dict):
    with patch("app.services.analysis_service.get_ai_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.analyze_food_image.side_effect = AIProviderTimeoutError("Request timed out after 25 seconds")
        mock_get_provider.return_value = mock_provider

        files = {"image": ("test.jpg", sample_image_bytes, "image/jpeg")}
        response = client.post("/api/analyze", files=files, headers=auth_headers)

        assert response.status_code == 504
        assert "timed out" in response.json()["detail"].lower()


# --- 8. AI Provider Generic Failure ---
def test_analyze_ai_provider_failure(client: TestClient, sample_image_bytes: bytes, auth_headers: dict):
    with patch("app.services.analysis_service.get_ai_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.analyze_food_image.side_effect = AIProviderError("Gemini 500 internal server error")
        mock_get_provider.return_value = mock_provider

        files = {"image": ("test.jpg", sample_image_bytes, "image/jpeg")}
        response = client.post("/api/analyze", files=files, headers=auth_headers)

        assert response.status_code == 502
        assert "food analysis failed" in response.json()["detail"].lower()


# --- 9. AI Provider Missing Configuration ---
def test_analyze_ai_provider_config_error(client: TestClient, sample_image_bytes: bytes, auth_headers: dict):
    with patch("app.services.analysis_service.get_ai_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.analyze_food_image.side_effect = AIProviderConfigError("GEMINI_API_KEY missing")
        mock_get_provider.return_value = mock_provider

        files = {"image": ("test.jpg", sample_image_bytes, "image/jpeg")}
        response = client.post("/api/analyze", files=files, headers=auth_headers)

        assert response.status_code == 503
        assert "gemini_api_key" in response.json()["detail"].lower()


# --- 10. Missing or Unauthenticated Requests Rejected with HTTP 401 ---
def test_analyze_unauthenticated_request_rejected(client: TestClient, sample_image_bytes: bytes):
    files = {"image": ("food.jpg", sample_image_bytes, "image/jpeg")}
    response = client.post("/api/analyze", files=files)
    assert response.status_code == 401
    assert "authentication required" in response.json()["detail"].lower()


def test_analyze_invalid_token_rejected(client: TestClient, sample_image_bytes: bytes):
    files = {"image": ("food.jpg", sample_image_bytes, "image/jpeg")}
    response = client.post(
        "/api/analyze",
        files=files,
        headers={"Authorization": "Bearer invalid-tampered-token-xyz"},
    )
    assert response.status_code == 401
    assert "could not validate credentials" in response.json()["detail"].lower()


# --- 11. End-to-End Analysis and Meal Saving Flow ---
def test_analyze_and_save_meal_flow(client: TestClient, sample_image_bytes: bytes, auth_headers: dict):
    """
    Verify complete flow:
    1. Authenticated user sends food photo directly via multipart form.
    2. Backend validates image and returns structured food analysis.
    3. User confirms detected foods and saves meal via POST /api/meals.
    4. Saved meal is persisted with authenticated user ownership.
    """
    mock_result = AIAnalysisResult(
        status="success",
        detected_foods=[
            DetectedItemCandidate(
                name="Dal Tadka",
                confidence=0.92,
                estimated_portion=EstimatedPortion(value=200.0, unit="g", display_text="1 bowl (~200g)"),
                description="Yellow lentil curry with cumin and mustard seeds",
                ingredients=["lentils", "ghee", "cumin"],
                uncertainties=["Ghee quantity estimated visually"],
            ),
        ],
        overall_confidence=0.92,
        uncertainties=["Oil amount cannot be directly weighed"],
        phase_notice="Analysis successful",
    )

    with patch("app.services.analysis_service.get_ai_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_provider.analyze_food_image.return_value = mock_result
        mock_get_provider.return_value = mock_provider

        # Step 1 & 2: Direct analysis
        files = {"image": ("dal.jpg", sample_image_bytes, "image/jpeg")}
        analyze_res = client.post("/api/analyze", files=files, headers=auth_headers)
        assert analyze_res.status_code == 200
        analyze_data = analyze_res.json()
        assert analyze_data["status"] == "success"
        detected = analyze_data["analysis"]["foods"][0]
        assert detected["name"] == "Dal Tadka"

        # Step 3 & 4: Save meal
        meal_payload = {
            "meal_type": "lunch",
            "notes": "Healthy home lunch",
            "image_url": analyze_data["image_metadata"]["relative_url"],
            "items": [
                {
                    "food_name": "Dal Tadka",
                    "serving_count": 1.0,
                    "serving_size": 200.0,
                    "serving_unit": "g",
                    "calories": 180.0,
                    "protein": 9.0,
                    "carbohydrates": 24.0,
                    "fat": 5.0,
                    "fiber": 6.0,
                    "confidence_score": 0.92,
                    "uncertainty_pct": 12.0,
                }
            ],
        }
        save_res = client.post("/api/meals", json=meal_payload, headers=auth_headers)
        assert save_res.status_code == 201
        saved_data = save_res.json()
        assert saved_data["meal_type"] == "lunch"
        assert len(saved_data["items"]) == 1
        assert saved_data["items"][0]["food_name"] == "Dal Tadka"
        assert saved_data["user_id"] == "test-auth-user-id"



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
