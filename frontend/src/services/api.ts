import {
  HealthStatus,
  FoodItem,
  FoodAnalysisResponse,
  NutritionBreakdown,
  MealItem,
  Meal,
} from '../types';

const API_BASE = '/api';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = 'API request failed';
    try {
      const data = await res.json();
      errorDetail = data.detail || errorDetail;
    } catch {
      // ignore json parse error
    }
    throw new ApiError(errorDetail, res.status);
  }
  return res.json();
}

export const api = {
  async getHealth(): Promise<HealthStatus> {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return await handleResponse<HealthStatus>(res);
    } catch {
      return {
        status: 'unreachable',
        app: 'NutriLens',
        version: '0.1.0',
        database: 'unreachable',
        ai_provider: 'offline',
        timestamp: new Date().toISOString(),
      };
    }
  },

  async getFoods(query?: string, category?: string): Promise<{ total: number; items: FoodItem[] }> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (category) params.append('category', category);
    params.append('limit', '50');

    const res = await fetch(`${API_BASE}/foods?${params.toString()}`);
    return handleResponse<{ total: number; items: FoodItem[] }>(res);
  },

  async getFoodById(id: number): Promise<FoodItem> {
    const res = await fetch(`${API_BASE}/foods/${id}`);
    return handleResponse<FoodItem>(res);
  },

  async analyzeImage(file: File): Promise<FoodAnalysisResponse> {
    const formData = new FormData();
    formData.append('image', file);

    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<FoodAnalysisResponse>(res);
  },

  async calculateNutrition(items: MealItem[]): Promise<NutritionBreakdown> {
    const formattedItems = items.map((i) => ({
      food_id: i.food_id,
      food_name: i.food_name,
      portion_value: Number(i.portion_value ?? (i.serving_size * i.serving_count)) || 100,
      portion_unit: i.portion_unit || i.serving_unit || 'g',
      is_exact_weight: i.confidence_level === 'HIGH',
      confidence_score: i.confidence_score,
    }));

    try {
      const res = await fetch(`${API_BASE}/nutrition/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: formattedItems }),
      });
      return await handleResponse<NutritionBreakdown>(res);
    } catch {
      // Fallback to legacy calculation endpoint
      const res = await fetch(`${API_BASE}/meals/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      return await handleResponse<NutritionBreakdown>(res);
    }
  },

  async saveMeal(meal: {
    meal_type: string;
    notes?: string;
    image_url?: string;
    items: MealItem[];
  }): Promise<Meal> {
    const res = await fetch(`${API_BASE}/meals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(meal),
    });
    return handleResponse<Meal>(res);
  },

  async getMeal(mealId: string): Promise<Meal> {
    const res = await fetch(`${API_BASE}/meals/${mealId}`);
    return handleResponse<Meal>(res);
  },
};
