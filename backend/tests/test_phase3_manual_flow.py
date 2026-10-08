from fastapi.testclient import TestClient


def test_phase3_end_to_end_nutrition_flow(client: TestClient):
    """
    Comprehensive End-to-End Test for Phase 3:
    1. Verify seeded Indian food database has 35+ items across required categories.
    2. Submit confirmed meal items with different portion units (pieces, ml with density, grams).
    3. Run deterministic nutrition calculation via POST /api/nutrition/calculate.
    4. Save meal record to database via POST /api/meals.
    5. Retrieve persisted meal record via GET /api/meals/{id} and verify deterministic consistency.
    """
    # 1. Verify Seeded Food Catalog
    catalog_res = client.get("/api/foods?limit=100")
    assert catalog_res.status_code == 200
    catalog = catalog_res.json()
    assert catalog["total"] >= 35, f"Expected at least 35 foods, found {catalog['total']}"

    categories = {item["category"] for item in catalog["items"]}
    required_categories = {
        "Indian Main Course",
        "Rice",
        "Bread",
        "Breakfast",
        "Snacks",
        "Dairy",
        "Protein",
        "Vegetables",
        "Fruits",
        "Beverages",
        "Desserts",
    }
    assert required_categories.issubset(categories), f"Missing categories: {required_categories - categories}"

    # 2. Simulate User-Confirmed Items from Multimodal Analysis
    # Meal: 2 Chapatis (piece-based, 40g each = 80g) + Dal Tadka (ml-based with density, 150ml) + Curd (100g)
    confirmed_items = [
        {
            "food_name": "Chapati / Roti",
            "portion_value": 2.0,
            "portion_unit": "piece",
            "is_exact_weight": True,
        },
        {
            "food_name": "Dal Tadka",
            "portion_value": 150.0,
            "portion_unit": "ml",
            "is_exact_weight": False,
        },
        {
            "food_name": "Curd / Dahi",
            "portion_value": 100.0,
            "portion_unit": "g",
            "is_exact_weight": True,
        },
    ]

    # 3. Deterministic Nutrition Calculation (POST /api/nutrition/calculate)
    calc_res = client.post("/api/nutrition/calculate", json={"items": confirmed_items})
    assert calc_res.status_code == 200, f"Calculation failed: {calc_res.text}"
    nutrition = calc_res.json()

    # Chapati: 297 kcal / 100g * 80g = 237.6 kcal
    # Dal Tadka: 95 kcal / 100g * (150 * 1.05 = 157.5g) = 149.6 kcal
    # Curd: 61 kcal / 100g * 100g = 61.0 kcal
    # Total calories = 237.6 + 149.6 + 61.0 = 448.2 kcal
    assert 445.0 <= nutrition["total_calories"] <= 452.0
    assert nutrition["total_protein"] > 15.0
    assert nutrition["total_carbohydrates"] > 50.0
    assert nutrition["total_fat"] > 5.0
    assert nutrition["total_sugar"] > 0
    assert nutrition["total_sodium"] > 0
    assert nutrition["calorie_min"] < nutrition["total_calories"] < nutrition["calorie_max"]
    assert nutrition["uncertainty_calories"] > 0
    assert "Estimated:" in nutrition["formatted_estimate"]
    assert nutrition["confidence_level"] in ["HIGH", "MEDIUM"]
    assert len(nutrition["items"]) == 3

    # Verify per-item normalization details
    chapati_res = next(i for i in nutrition["items"] if "Chapati" in i["food_name"])
    assert chapati_res["gram_weight"] == 80.0
    assert chapati_res["portion_value"] == 2.0
    assert chapati_res["portion_unit"] == "piece"

    dal_res = next(i for i in nutrition["items"] if "Dal" in i["food_name"])
    assert dal_res["gram_weight"] == 157.5  # 150 * 1.05

    # 4. Save Meal Record (POST /api/meals)
    save_payload = {
        "meal_type": "lunch",
        "notes": "Healthy homestyle Indian lunch",
        "items": [
            {
                "food_id": chapati_res["food_id"],
                "food_name": chapati_res["food_name"],
                "serving_count": 0.8,
                "serving_size": 100.0,
                "serving_unit": "g",
                "gram_weight": chapati_res["gram_weight"],
                "calories": chapati_res["calories"],
                "protein": chapati_res["protein"],
                "carbohydrates": chapati_res["carbohydrates"],
                "fat": chapati_res["fat"],
                "fiber": chapati_res["fiber"],
                "sugar": chapati_res["sugar"],
                "sodium": chapati_res["sodium"],
                "uncertainty_pct": chapati_res["uncertainty_pct"],
            },
            {
                "food_id": dal_res["food_id"],
                "food_name": dal_res["food_name"],
                "serving_count": 1.575,
                "serving_size": 100.0,
                "serving_unit": "g",
                "gram_weight": dal_res["gram_weight"],
                "calories": dal_res["calories"],
                "protein": dal_res["protein"],
                "carbohydrates": dal_res["carbohydrates"],
                "fat": dal_res["fat"],
                "fiber": dal_res["fiber"],
                "sugar": dal_res["sugar"],
                "sodium": dal_res["sodium"],
                "uncertainty_pct": dal_res["uncertainty_pct"],
            },
        ],
    }
    create_res = client.post("/api/meals", json=save_payload)
    assert create_res.status_code == 201, f"Meal save failed: {create_res.text}"
    saved_meal = create_res.json()
    meal_id = saved_meal["id"]

    assert saved_meal["meal_type"] == "lunch"
    assert saved_meal["status"] == "confirmed"
    assert saved_meal["total_calories"] > 0
    assert len(saved_meal["items"]) == 2

    # 5. Retrieve Persisted Meal (GET /api/meals/{id})
    get_res = client.get(f"/api/meals/{meal_id}")
    assert get_res.status_code == 200
    retrieved_meal = get_res.json()

    assert retrieved_meal["id"] == meal_id
    assert retrieved_meal["total_calories"] == saved_meal["total_calories"]
    assert retrieved_meal["total_protein"] == saved_meal["total_protein"]
    assert retrieved_meal["total_carbohydrates"] == saved_meal["total_carbohydrates"]
    assert retrieved_meal["total_fat"] == saved_meal["total_fat"]
    assert "Estimated:" in retrieved_meal["formatted_estimate"]
    assert len(retrieved_meal["items"]) == 2
