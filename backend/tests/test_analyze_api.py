import io
from fastapi.testclient import TestClient


def test_analyze_valid_image(client: TestClient, sample_image_bytes: bytes):
    files = {
        "image": ("test_dish.jpg", sample_image_bytes, "image/jpeg"),
    }
    response = client.post("/api/analyze", files=files)
    assert response.status_code == 200
    data = response.json()

    # Verify structured Phase 1 schema
    assert "meal_id" in data
    assert data["status"] == "pending"
    assert data["foods"] == []
    assert data["nutrition"] is None
    assert data["confidence"] is None
    assert "Phase 2" in data["notice"]
    assert data["image_metadata"] is not None
    assert data["image_metadata"]["original_filename"] == "test_dish.jpg"
    assert data["image_metadata"]["content_type"] == "image/jpeg"


def test_analyze_unsupported_media_type(client: TestClient):
    files = {
        "image": ("script.txt", b"print('hello world')", "text/plain"),
    }
    response = client.post("/api/analyze", files=files)
    assert response.status_code == 415
    assert "unsupported image format" in response.json()["detail"].lower()


def test_analyze_empty_file(client: TestClient):
    files = {
        "image": ("empty.jpg", b"", "image/jpeg"),
    }
    response = client.post("/api/analyze", files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_analyze_corrupted_image(client: TestClient):
    files = {
        "image": ("corrupted.jpg", b"garbage-binary-data-not-a-jpeg", "image/jpeg"),
    }
    response = client.post("/api/analyze", files=files)
    assert response.status_code == 400
    assert "not a valid image" in response.json()["detail"].lower()
