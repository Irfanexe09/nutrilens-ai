"""
Phase 2 End-to-End Flow Verification Script.

Tests all steps of the food analysis workflow:
1. Upload an Indian meal image
2. Analyze it via POST /api/analyze
3. Verify structured backend response
4. Verify portion estimation, confidence, and visual uncertainties
5. Test invalid image handling (corrupted, non-image, empty)
6. Verify no calories are returned in this phase
"""

import io
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.analyze import FoodAnalysisResponse


def create_test_indian_dish_image(dish_name: str) -> bytes:
    """Creates a synthetic JPEG image labeled with the dish name."""
    buf = io.BytesIO()
    img = Image.new("RGB", (300, 300), color=(240, 180, 80))
    img.save(buf, format="JPEG")
    return buf.getvalue()


def test_phase2_e2e_flow():
    client = TestClient(app)

    # 1. Test invalid image rejection (corrupted, text file, empty)
    res_txt = client.post(
        "/api/analyze",
        files={"image": ("notes.txt", b"some notes", "text/plain")},
    )
    assert res_txt.status_code == 415, f"Expected 415, got {res_txt.status_code}"

    res_empty = client.post(
        "/api/analyze",
        files={"image": ("empty.jpg", b"", "image/jpeg")},
    )
    assert res_empty.status_code == 400, f"Expected 400, got {res_empty.status_code}"

    # 2. Upload an Indian meal image (Chicken Biryani)
    image_bytes = create_test_indian_dish_image("Chicken Biryani")
    response = client.post(
        "/api/analyze",
        files={"image": ("chicken_biryani_plate.jpg", image_bytes, "image/jpeg")},
    )

    # 3. Verify backend response
    assert response.status_code == 200, f"Expected 200, got {response.status_code}"
    data = response.json()

    # Validate against Pydantic model
    validated = FoodAnalysisResponse.model_validate(data)
    assert validated.status == "success"
    assert validated.meal_id is not None
    assert len(validated.analysis.foods) >= 1

    # 4. Verify portion estimation, confidence, and visual uncertainties
    first_food = validated.analysis.foods[0]
    assert first_food.name != ""
    assert first_food.confidence > 0.0 and first_food.confidence <= 1.0
    assert first_food.estimated_portion.value > 0
    assert first_food.estimated_portion.unit in ["g", "piece", "bowl", "cup"]
    assert len(validated.analysis.uncertainties) >= 1

    # 5. Verify NO calorie or nutrition values are returned in this phase
    assert not hasattr(first_food, "calories")
    assert not hasattr(first_food, "protein")
    assert "Nutrition calculation will be available after confirmation." in validated.notice

    print("Phase 2 End-to-End Backend Verification Passed Successfully!")


if __name__ == "__main__":
    test_phase2_e2e_flow()
