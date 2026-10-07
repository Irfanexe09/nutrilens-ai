from fastapi.testclient import TestClient


def test_list_foods_seeded(client: TestClient):
    response = client.get("/api/foods")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] > 0
    assert len(data["items"]) > 0

    # Ensure Chicken Biryani exists in seeded list
    names = [item["name"] for item in data["items"]]
    assert any("Biryani" in name for name in names)


def test_search_foods_by_query(client: TestClient):
    response = client.get("/api/foods?q=dosa")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    for item in data["items"]:
        assert "dosa" in item["name"].lower() or "dosa" in (item.get("category") or "").lower()


def test_get_food_by_id(client: TestClient):
    # First get list to find an ID
    list_res = client.get("/api/foods?limit=1")
    assert list_res.status_code == 200
    first_item = list_res.json()["items"][0]
    food_id = first_item["id"]

    res = client.get(f"/api/foods/{food_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == food_id
    assert data["name"] == first_item["name"]
    assert "calories" in data
    assert "protein" in data


def test_get_nonexistent_food_returns_404(client: TestClient):
    response = client.get("/api/foods/999999")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_create_custom_food(client: TestClient):
    payload = {
        "name": "Sprouted Moong Salad",
        "local_name": "मूँग सलाद",
        "category": "Salad",
        "serving_size": 150.0,
        "serving_unit": "bowl",
        "calories": 140.0,
        "protein": 9.0,
        "carbohydrates": 22.0,
        "fat": 1.5,
        "fiber": 5.0,
        "is_indian_dish": True,
        "uncertainty_pct": 8.0,
        "description": "Fresh sprouted green gram with onions, tomatoes, and lemon.",
    }
    response = client.post("/api/foods", json=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["name"] == "Sprouted Moong Salad"
    assert created["calories"] == 140.0
