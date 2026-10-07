export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unreachable';
  app: string;
  version: string;
  database: string;
  ai_provider: string;
  timestamp: string;
}

export interface FoodItem {
  id: number;
  name: string;
  local_name?: string;
  category: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  is_indian_dish: boolean;
  uncertainty_pct: number;
  description?: string;
}

export interface MealItem {
  food_id?: number;
  food_name: string;
  serving_count: number;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  confidence_score?: number | null;
  uncertainty_pct: number;
}

export interface NutritionBreakdown {
  total_calories: number;
  total_protein: number;
  total_carbohydrates: number;
  total_fat: number;
  total_fiber: number;
  calorie_min: number;
  calorie_max: number;
  uncertainty_calories: number;
  formatted_estimate: string;
  macro_distribution: {
    protein_pct: number;
    carbohydrates_pct: number;
    fat_pct: number;
  };
}

export interface FoodAnalysisResponse {
  meal_id: string;
  status: 'pending' | 'completed' | 'placeholder';
  foods: Array<{
    name: string;
    confidence: number;
    matched_food_id?: number;
    suggested_serving_size?: number;
    suggested_serving_unit?: number;
  }>;
  nutrition: NutritionBreakdown | null;
  confidence: number | null;
  recommendations: string[];
  notice: string;
  image_metadata?: {
    original_filename?: string;
    stored_filename?: string;
    size_bytes?: number;
    dimensions?: string;
    content_type?: string;
    relative_url?: string;
  };
}

export interface Meal {
  id: string;
  user_id?: string;
  image_url?: string;
  status: string;
  meal_type: string;
  total_calories: number;
  total_protein: number;
  total_carbohydrates: number;
  total_fat: number;
  total_fiber: number;
  uncertainty_calories: number;
  formatted_estimate?: string;
  notes?: string;
  items: MealItem[];
  created_at?: string;
}

export type OptimizationGoal = 'weight_loss' | 'muscle_gain' | 'balanced';
