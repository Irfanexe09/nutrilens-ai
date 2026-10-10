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
  parent_meal_id?: string | null;
  is_optimized_version?: boolean;
  optimization_notes?: string | null;
  items?: MealItem[];
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

export interface DailyMealItem {
  id: string;
  meal_type: string;
  image_url?: string;
  created_at?: string;
  time_logged?: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  formatted_estimate: string;
  item_count: number;
  food_names?: string[];
  parent_meal_id?: string | null;
  is_optimized_version?: boolean;
  optimization_notes?: string | null;
  notes?: string | null;
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
  meals: DailyMealItem[];
  meal_count: number;
  data_completeness?: 'UNLOGGED' | 'PARTIAL' | 'LOGGED';
  timeline?: {
    breakfast: DailyMealItem[];
    lunch: DailyMealItem[];
    dinner: DailyMealItem[];
    snack: DailyMealItem[];
  };
}

// Phase 6: Weekly Analytics & History Types
export interface DayAnalyticsItem {
  date: string;
  day_name: string;
  has_logs: boolean;
  data_completeness: 'UNLOGGED' | 'PARTIAL' | 'LOGGED';
  meal_count: number;
  calories: number | null;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  fiber: number | null;
  calorie_target: number;
  protein_target: number;
  is_over_calorie_target: boolean;
  overage_calories: number;
  calorie_percentage: number;
  protein_target_met: boolean;
}

export interface PeriodComparisonSummary {
  has_comparison: boolean;
  prev_period_logged_days: number;
  prev_period_average_calories: number | null;
  calorie_difference: number | null;
  percent_change: number | null;
  message: string | null;
}

export interface WeeklyTrendInsights {
  logged_days_count: number;
  total_days: number;
  average_calories_logged_days: number | null;
  average_protein_logged_days: number | null;
  average_carbs_logged_days: number | null;
  average_fat_logged_days: number | null;
  average_fiber_logged_days: number | null;
  protein_target_met_days: number;
  highest_calorie_day: { date: string; calories: number } | null;
  lowest_calorie_day: { date: string; calories: number } | null;
  previous_period_comparison?: PeriodComparisonSummary | null;
  insights_statements: string[];
  disclaimer: string;
}

export interface WeeklyAnalyticsResponse {
  start_date: string;
  end_date: string;
  days: DayAnalyticsItem[];
  insights: WeeklyTrendInsights;
}

export interface MealFilterParams {
  meal_type?: string;
  date?: string;
  start_date?: string;
  end_date?: string;
  is_optimized_version?: boolean;
  tz_offset_minutes?: number;
}

export interface EvaluateMealResponse {
  meal_calories: number;
  remaining_calories_before_meal: number;
  remaining_calories_after_meal: number;
  fits_remaining_budget: boolean;
  insights: string[];
}

// Phase 5: AI Meal Optimizer Types
export type MealIssue =
  | 'HIGH_CALORIE'
  | 'LOW_PROTEIN'
  | 'LOW_FIBER'
  | 'HIGH_FAT'
  | 'HIGH_SODIUM'
  | 'HIGH_SUGAR';

export type ModificationType =
  | 'REDUCE_PORTION'
  | 'INCREASE_PORTION'
  | 'ADD_FOOD'
  | 'REMOVE_FOOD'
  | 'REPLACE_FOOD';

export interface MealModification {
  type: ModificationType;
  food_id?: number | null;
  food_name: string;
  original_portion?: number | null;
  new_portion?: number | null;
  unit: string;
  percentage?: number | null;
  reason: string;
}

export interface NutritionSnapshot {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  sugar?: number;
  sodium?: number;
  calorie_min?: number;
  calorie_max?: number;
  uncertainty_calories?: number;
  confidence_level?: string;
  formatted_estimate: string;
}

export interface CandidateItem {
  food_id?: number | null;
  food_name: string;
  portion_value: number;
  portion_unit: string;
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  fiber: number;
  sugar?: number;
  sodium?: number;
  confidence_score?: number | null;
  uncertainty_pct?: number;
}

export interface OptimizationRecommendation {
  id: string;
  title: string;
  description: string;
  changes: string[];
  modifications: MealModification[];
  original_nutrition: NutritionSnapshot;
  optimized_nutrition: NutritionSnapshot;
  calorie_delta: number;
  protein_delta: number;
  fiber_delta: number;
  score: number;
  confidence: string;
  explanation: string;
  items: CandidateItem[];
}

export interface MealOptimizationResponse {
  meal_id: string;
  goal: string;
  issues: MealIssue[];
  status_summary: string;
  recommendations: OptimizationRecommendation[];
}


