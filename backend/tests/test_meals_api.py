from fastapi.testclient import TestClient


def test_calculate_meal_preview(client: TestClient):
    payload = {
        "items": [
            {
                "food_name": "Chapati / Roti",
                "serving_count": 2.0,
                "serving_size": 40.0,
                "serving_unit": "piece",
                "calories": 95.0,
                "protein": 3.1,
                "carbohydrates": 18.5,
                "fat": 1.2,
                "fiber": 2.5,
                "uncertainty_pct": 5.0,
            },
            {
                "food_name": "Dal Tadka",
                "serving_count": 1.0,
                "serving_size": 200.0,
                "serving_unit": "bowl",
                "calories": 180.0,
                "protein": 9.2,
                "carbohydrates": 24.0,
                "fat": 5.5,
                "fiber": 6.5,
                "uncertainty_pct": 8.0,
            },
        ]
    }
    response = client.post("/api/meals/calculate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["total_calories"] == 370.0  # (95*2) + 180 = 370.0
    assert data["total_protein"] == 15.4   # (3.1*2) + 9.2 = 15.4
    assert data["calorie_min"] < 370.0
    assert data["calorie_max"] > 370.0
    assert "Estimated: ~370 kcal" in data["formatted_estimate"]


def test_create_and_get_meal(client: TestClient):
    create_payload = {
        "meal_type": "lunch",
        "notes": "Healthy lunch with roti and dal",
        "items": [
            {
                "food_name": "Chapati / Roti",
                "serving_count": 2.0,
                "serving_size": 40.0,
                "serving_unit": "piece",
                "calories": 95.0,
                "protein": 3.1,
                "carbohydrates": 18.5,
                "fat": 1.2,
                "fiber": 2.5,
                "uncertainty_pct": 5.0,
            }
        ],
    }
    create_res = client.post("/api/meals", json=create_payload)
    assert create_res.status_code == 201
    meal_data = create_res.json()
    assert meal_data["id"] is not None
    assert meal_data["total_calories"] == 190.0
    assert len(meal_data["items"]) == 1

    # Fetch meal by ID
    get_res = client.get(f"/api/meals/{meal_data['id']}")
    assert get_res.status_code == 200
    fetched = get_res.json()
    assert fetched["id"] == meal_data["id"]
    assert fetched["total_calories"] == 190.0
    assert "Estimated: ~190 kcal" in fetched["formatted_estimate"]


def test_get_nonexistent_meal(client: TestClient):
    response = client.get("/api/meals/non-existent-uuid")
    assert response.status_code == 404
