import {
  HealthStatus,
  FoodItem,
  FoodAnalysisResponse,
  NutritionBreakdown,
  MealItem,
  Meal,
  User,
  UserProfile,
  DailyNutritionTarget,
  ProfileWithTarget,
  DailyNutritionResponse,
  EvaluateMealResponse,
  MealOptimizationResponse,
  CandidateItem,
  WeeklyAnalyticsResponse,
  MealFilterParams,
} from '../types';

const API_BASE = '/api';
const TOKEN_KEY = 'nutrilens_auth_token';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
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
  // Token Helpers
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  },

  // Auth
  async register(email: string, password: string, name?: string): Promise<{ access_token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    const data = await handleResponse<{ access_token: string; user: User }>(res);
    this.setToken(data.access_token);
    return data;
  },

  async login(email: string, password: string): Promise<{ access_token: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse<{ access_token: string; user: User }>(res);
    this.setToken(data.access_token);
    return data;
  },

  async getMe(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<User>(res);
  },

  // Profile & Targets
  async getProfile(): Promise<ProfileWithTarget> {
    const res = await fetch(`${API_BASE}/profile`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<ProfileWithTarget>(res);
  },

  async updateProfile(profileData: Partial<UserProfile>): Promise<ProfileWithTarget> {
    const res = await fetch(`${API_BASE}/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(profileData),
    });
    return handleResponse<ProfileWithTarget>(res);
  },

  async getTargets(): Promise<DailyNutritionTarget> {
    const res = await fetch(`${API_BASE}/profile/targets`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<DailyNutritionTarget>(res);
  },

  // Daily Nutrition Tracking
  async getDailyNutrition(targetDate?: string, tzOffsetMinutes?: number): Promise<DailyNutritionResponse> {
    const params = new URLSearchParams();
    if (targetDate) params.append('target_date', targetDate);
    const offset = tzOffsetMinutes !== undefined ? tzOffsetMinutes : new Date().getTimezoneOffset();
    params.append('tz_offset_minutes', offset.toString());

    const res = await fetch(`${API_BASE}/daily-nutrition?${params.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<DailyNutritionResponse>(res);
  },

  async getWeeklyAnalytics(
    endDate?: string,
    days: number = 7,
    tzOffsetMinutes?: number
  ): Promise<WeeklyAnalyticsResponse> {
    const params = new URLSearchParams();
    if (endDate) params.append('end_date', endDate);
    params.append('days', days.toString());
    const offset = tzOffsetMinutes !== undefined ? tzOffsetMinutes : new Date().getTimezoneOffset();
    params.append('tz_offset_minutes', offset.toString());

    const res = await fetch(`${API_BASE}/daily-nutrition/weekly?${params.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<WeeklyAnalyticsResponse>(res);
  },

  async evaluateMeal(data: {
    meal_calories: number;
    meal_protein: number;
    meal_carbs: number;
    meal_fat: number;
    meal_fiber: number;
  }): Promise<EvaluateMealResponse> {
    const res = await fetch(`${API_BASE}/daily-nutrition/evaluate-meal`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    return handleResponse<EvaluateMealResponse>(res);
  },

  // System & Foods
  async getHealth(): Promise<HealthStatus> {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return await handleResponse<HealthStatus>(res);
    } catch {
      return {
        status: 'unreachable',
        app: 'NutriLens',
        version: '0.2.0',
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
      headers: { ...getAuthHeader() },
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
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ items: formattedItems }),
      });
      return await handleResponse<NutritionBreakdown>(res);
    } catch {
      const res = await fetch(`${API_BASE}/meals/calculate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
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
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(meal),
    });
    return handleResponse<Meal>(res);
  },

  async getMeal(mealId: string): Promise<Meal> {
    const res = await fetch(`${API_BASE}/meals/${mealId}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<Meal>(res);
  },

  async getMeals(
    skip: number = 0,
    limit: number = 20,
    filters?: MealFilterParams
  ): Promise<{ total: number; meals: Meal[] }> {
    const params = new URLSearchParams();
    params.append('skip', skip.toString());
    params.append('limit', limit.toString());
    if (filters?.meal_type) params.append('meal_type', filters.meal_type);
    if (filters?.date) params.append('date', filters.date);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.is_optimized_version !== undefined) {
      params.append('is_optimized_version', filters.is_optimized_version.toString());
    }
    const offset = filters?.tz_offset_minutes !== undefined ? filters.tz_offset_minutes : new Date().getTimezoneOffset();
    params.append('tz_offset_minutes', offset.toString());

    const res = await fetch(`${API_BASE}/meals?${params.toString()}`, {
      headers: { ...getAuthHeader() },
    });
    return handleResponse<{ total: number; meals: Meal[] }>(res);
  },

  async optimizeMeal(mealId: string, goal?: string): Promise<MealOptimizationResponse> {
    const params = new URLSearchParams();
    if (goal) params.append('goal', goal);

    const res = await fetch(`${API_BASE}/meals/${mealId}/optimize?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });
    return handleResponse<MealOptimizationResponse>(res);
  },

  async applyOptimization(
    mealId: string,
    data: { recommendation_id?: string; notes?: string; items: CandidateItem[] }
  ): Promise<Meal> {
    const res = await fetch(`${API_BASE}/meals/${mealId}/apply-optimization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(data),
    });
    return handleResponse<Meal>(res);
  },
};
