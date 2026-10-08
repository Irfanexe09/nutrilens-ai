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
  piece_weight_g?: number | null;
  density_g_per_ml?: number | null;
  allowed_units?: string;
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
  data_source?: string;
}

export interface EstimatedPortion {
  value: number;
  unit: string;
  display_text?: string;
}

export interface DetectedFoodItem {
  id?: string;
  name: string;
  estimated_portion: EstimatedPortion;
  confidence: number;
  description?: string;
  ingredients?: string[];
  uncertainties?: string[];
  matched_food_id?: number;
}

export interface FoodAnalysisData {
  foods: DetectedFoodItem[];
  overall_confidence: number;
  uncertainties: string[];
}

export interface FoodAnalysisResponse {
  meal_id: string;
  status: 'success' | 'pending' | 'error';
  analysis: FoodAnalysisData;
  foods?: DetectedFoodItem[];
  overall_confidence?: number;
  uncertainties?: string[];
  notice: string;
  image_metadata?: {
    original_filename?: string;
    stored_filename?: string;
    size_bytes?: number;
    dimensions?: string;
    content_type?: string;
    relative_url?: string;
  };
  provider?: string;
  duration_ms?: number;
}

export interface MealItem {
  food_id?: number;
  food_name: string;
  serving_count: number;
  serving_size: number;
  serving_unit: string;
  gram_weight?: number;
  portion_value?: number;
  portion_unit?: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  sugar?: number;
  sodium?: number;
  confidence_score?: number | null;
  confidence_level?: string;
  uncertainty_pct: number;
  conversion_notes?: string;
}

export interface ItemNutritionCalculationResult {
  food_id?: number;
  food_name: string;
  category: string;
  portion_value: number;
  portion_unit: string;
  gram_weight: number;
  scaling_factor: number;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  calorie_min: number;
  calorie_max: number;
  uncertainty_calories: number;
  uncertainty_pct: number;
  confidence_level: 'HIGH' | 'MEDIUM' | 'LOW';
  data_source: string;
  conversion_notes: string;
}

export interface NutritionBreakdown {
  total_calories: number;
  total_protein: number;
  total_carbohydrates: number;
  total_fat: number;
  total_fiber: number;
  total_sugar?: number;
  total_sodium?: number;
  calorie_min: number;
  calorie_max: number;
  uncertainty_calories: number;
  confidence_level?: 'HIGH' | 'MEDIUM' | 'LOW';
  uncertainty_explanation?: string;
  formatted_estimate: string;
  macro_distribution: {
    protein_pct: number;
    carbohydrates_pct: number;
    fat_pct: number;
  };
  items?: ItemNutritionCalculationResult[];
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
  total_sugar?: number;
  total_sodium?: number;
  uncertainty_calories: number;
  confidence_level?: string;
  formatted_estimate?: string;
  notes?: string;
  items: MealItem[];
  created_at?: string;
}

export type OptimizationGoal = 'weight_loss' | 'muscle_gain' | 'balanced';

// Phase 4: Personalization & Daily Nutrition Target Types
export type Sex = 'MALE' | 'FEMALE';

export type ActivityLevel =
  | 'SEDENTARY'
  | 'LIGHTLY_ACTIVE'
  | 'MODERATELY_ACTIVE'
  | 'VERY_ACTIVE'
  | 'EXTRA_ACTIVE';

export type UserGoal =
  | 'WEIGHT_LOSS'
  | 'MAINTENANCE'
  | 'WEIGHT_GAIN'
  | 'MUSCLE_GAIN'
  | 'GENERAL_HEALTH';

export interface User {
  id: string;
  email: string;
  name?: string;
  created_at?: string;
}

export interface UserProfile {
  id?: string;
  user_id?: string;
  name?: string;
  age: number;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  activity_level: ActivityLevel;
  goal: UserGoal;
}

export interface DailyNutritionTarget {
  bmr: number;
  tdee: number;
  calorie_target: number;
  protein_target_g: number;
  carbohydrates_target_g: number;
  fat_target_g: number;
  fiber_target_g: number;
  safety_warning?: string | null;
  disclaimer: string;
  is_active?: boolean;
}

export interface ProfileWithTarget {
  profile: UserProfile;
  targets: DailyNutritionTarget;
}

export interface DailyNutritionResponse {
  date: string;
  target: {
    calorie_target: number;
    protein_target_g: number;
    carbohydrates_target_g: number;
    fat_target_g: number;
    fiber_target_g: number;
    has_custom_target: boolean;
    safety_warning?: string | null;
    disclaimer: string;
  };
  consumed: {
    calories: number;
    protein_g: number;
    carbohydrates_g: number;
    fat_g: number;
    fiber_g: number;
  };
  remaining: {
    calories: number;
    protein_g: number;
    carbohydrates_g: number;
    fat_g: number;
    fiber_g: number;
  };
  overage: {
    calories: number;
    is_over_target: boolean;
    status_message: string;
  };
  percentages: {
    calories: number;
    protein: number;
    carbohydrates: number;
    fat: number;
    fiber: number;
  };
  meals: {
    id: string;
    meal_type: string;
    image_url?: string;
    created_at?: string;
    calories: number;
    protein: number;
    carbohydrates: number;
    fat: number;
    fiber: number;
    formatted_estimate: string;
    item_count: number;
  }[];
  meal_count: number;
}

export interface EvaluateMealResponse {
  meal_calories: number;
  remaining_calories_before_meal: number;
  remaining_calories_after_meal: number;
  fits_remaining_budget: boolean;
  insights: string[];
}

