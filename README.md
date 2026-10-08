# NutriLens — AI Food & Nutrition Intelligence Platform

> **"See your food. Understand your nutrition."**
> A portfolio-grade multimodal food analysis and deterministic nutrition intelligence system with deep Indian cuisine specialization.

[![Python](https://img.shields.io/badge/Python-3.12%20%7C%203.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/Tests-67%20Passed-brightgreen.svg)]()

---

## 🍽️ Executive Summary

Most consumer "AI calorie detectors" suffer from a critical flaw: they prompt a Vision-Language Model to hallucinate arbitrary calorie numbers (e.g. *"This bowl has 687 calories"*). This creates dangerous inaccuracies, zero explainability, and no concept of variance.

**NutriLens rejects this paradigm.**

Instead of hallucinating calories, NutriLens decouples the problem into **four isolated, rigorous stages**:
1. **Multimodal Food Identification**: Classifies candidate dishes from photography without inventing macronutrients.
2. **Volumetric & Portion Estimation**: Estimates serving sizes while requesting user confirmation.
3. **Deterministic Nutrition Engine**: Computes exact macronutrients mathematically against a verified nutritional database and computes honest statistical uncertainty bounds ($\pm 10\text{--}15\%$).
4. **Contextual Meal Optimizer**: Generates goal-oriented dietary improvements (e.g., Weight Loss, Muscle Synthesis, Metabolic Balance) with transparent simulated scenarios.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    User([User Food Photo]) -->|Upload / Capture| API[FastAPI /api/analyze]
    
    subgraph Layer1 [1. Visual Intelligence]
        API --> AIProv[AIProvider Interface]
        AIProv -.->|Phase 1| Placeholder[PlaceholderAIProvider Contract]
        AIProv -.->|Phase 2| Gemini[Gemini Multimodal / YOLOv8]
    end

    subgraph Layer2 [2. Human-in-the-Loop Audit]
        Placeholder --> ConfirmUI[Portion & Item Confirmation UI]
        ConfirmUI -->|Adjust 0.25x - 3.0x| PortionState[User-Audited Servings]
    end

    subgraph Layer3 [3. Deterministic Engine]
        PortionState --> CalcAPI[/api/meals/calculate]
        CalcAPI --> Engine[NutritionEngine]
        FoodDB[(PostgreSQL / Food Database)] --> Engine
        Engine --> Summary[Deterministic Totals + Uncertainty Interval]
    end

    subgraph Layer4 [4. Meal Optimizer]
        Summary --> Optimizer[Goal-Based Optimizer Engine]
        Optimizer --> Recommendations[Suggested Portions & Macro Delta]
    end

    Summary --> DB[(PostgreSQL Meals & Items)]
```

---

## 🥘 Indian Food Domain Specialization

Indian cuisine features unique culinary complexities—ghee absorption, deep-fried spices, variable water content in dals, and complex gravies. NutriLens is seeded out-of-the-box with authentic regional dishes:

* **Rice Dishes**: Chicken Biryani, Mutton Biryani, Veg Biryani, Curd Rice, Veg Pulao, Egg Fried Rice, Steamed Basmati
* **South Indian**: Masala Dosa, Plain Dosa, Idli (steamed), Medu Vada, Sambar, Ven Pongal, Upma
* **Breads & Curries**: Chapati / Roti, Aloo Paratha, Dal Tadka, Rajma Masala, Chole, Paneer Butter Masala, Palak Paneer, Chicken Curry, Mutton Rogan Josh
* **Breakfasts & Snacks**: Poha, Cucumber Raita, Samosa, Gulab Jamun

Each dish features verified macro profiles per reference serving, with custom variance tolerances (`uncertainty_pct`) reflecting real-world cooking variance.

---

## 🚀 Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons | Clean, responsive, mobile-first health-tech UI with accessible contrast |
| **Backend** | Python 3.12+, FastAPI, Pydantic v2 | High-performance asynchronous API with strict schema validation |
| **ORM & Migrations** | SQLAlchemy 2.0, Alembic | Enterprise database modeling and schema migrations |
| **Database** | PostgreSQL 16 (SQLite dev fallback) | Relational integrity with cascade relations across meals and items |
| **AI Abstraction** | Decoupled `AIProvider` ABC | Enables swapping between Gemini, YOLO, OpenAI, or PyTorch models |
| **Containerization** | Docker, Docker Compose, Nginx | Production-ready multi-stage builds with reverse proxy |

---

## 📁 Repository Structure

```
nutrilens/
├── backend/
│   ├── alembic/              # Alembic database migration scripts
│   ├── app/
│   │   ├── api/v1/           # API endpoints (health, foods, meals, analyze)
│   │   ├── core/             # Pydantic settings & application configuration
│   │   ├── database/         # SQLAlchemy engine, session maker, base
│   │   ├── models/           # Declarative models (FoodItem, Meal, MealItem)
│   │   ├── schemas/          # Pydantic v2 request & response schemas
│   │   ├── nutrition/        # Deterministic NutritionEngine & portion scaler
│   │   ├── ai/               # AIProvider interface & placeholder implementation
│   │   ├── repositories/     # Database query layer & seed loader
│   │   ├── services/         # Application business logic
│   │   └── main.py           # FastAPI application entrypoint & lifespan
│   ├── tests/                # Pytest test suite (17 automated tests)
│   ├── uploads/              # Validated user image uploads
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile            # Production backend Docker image
│   └── pytest.ini            # Test runner configuration
├── frontend/
│   ├── src/
│   │   ├── components/       # Navbar, Hero, ScanFood, AnalysisResult, FoodCatalog, Footer
│   │   ├── services/         # Typed API client
│   │   ├── types/            # TypeScript interfaces
│   │   ├── App.tsx           # Primary application view orchestrator
│   │   ├── main.tsx          # React DOM entrypoint
│   │   └── index.css         # Tailwind directives & design tokens
│   ├── package.json          # Frontend dependencies & build scripts
│   ├── vite.config.ts        # Vite configuration with /api reverse proxy
│   ├── tailwind.config.js    # Health-tech color palette & typography
│   ├── Dockerfile            # Production frontend Docker image (Nginx)
│   └── nginx.conf            # Nginx reverse proxy configuration
├── data/
│   └── nutrition/            # indian_foods_seed.json (verified Indian dishes)
├── docs/
│   └── ARCHITECTURE.md       # Deep technical architecture & mathematical formulation
├── docker/                   # Nginx & deployment assets
├── docker-compose.yml        # Orchestration for PostgreSQL + Backend + Frontend
├── .env.example              # Environment variable template
├── .gitignore                # Comprehensive ignore rules
└── README.md
```

---

## ⚡ Quickstart & Local Setup

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- Git

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```

The backend starts at `http://localhost:8000`.
Interactive Swagger API Documentation is available at `http://localhost:8000/docs`.

### 2. Frontend Setup

```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

The frontend interface will open at `http://localhost:5173`.

---

## 🐳 Docker Deployment

To spin up the complete production-ready stack (PostgreSQL + FastAPI + React + Nginx):

```bash
docker-compose up --build
```

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:8000`
- **PostgreSQL**: `localhost:5432`

---

## 🧪 Automated Test Suite

NutriLens includes comprehensive automated test coverage for health endpoints, deterministic calculations, Indian food catalogs, and image upload validation.

Run the test suite:

```bash
cd backend
source venv/bin/activate
pytest -v
```

```
============================== test session starts ==============================
tests/test_analyze_api.py::test_analyze_valid_image PASSED               [  5%]
tests/test_analyze_api.py::test_analyze_unsupported_media_type PASSED    [ 11%]
tests/test_analyze_api.py::test_analyze_empty_file PASSED                [ 17%]
tests/test_analyze_api.py::test_analyze_corrupted_image PASSED           [ 23%]
tests/test_foods_api.py::test_list_foods_seeded PASSED                   [ 29%]
tests/test_foods_api.py::test_search_foods_by_query PASSED               [ 35%]
tests/test_foods_api.py::test_get_food_by_id PASSED                      [ 41%]
tests/test_foods_api.py::test_get_nonexistent_food_returns_404 PASSED    [ 47%]
tests/test_foods_api.py::test_create_custom_food PASSED                  [ 52%]
tests/test_health.py::test_root_endpoint PASSED                          [ 58%]
tests/test_health.py::test_health_endpoint PASSED                        [ 64%]
tests/test_meals_api.py::test_calculate_meal_preview PASSED              [ 70%]
tests/test_meals_api.py::test_create_and_get_meal PASSED                 [ 76%]
tests/test_meals_api.py::test_get_nonexistent_meal PASSED                [ 82%]
tests/test_nutrition_engine.py::test_single_item_deterministic_calculation PASSED [ 88%]
tests/test_nutrition_engine.py::test_composite_meal_nutrition_and_uncertainty PASSED [ 94%]
tests/test_nutrition_engine.py::test_determinism_across_multiple_runs PASSED [100%]
============================== 17 passed in 0.11s ===============================
```

---

## 🔌 API Reference Overview

### Health
- `GET /api/health` — Checks database connectivity, returns status and configured AI provider.

### Authentication & Profiles (Phase 4)
- `POST /api/auth/register` — Register new user with email and secure hashed password.
- `POST /api/auth/login` — Authenticate and receive JWT bearer token.
- `GET /api/profile` — Fetch authenticated user profile, BMR, TDEE, and daily macro targets.
- `PUT /api/profile` — Update body metrics, activity level, and goal (automatically recomputes targets).
- `GET /api/profile/daily-summary` — Real-time progress toward daily caloric and macro budgets.
- `POST /api/profile/evaluate-meal` — Pre-flight evaluation of candidate meal against remaining budget.

### Food Intelligence Database
- `GET /api/foods` — Search and filter foods with parameters `q`, `category`, `is_indian`, `skip`, `limit`.
- `GET /api/foods/{id}` — Fetch detailed macro breakdown and recipe variance for a food.
- `POST /api/foods` — Add a new verified food item to the catalog.

### Nutrition Calculation & Meals (Phase 3)
- `POST /api/nutrition/calculate` — Deterministically computes macros, Atwater distribution, and uncertainty interval without saving.
- `POST /api/meals` — Persists a user-confirmed meal and its constituent items.
- `GET /api/meals/{id}` — Fetches recorded meal with formatted honest estimation string.
- `GET /api/meals` — Lists recorded meals with pagination and daily aggregation.

### AI Meal Optimizer (Phase 5)
- `POST /api/meals/{id}/optimize` — Analyzes meal against user profile/goals, runs deterministic candidate generator, scores options, and attaches grounded AI explanations.
- `POST /api/meals/{id}/apply-optimization` — Implements selected recommendation by creating a versioned child meal linked via `parent_meal_id`, keeping original intact.

### Visual Analysis Pipeline (Phase 2)
- `POST /api/analyze` — Multipart image upload (`image`). Multimodal vision analysis identifying dishes and estimating portions with confidence ratings without hallucinating calories.

---

## 🧠 Phase 5 — AI Meal Optimizer Architecture

The Meal Optimizer solves the user question: *"How can I improve this meal for my goal?"*

```
Current Meal
     │
     ▼
Deterministic Nutrition Engine (Truth Baseline)
     │
     ▼
User Profile & Daily Macro Budget Target
     │
     ▼
Optimization Rules & Issue Detection (e.g. HIGH_CALORIE, LOW_PROTEIN, LOW_FIBER)
     │
     ▼
Candidate Generator (Deterministic Alterations: -25% Carbs, +Protein, +Fiber Raita)
     │
     ▼
Nutrition Recalculation Engine (Pure Math — Zero LLM Arithmetic)
     │
     ▼
Candidate Scorer (0.40 × Goal + 0.30 × Budget + 0.30 × Practicality)
     │
     ▼
AI Explanation Layer (Grounded, Factual Context — No Numbers Invented)
     │
     ▼
Versioned Persistence (Child Meal Linked to Parent Meal — Auditability Preserved)
```

### 1. Architectural Guardrails: The LLM Does Not Do Arithmetic
- The LLM never calculates calories, proteins, carbs, or fats.
- The LLM never invents food database records or serving ratios.
- The backend owns all numeric calculations deterministically through `NutritionCalculationService`.

### 2. Candidate Generation Strategies Across Goals
- **Weight Loss (`WEIGHT_LOSS`)**: Moderates calorie-dense staples by 20–30% (e.g., cutting biryani rice or fried components) and suggests pairing low-calorie fiber/raita.
- **Muscle Gain (`MUSCLE_GAIN`)**: Boosts lean protein portions (e.g., +100g grilled tandoori chicken or +100g paneer) while moderating excess fats.
- **Maintenance / General Health (`MAINTENANCE`, `GENERAL_HEALTH`)**: Creates balanced composites with balanced macronutrient distributions and boosts dietary fiber.
- **Weight Gain (`WEIGHT_GAIN`)**: Recommends healthy, nutrient-dense caloric surpluses (e.g., whole grain roti, curd, healthy fats).

### 3. Transparent Scoring Methodology
Each candidate modification is scored on a normalized scale ($0.0 \dots 1.0$):
$$\text{Total Score} = 0.40 \times \text{Goal Alignment} + 0.30 \times \text{Daily Budget Fit} + 0.30 \times \text{Practicality}$$

- **Goal Alignment (40%)**: Rewards caloric direction aligned with goal (deficit for weight loss, surplus for weight gain, protein density for muscle gain).
- **Daily Budget Fit (30%)**: Scores how well the meal fits into the user's remaining daily allowance.
- **Practicality (30%)**: Heavy penalty on extreme changes (cutting $>50\%$ of a staple is penalized for poor satiety and sustainability).

### 4. Grounded AI Explanation Layer
Explanations are generated via `explain_meal_optimization` in `AIProvider`. The LLM receives the pre-calculated, verified numbers and provides human-readable context on why the substitution supports the user's metabolism without inventing new figures.

### 5. Versioned Meal Persistence
When a user clicks **"Apply Suggestion"**:
1. The original meal is **never overwritten or deleted**.
2. A new `Meal` row is created with `parent_meal_id = original_meal.id`, `is_optimized_version = True`, and descriptive `optimization_notes`.
3. Complete auditability and historical tracking are preserved.
4. User authorization is enforced: users can only optimize and mutate their own meals.

---

## ⚕️ Nutrition & Health Disclaimer

> **IMPORTANT**: NutriLens is an educational and lifestyle nutrition estimation system. Calculated Basal Metabolic Rates (BMR), Total Daily Energy Expenditures (TDEE), and meal optimization recommendations are **estimates based on population averages** (Mifflin-St Jeor equation and verified reference databases) and do **not** constitute medical advice, clinical dietary prescriptions, or medical treatment plans. Always consult a certified dietitian or physician for clinical dietary requirements.

---

## 🗺️ Roadmap & Phase Progression

- [x] **Phase 1: Foundation (Completed)**
  - Decoupled full-stack monorepo architecture
  - Deterministic Nutrition Calculation Engine with Atwater verification
  - Root-sum-square portion uncertainty modeling ($\pm 10\text{--}15\%$)
  - Swappable `AIProvider` abstraction layer
  - Seeded database of 27+ authentic Indian dishes
  - Reusable Result UI with interactive portion adjuster
  - Docker Compose orchestration & PostgreSQL Alembic migrations
  - 17 automated tests passing
- [x] **Phase 2: Real AI Food Analysis (Completed)**
  - Extended `AIProvider` abstraction with `GeminiVisionAIProvider` (Google Gemini Multimodal Vision)
  - Dedicated system prompt engineering tailored for visual recognition and regional Indian cuisine
  - Conservative portion estimation (no false precision)
  - Detection of visual uncertainties (hidden oils, gravies, seasonings)
  - Reusable `FoodConfirmation` review interface with edit, remove, and add capabilities
  - Complete separation: AI identifies food & portions; nutrition calculation deferred to Phase 3
  - 30 automated unit, integration, and E2E tests passing
- [x] **Phase 3: Nutrition Intelligence Engine (Completed)**
  - Programmatic, deterministic Nutrition Calculation Engine (`NutritionCalculationService`)
  - Reference serving scaling (100g basis, piece-based, milliliter liquid density)
  - Macronutrient Atwater distribution and honest uncertainty intervals
  - 41 automated tests passing
- [x] **Phase 4: Personalization & Daily Nutrition Intelligence (Completed)**
  - User profiles with age, sex, height, weight, activity level, and goals
  - Validated Mifflin-St Jeor BMR and Katch-McArdle TDEE calculations
  - Calorie floors (1,200 kcal women / 1,500 kcal men) and safety guardrails
  - JWT authentication and secure user data isolation
  - Daily aggregated progress tracking and pre-flight meal budget evaluation
  - 59 automated tests passing
- [x] **Phase 5: AI Meal Optimizer (Completed)**
  - Objective meal imbalance detection (`MealIssueAnalyzer`)
  - Multi-candidate generator with verified database substitutions
  - Deterministic recalculation pipeline with zero LLM arithmetic
  - Normalized scoring algorithm ($0.40 \times \text{Goal} + 0.30 \times \text{Budget} + 0.30 \times \text{Practicality}$)
  - Grounded AI explanation layer via `explain_meal_optimization`
  - Versioned meal persistence with `parent_meal_id` linking
  - Interactive Before/After comparison modal with honest uncertainty
  - 67 automated unit, integration, and security tests passing
