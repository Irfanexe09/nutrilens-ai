import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle,
  Trash2,
  BookmarkCheck,
  ChevronRight,
  Info,
  Loader2,
  Target,
  X,
  Check,
} from 'lucide-react';
import {
  MealItem,
  NutritionBreakdown,
  FoodItem,
  OptimizationGoal,
  EvaluateMealResponse,
  MealOptimizationResponse,
  OptimizationRecommendation,
} from '../types';
import { api } from '../services/api';

interface AnalysisResultProps {
  initialItems: MealItem[];
  previewImageUrl?: string;
  isDemo?: boolean;
  onScanAnother: () => void;
  availableFoods: FoodItem[];
}

export const AnalysisResult: React.FC<AnalysisResultProps> = ({
  initialItems,
  previewImageUrl,
  isDemo = false,
  onScanAnother,
  availableFoods,
}) => {
  const [items, setItems] = useState<MealItem[]>(initialItems);
  const [nutrition, setNutrition] = useState<NutritionBreakdown | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<OptimizationGoal>('weight_loss');
  const [selectedMealType, setSelectedMealType] = useState<string>('lunch');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedMealId, setSavedMealId] = useState<string | null>(null);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<EvaluateMealResponse | null>(null);

  // Phase 5: Optimizer State
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [optimizationData, setOptimizationData] = useState<MealOptimizationResponse | null>(null);
  const [activeRecommendation, setActiveRecommendation] = useState<OptimizationRecommendation | null>(null);
  const [appliedNotice, setAppliedNotice] = useState<string | null>(null);

  // Recalculate deterministic nutrition whenever meal items change
  const recalculateNutrition = async (currentItems: MealItem[]) => {
    if (currentItems.length === 0) {
      setNutrition(null);
      setEvaluation(null);
      return;
    }
    setIsRecalculating(true);
    try {
      const result = await api.calculateNutrition(currentItems);
      setNutrition(result);

      // Evaluate candidate meal against personalized daily budget if token exists
      if (api.getToken()) {
        api
          .evaluateMeal({
            meal_calories: result.total_calories,
            meal_protein: result.total_protein,
            meal_carbs: result.total_carbohydrates,
            meal_fat: result.total_fat,
            meal_fiber: result.total_fiber,
          })
          .then((evalRes) => setEvaluation(evalRes))
          .catch(() => {});
      }
    } catch (err) {
      console.error('Failed to calculate nutrition:', err);
    } finally {
      setIsRecalculating(false);
    }
  };

  useEffect(() => {
    recalculateNutrition(items);
  }, []);

  const handleServingChange = (index: number, newCount: number) => {
    const updated = [...items];
    const clamped = Math.max(0.25, Math.min(5.0, Number(newCount.toFixed(2))));
    const prevServingSize = updated[index].serving_size || 100;
    updated[index] = {
      ...updated[index],
      serving_count: clamped,
      portion_value: Number((prevServingSize * clamped).toFixed(1)),
      gram_weight: Number((prevServingSize * clamped).toFixed(1)),
    };
    setItems(updated);
    recalculateNutrition(updated);
    // Invalidate saved ID so re-optimization creates clean state
    setIsSaved(false);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_: MealItem, i: number) => i !== index);
    setItems(updated);
    recalculateNutrition(updated);
    setIsSaved(false);
  };

  const handleAddFoodItem = (food: FoodItem) => {
    const newItem: MealItem = {
      food_id: food.id,
      food_name: food.name,
      serving_count: 1.0,
      serving_size: food.serving_size,
      serving_unit: food.serving_unit,
      portion_value: food.serving_size,
      portion_unit: food.serving_unit,
      gram_weight: food.serving_size,
      calories: food.calories,
      protein: food.protein,
      carbohydrates: food.carbohydrates,
      fat: food.fat,
      fiber: food.fiber,
      sugar: food.sugar,
      sodium: food.sodium,
      confidence_level: 'HIGH',
      uncertainty_pct: food.uncertainty_pct,
    };
    const updated = [...items, newItem];
    setItems(updated);
    recalculateNutrition(updated);
    setIsSaved(false);
  };

  const handleSaveMeal = async () => {
    if (items.length === 0) return;
    try {
      const saved = await api.saveMeal({
        meal_type: selectedMealType,
        notes: isDemo
          ? 'Saved from verified interactive demo'
          : `Scanned meal logged as ${selectedMealType}`,
        image_url: previewImageUrl,
        items,
      });
      setSavedMealId(saved.id);
      setIsSaved(true);
      setSaveSuccessMessage(`Meal successfully recorded as ${selectedMealType}!`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
      return saved.id;
    } catch (err) {
      console.error('Save failed:', err);
      return null;
    }
  };

  // Phase 5: Trigger Optimizer Engine
  const handleTriggerOptimization = async (goalParam?: string) => {
    if (items.length === 0) return;
    setIsOptimizing(true);
    setAppliedNotice(null);

    try {
      let currentMealId = savedMealId;
      if (!currentMealId) {
        // Auto-save meal to establish base record for optimization
        const saved = await api.saveMeal({
          meal_type: selectedMealType,
          notes: isDemo
            ? 'Auto-saved for optimization'
            : `Scanned meal logged as ${selectedMealType}`,
          image_url: previewImageUrl,
          items,
        });
        currentMealId = saved.id;
        setSavedMealId(saved.id);
        setIsSaved(true);
      }

      const activeGoal =
        goalParam ||
        (selectedGoal === 'muscle_gain'
          ? 'MUSCLE_GAIN'
          : selectedGoal === 'balanced'
          ? 'MAINTENANCE'
          : 'WEIGHT_LOSS');

      const res = await api.optimizeMeal(currentMealId, activeGoal);
      setOptimizationData(res);
    } catch (err: any) {
      console.error('Failed to generate meal optimizations:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Phase 5: Apply Selected Optimization
  const handleApplyOptimization = async (rec: OptimizationRecommendation) => {
    if (!savedMealId) return;
    setIsApplying(true);

    try {
      const newMeal = await api.applyOptimization(savedMealId, {
        recommendation_id: rec.id,
        notes: `Applied suggestion: ${rec.title}`,
        items: rec.items,
      });

      // Map applied items back to client state
      const appliedItems: MealItem[] = rec.items.map((it) => ({
        food_id: it.food_id || undefined,
        food_name: it.food_name,
        serving_count: 1.0,
        serving_size: it.portion_value,
        serving_unit: it.portion_unit,
        portion_value: it.portion_value,
        portion_unit: it.portion_unit,
        gram_weight: it.portion_value,
        calories: it.calories,
        protein: it.protein,
        carbohydrates: it.carbohydrates,
        fat: it.fat,
        fiber: it.fiber,
        sugar: it.sugar,
        sodium: it.sodium,
        uncertainty_pct: it.uncertainty_pct || 10.0,
        confidence_level: 'MEDIUM',
      }));

      setItems(appliedItems);
      setSavedMealId(newMeal.id);
      setIsSaved(true);
      setAppliedNotice(
        `Applied "${rec.title}"! A new versioned meal record has been saved to your daily log (original meal preserved).`
      );
      setActiveRecommendation(null);
      recalculateNutrition(appliedItems);
      setOptimizationData(null);
    } catch (err: any) {
      console.error('Failed to apply optimization:', err);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Nutritional Breakdown
            </h2>
            {isRecalculating && (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            )}
            {isDemo && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                Interactive Demo
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic macro calculations based on verified nutritional records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedMealType}
            onChange={(e) => setSelectedMealType(e.target.value)}
            className="px-3 py-2 rounded-xl text-slate-700 bg-white border border-slate-300 text-xs font-semibold focus:outline-emerald-500 shadow-2xs"
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
          <button
            onClick={onScanAnother}
            className="px-4 py-2 rounded-xl text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold transition-colors"
          >
            Scan Another Meal
          </button>
          <button
            onClick={handleSaveMeal}
            disabled={items.length === 0 || isSaved}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs"
          >
            <BookmarkCheck className="w-4 h-4" />
            {isSaved ? 'Meal Saved' : 'Save Meal'}
          </button>

          {/* Phase 5 Primary Optimizer CTA */}
          <button
            onClick={() => handleTriggerOptimization()}
            disabled={items.length === 0 || isOptimizing}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm hover:shadow"
          >
            {isOptimizing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Finding improvements...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-200" />
                Optimize My Meal
              </>
            )}
          </button>
        </div>
      </div>

      {saveSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {appliedNotice && (
        <div className="p-3 bg-teal-50 border border-teal-200 text-teal-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-teal-600 flex-shrink-0" />
          <span>{appliedNotice}</span>
        </div>
      )}

      {/* Main Grid: Visual Summary + Macro Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Image + Primary Calorie Card */}
        <div className="space-y-6">
          {previewImageUrl && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="font-medium text-slate-700">Analyzed Image</span>
                <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                  Multimodal Input
                </span>
              </div>
              <img
                src={previewImageUrl}
                alt="Meal Analysis Preview"
                className="w-full h-48 object-cover"
              />
            </div>
          )}

          {/* Primary Deterministic Calorie Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Deterministic Energy
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  nutrition?.confidence_level === 'HIGH'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {nutrition?.confidence_level || 'MEDIUM'} Confidence
              </span>
            </div>

            <div>
              <div className="text-4xl font-extrabold text-slate-900 tracking-tight">
                ~{nutrition ? Math.round(nutrition.total_calories) : '—'}{' '}
                <span className="text-sm font-semibold text-slate-500">kcal</span>
              </div>
              {nutrition && (
                <div className="text-xs font-medium text-slate-600 mt-1">
                  Range: {Math.round(nutrition.calorie_min)} –{' '}
                  {Math.round(nutrition.calorie_max)} kcal (±
                  {Math.round(nutrition.uncertainty_calories)} kcal)
                </div>
              )}
            </div>

            {/* Scientific Explanation of Uncertainty */}
            <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
              <div className="flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  Honest uncertainty accounts for cooking oil absorption and visual 2D depth.
                </span>
              </div>
            </div>
          </div>

          {/* Macro Breakdown Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Macronutrient Totals
            </h3>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-700">Protein</span>
                  <span className="text-slate-900 font-bold">
                    {nutrition ? nutrition.total_protein.toFixed(1) : 0} g
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (nutrition?.macro_distribution?.protein_pct || 0) * 1.5
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-700">Carbohydrates</span>
                  <span className="text-slate-900 font-bold">
                    {nutrition ? nutrition.total_carbohydrates.toFixed(1) : 0} g
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (nutrition?.macro_distribution?.carbohydrates_pct || 0) * 1.2
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-700">Fat</span>
                  <span className="text-slate-900 font-bold">
                    {nutrition ? nutrition.total_fat.toFixed(1) : 0} g
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (nutrition?.macro_distribution?.fat_pct || 0) * 1.5
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-slate-700">Dietary Fiber</span>
                  <span className="text-slate-900 font-bold">
                    {nutrition ? nutrition.total_fiber.toFixed(1) : 0} g
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-teal-500 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        ((nutrition?.total_fiber || 0) / 25) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Confirmed Items Table + Optimizer + Daily Contribution */}
        <div className="lg:col-span-2 space-y-6">
          {/* Confirmed Food Items List */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Confirmed Dishes & Portions</h3>
              <span className="text-xs text-slate-500 font-medium">
                {items.length} {items.length === 1 ? 'item' : 'items'} in meal
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {items.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{item.food_name}</h4>
                    <p className="text-xs text-slate-500">
                      Serving: {item.portion_value} {item.portion_unit || item.serving_unit}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden text-xs">
                      <button
                        onClick={() => handleServingChange(idx, item.serving_count - 0.25)}
                        className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold"
                      >
                        -
                      </button>
                      <span className="px-2.5 py-1 font-semibold text-slate-800">
                        {item.serving_count}x
                      </span>
                      <button
                        onClick={() => handleServingChange(idx, item.serving_count + 0.25)}
                        className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick add dropdown */}
            <div className="pt-2">
              <select
                onChange={(e) => {
                  const f = availableFoods.find((item) => item.id === parseInt(e.target.value));
                  if (f) handleAddFoodItem(f);
                  e.target.value = '';
                }}
                defaultValue=""
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-slate-700 font-medium focus:outline-emerald-500"
              >
                <option value="" disabled>
                  + Add another dish from verified Indian food catalog...
                </option>
                {availableFoods.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.calories} kcal / {f.serving_unit})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* DAILY TARGET CONTRIBUTION EVALUATION */}
          {evaluation && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Daily Target Fit & Insights
                    </h3>
                    <p className="text-xs text-slate-500">
                      Evaluated against your personalized remaining daily budget.
                    </p>
                  </div>
                </div>

                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                    evaluation.fits_remaining_budget
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {evaluation.fits_remaining_budget ? '✓ Fits Daily Budget' : 'Exceeds Daily Budget'}
                </span>
              </div>

              <div className="space-y-2">
                {evaluation.insights.map((insight, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PHASE 5: REAL AI MEAL OPTIMIZER SECTION */}
          <div className="bg-gradient-to-br from-white to-emerald-50/40 rounded-2xl border border-emerald-200 p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Optimize My Meal</h3>
                  <p className="text-xs text-slate-500">
                    Deterministic alternatives tailored to your target with AI explanations.
                  </p>
                </div>
              </div>

              {/* Goal Selector */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
                <button
                  onClick={() => {
                    setSelectedGoal('weight_loss');
                    handleTriggerOptimization('WEIGHT_LOSS');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedGoal === 'weight_loss'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Weight Loss
                </button>
                <button
                  onClick={() => {
                    setSelectedGoal('muscle_gain');
                    handleTriggerOptimization('MUSCLE_GAIN');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedGoal === 'muscle_gain'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Muscle Gain
                </button>
                <button
                  onClick={() => {
                    setSelectedGoal('balanced');
                    handleTriggerOptimization('MAINTENANCE');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    selectedGoal === 'balanced'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Balanced
                </button>
              </div>
            </div>

            {/* Loading State */}
            {isOptimizing ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-semibold text-slate-700">
                  Finding ways to improve this meal…
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Generating verified candidate modifications and recalculating nutrition deterministically.
                </p>
              </div>
            ) : optimizationData ? (
              <div className="space-y-6">
                {/* Issues Detected Badges */}
                {optimizationData.issues.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600">Focus Areas:</span>
                    {optimizationData.issues.map((iss, i) => (
                      <span
                        key={i}
                        className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200"
                      >
                        {iss.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {/* Recommendations List (2-3 options) */}
                <div className="space-y-4">
                  {optimizationData.recommendations.map((rec, index) => (
                    <div
                      key={rec.id}
                      className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center">
                            {index + 1}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">{rec.title}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                            Fit Score: {Math.round(rec.score * 100)}%
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-600">{rec.description}</p>

                      {/* Key Change Metrics Badges */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            rec.calorie_delta <= 0
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {rec.calorie_delta > 0 ? `+${rec.calorie_delta}` : rec.calorie_delta} kcal
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            rec.protein_delta >= 0
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {rec.protein_delta > 0 ? `+${rec.protein_delta}` : rec.protein_delta}g protein
                        </span>
                        {rec.fiber_delta !== 0 && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                            {rec.fiber_delta > 0 ? `+${rec.fiber_delta}` : rec.fiber_delta}g fiber
                          </span>
                        )}
                      </div>

                      {/* AI Explanation Quote */}
                      <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs text-slate-700 italic flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>"{rec.explanation}"</span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button
                          onClick={() => setActiveRecommendation(rec)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition"
                        >
                          View Changes
                        </button>
                        <button
                          onClick={() => handleApplyOptimization(rec)}
                          disabled={isApplying}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                        >
                          {isApplying ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Apply Suggestion
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <Sparkles className="w-8 h-8 text-emerald-500 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">
                  Ready to optimize this meal?
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click below to generate deterministic portion adjustments, protein pairings, and balanced options backed by verified Indian food data.
                </p>
                <button
                  onClick={() => handleTriggerOptimization()}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                >
                  Generate Optimization Suggestions
                </button>
              </div>
            )}

            {/* Disclaimer */}
            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-2 border-t border-emerald-100">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>
                <strong>Nutrition transparency notice:</strong> The optimizer provides general nutrition-oriented suggestions and does not provide medical advice.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* PHASE 5: BEFORE / AFTER COMPARISON MODAL */}
      {activeRecommendation && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Before vs After Comparison
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-1">
                  {activeRecommendation.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveRecommendation(null)}
                className="text-slate-400 hover:text-slate-600 text-sm p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Specific Modification Changes List */}
            <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700">Detailed Adjustments:</span>
              <ul className="space-y-1 text-xs text-slate-600">
                {activeRecommendation.changes.map((ch, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{ch}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Side-by-Side Nutrition Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Original */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-slate-500">Original Meal</span>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold">
                    Baseline
                  </span>
                </div>
                <div className="text-3xl font-black text-slate-900">
                  ~{Math.round(activeRecommendation.original_nutrition.calories)}{' '}
                  <span className="text-xs font-normal text-slate-500">kcal</span>
                </div>
                <div className="space-y-1 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span>Protein:</span>
                    <strong className="text-slate-800">
                      {activeRecommendation.original_nutrition.protein}g
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Carbs:</span>
                    <strong className="text-slate-800">
                      {activeRecommendation.original_nutrition.carbohydrates}g
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Fat:</span>
                    <strong className="text-slate-800">
                      {activeRecommendation.original_nutrition.fat}g
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Fiber:</span>
                    <strong className="text-slate-800">
                      {activeRecommendation.original_nutrition.fiber}g
                    </strong>
                  </div>
                </div>
              </div>

              {/* Optimized */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-emerald-800">
                    Optimized Alternative
                  </span>
                  <span className="text-[10px] bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded font-bold">
                    Suggested
                  </span>
                </div>
                <div className="text-3xl font-black text-emerald-950">
                  ~{Math.round(activeRecommendation.optimized_nutrition.calories)}{' '}
                  <span className="text-xs font-normal text-emerald-700">kcal</span>
                </div>
                <div className="space-y-1 text-xs text-emerald-900">
                  <div className="flex justify-between">
                    <span>Protein:</span>
                    <strong className="font-bold">
                      {activeRecommendation.optimized_nutrition.protein}g{' '}
                      {activeRecommendation.protein_delta !== 0 && (
                        <span className="text-[10px] text-emerald-700">
                          ({activeRecommendation.protein_delta > 0 ? '+' : ''}
                          {activeRecommendation.protein_delta}g)
                        </span>
                      )}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Carbs:</span>
                    <strong className="font-bold">
                      {activeRecommendation.optimized_nutrition.carbohydrates}g
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Fat:</span>
                    <strong className="font-bold">
                      {activeRecommendation.optimized_nutrition.fat}g
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Fiber:</span>
                    <strong className="font-bold">
                      {activeRecommendation.optimized_nutrition.fiber}g{' '}
                      {activeRecommendation.fiber_delta !== 0 && (
                        <span className="text-[10px] text-emerald-700">
                          ({activeRecommendation.fiber_delta > 0 ? '+' : ''}
                          {activeRecommendation.fiber_delta}g)
                        </span>
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Uncertainty and Estimation Confidence */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="flex items-center justify-between font-semibold text-slate-800">
                <span>
                  {activeRecommendation.optimized_nutrition.formatted_estimate}
                </span>
                <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-700">
                  {activeRecommendation.confidence} Confidence
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Portion sizes and cooking method introduce natural recipe variance.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setActiveRecommendation(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Keep Original Meal
              </button>
              <button
                onClick={() => handleApplyOptimization(activeRecommendation)}
                disabled={isApplying}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
              >
                {isApplying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                Apply This Version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
