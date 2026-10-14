import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle,
  AlertCircle,
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
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const isSavingMealRef = React.useRef(false);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
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
    if (items.length === 0 || isSavingMealRef.current || isSavingMeal) return null;
    isSavingMealRef.current = true;
    setIsSavingMeal(true);
    setSaveErrorMessage(null);

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
      setSaveSuccessMessage('Meal saved successfully!');
      setTimeout(() => setSaveSuccessMessage(null), 5000);
      return saved.id;
    } catch (err: any) {
      console.error('Save failed:', err);
      setSaveErrorMessage(
        err?.message || 'Failed to record meal. Please verify connection and try again.'
      );
      return null;
    } finally {
      setIsSavingMeal(false);
      isSavingMealRef.current = false;
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
        if (isSavingMealRef.current) return;
        isSavingMealRef.current = true;
        setIsSavingMeal(true);
        try {
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
        } finally {
          setIsSavingMeal(false);
          isSavingMealRef.current = false;
        }
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
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-dark-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Nutrition Summary
            </h2>
            {isRecalculating && (
              <Loader2 className="w-4 h-4 animate-spin text-lime-primary" />
            )}
            {isDemo && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-lime-dim text-lime-primary border border-lime-primary/30">
                Sample Meal
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            Nutrition values are estimates based on your meal items.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedMealType}
            onChange={(e) => setSelectedMealType(e.target.value)}
            className="px-3 py-2 rounded-xl text-white bg-dark-inner border border-dark-border text-xs font-semibold focus:outline-none focus:border-lime-primary shadow-sm"
          >
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>
          <button
            onClick={onScanAnother}
            className="px-3.5 py-2 rounded-xl text-slate-300 bg-dark-card border border-dark-border hover:bg-dark-cardHover hover:text-white text-xs font-semibold transition-colors"
          >
            Scan Another
          </button>
          <button
            onClick={handleSaveMeal}
            disabled={items.length === 0 || isSaved || isSavingMeal}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              isSaved
                ? 'bg-dark-inner text-lime-primary border border-lime-primary/30'
                : 'bg-lime-primary text-lime-dark hover:bg-lime-hover shadow-lg shadow-lime-primary/10'
            } disabled:opacity-50`}
          >
            {isSavingMeal ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-lime-primary" />
                <span>Saving Meal...</span>
              </>
            ) : (
              <>
                <BookmarkCheck className="w-4 h-4" />
                <span>{isSaved ? 'Meal Logged' : 'Log Meal'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {saveSuccessMessage && (
        <div className="p-4 bg-lime-dim border border-lime-primary/30 text-lime-primary text-xs rounded-xl flex items-center justify-between gap-3 animate-fadeIn font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span className="font-bold">{saveSuccessMessage}</span>
          </div>
          <button
            onClick={onScanAnother}
            className="px-3 py-1.5 bg-lime-primary text-lime-dark font-extrabold rounded-lg hover:bg-lime-hover transition-colors text-xs"
          >
            Scan Another Meal
          </button>
        </div>
      )}

      {saveErrorMessage && (
        <div className="p-3.5 bg-coral-dim border border-coral-primary/30 text-coral-primary text-xs rounded-xl flex items-center gap-2 animate-fadeIn font-medium">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{saveErrorMessage}</span>
        </div>
      )}

      {appliedNotice && (
        <div className="p-3.5 bg-lime-dim border border-lime-primary/30 text-lime-primary text-xs rounded-xl flex items-center gap-2 animate-fadeIn font-medium">
          <Check className="w-4 h-4 shrink-0" />
          <span>{appliedNotice}</span>
        </div>
      )}

      {/* Main Grid: Visual Summary (Left) + Confirmed Items & Optimizer (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Image + Energy Breakdown */}
        <div className="space-y-6">
          {previewImageUrl && (
            <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden shadow-lg">
              <div className="p-3 border-b border-dark-border flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-white">Your Photo</span>
              </div>
              <img
                src={previewImageUrl}
                alt="Meal Analysis Preview"
                className="w-full h-48 object-cover bg-dark-inner"
              />
            </div>
          )}

          {/* Primary Calorie Card */}
          <div className="bg-gradient-to-br from-dark-card to-dark-elevated rounded-2xl border border-dark-border p-6 shadow-xl space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Total Calories
            </span>

            <div>
              <div className="text-4xl font-black text-white tracking-tight">
                {nutrition ? Math.round(nutrition.total_calories) : '—'}{' '}
                <span className="text-sm font-semibold text-slate-400">kcal</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Nutrition values are estimates.
              </p>
            </div>
          </div>

          {/* Macro Breakdown Summary */}
          <div className="bg-dark-card rounded-2xl border border-dark-border p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Macronutrient Totals
            </h3>

            <div className="space-y-3.5">
              {/* Protein */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <span className="text-sky-400 font-semibold">Protein</span>
                  <span className="text-white font-mono font-bold">
                    {nutrition ? Math.round(nutrition.total_protein) : 0}g
                  </span>
                </div>
                <div className="w-full bg-dark-inner h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-400 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (nutrition?.macro_distribution?.protein_pct || 0) * 1.5)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Carbs */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <span className="text-amber-400 font-semibold">Carbohydrates</span>
                  <span className="text-white font-mono font-bold">
                    {nutrition ? Math.round(nutrition.total_carbohydrates) : 0}g
                  </span>
                </div>
                <div className="w-full bg-dark-inner h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (nutrition?.macro_distribution?.carbohydrates_pct || 0) * 1.2)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Fat */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <span className="text-rose-400 font-semibold">Fat</span>
                  <span className="text-white font-mono font-bold">
                    {nutrition ? Math.round(nutrition.total_fat) : 0}g
                  </span>
                </div>
                <div className="w-full bg-dark-inner h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-400 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (nutrition?.macro_distribution?.fat_pct || 0) * 1.5)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Fiber */}
              <div>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <span className="text-lime-primary font-semibold">Dietary Fiber</span>
                  <span className="text-white font-mono font-bold">
                    {nutrition ? Math.round(nutrition.total_fiber) : 0}g
                  </span>
                </div>
                <div className="w-full bg-dark-inner h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-lime-primary h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, ((nutrition?.total_fiber || 0) / 25) * 100)}%`,
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
          <div className="bg-dark-card rounded-2xl border border-dark-border p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border">
              <h3 className="text-base font-bold text-white">Your Meal Items</h3>
              <span className="text-xs text-slate-400 font-medium">
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            <div className="divide-y divide-dark-border">
              {items.map((item, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">{item.food_name}</h4>
                    <p className="text-xs text-slate-400">
                      {Math.round(item.calories * item.serving_count)} kcal • {Math.round(item.protein * item.serving_count)}g protein
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-dark-border rounded-lg overflow-hidden text-xs bg-dark-inner">
                      <button
                        onClick={() => handleServingChange(idx, item.serving_count - 0.25)}
                        className="px-2.5 py-1 hover:bg-dark-cardHover text-slate-300 font-bold"
                      >
                        -
                      </button>
                      <span className="px-3 py-1 font-mono font-semibold text-white">
                        {item.serving_count}x
                      </span>
                      <button
                        onClick={() => handleServingChange(idx, item.serving_count + 0.25)}
                        className="px-2.5 py-1 hover:bg-dark-cardHover text-slate-300 font-bold"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-slate-500 hover:text-coral-primary transition-colors"
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
                className="w-full text-xs bg-dark-inner border border-dark-border rounded-xl py-2.5 px-3 text-slate-300 font-medium focus:outline-none focus:border-lime-primary"
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
            <div className="bg-dark-card rounded-2xl border border-dark-border p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-dark-border">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-lime-dim text-lime-primary flex items-center justify-center border border-lime-primary/20">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Daily Target Fit & Insights
                    </h3>
                    <p className="text-xs text-slate-400">
                      Evaluated against your personalized remaining daily budget.
                    </p>
                  </div>
                </div>

                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                    evaluation.fits_remaining_budget
                      ? 'bg-lime-dim text-lime-primary border-lime-primary/30'
                      : 'bg-coral-dim text-coral-primary border-coral-primary/30'
                  }`}
                >
                  {evaluation.fits_remaining_budget ? '✓ Fits Daily Budget' : 'Exceeds Daily Budget'}
                </span>
              </div>

              <div className="space-y-2">
                {evaluation.insights.map((insight, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                    <ChevronRight className="w-3.5 h-3.5 text-lime-primary shrink-0 mt-0.5" />
                    <span>{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI MEAL OPTIMIZER SECTION */}
          <div className="bg-gradient-to-br from-dark-card to-dark-elevated rounded-2xl border border-dark-border p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-dark-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-lime-primary text-lime-dark flex items-center justify-center shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Meal Suggestions</h3>
                  <p className="text-xs text-slate-400">
                    Helpful adjustments to balance your calories and protein.
                  </p>
                </div>
              </div>

              {/* Goal Selector */}
              <div className="flex items-center gap-1 bg-dark-inner p-1 rounded-xl border border-dark-border self-start sm:self-auto">
                <button
                  onClick={() => {
                    setSelectedGoal('weight_loss');
                    handleTriggerOptimization('WEIGHT_LOSS');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedGoal === 'weight_loss'
                      ? 'bg-lime-primary text-lime-dark shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Weight Loss
                </button>
                <button
                  onClick={() => {
                    setSelectedGoal('muscle_gain');
                    handleTriggerOptimization('MUSCLE_GAIN');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedGoal === 'muscle_gain'
                      ? 'bg-lime-primary text-lime-dark shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Muscle Gain
                </button>
                <button
                  onClick={() => {
                    setSelectedGoal('balanced');
                    handleTriggerOptimization('MAINTENANCE');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedGoal === 'balanced'
                      ? 'bg-lime-primary text-lime-dark shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Balanced
                </button>
              </div>
            </div>

            {/* Loading State */}
            {isOptimizing ? (
              <div className="py-12 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-lime-primary animate-spin mx-auto" />
                <p className="text-sm font-bold text-white">
                  Generating verified meal alternatives…
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Calculating portion modifications and recalculating nutrition deterministically.
                </p>
              </div>
            ) : optimizationData ? (
              <div className="space-y-6">
                {/* Issues Detected Badges */}
                {optimizationData.issues.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400">Focus Areas:</span>
                    {optimizationData.issues.map((iss, i) => (
                      <span
                        key={i}
                        className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30"
                      >
                        {iss.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}

                {/* Recommendations List */}
                <div className="space-y-4">
                  {optimizationData.recommendations.map((rec, index) => (
                    <div
                      key={rec.id}
                      className="bg-dark-inner rounded-xl border border-dark-border p-5 shadow-sm hover:border-lime-primary/40 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-lime-dim text-lime-primary font-bold text-xs flex items-center justify-center border border-lime-primary/20">
                            {index + 1}
                          </span>
                          <h4 className="text-sm font-bold text-white">{rec.title}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-lime-primary bg-lime-dim px-2.5 py-0.5 rounded-md border border-lime-primary/20">
                            Fit Score: {Math.round(rec.score * 100)}%
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300">{rec.description}</p>

                      {/* Key Change Metrics Badges */}
                      <div className="flex flex-wrap gap-2 pt-1 font-mono">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded border ${
                            rec.calorie_delta <= 0
                              ? 'bg-lime-dim text-lime-primary border-lime-primary/30'
                              : 'bg-amber-400/10 text-amber-300 border-amber-400/30'
                          }`}
                        >
                          {rec.calorie_delta > 0 ? `+${rec.calorie_delta}` : rec.calorie_delta} kcal
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded border ${
                            rec.protein_delta >= 0
                              ? 'bg-sky-400/10 text-sky-400 border-sky-400/30'
                              : 'bg-dark-card text-slate-400 border-dark-border'
                          }`}
                        >
                          {rec.protein_delta > 0 ? `+${rec.protein_delta}` : rec.protein_delta}g protein
                        </span>
                        {rec.fiber_delta !== 0 && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-lime-dim text-lime-primary border border-lime-primary/30">
                            {rec.fiber_delta > 0 ? `+${rec.fiber_delta}` : rec.fiber_delta}g fiber
                          </span>
                        )}
                      </div>

                      {/* AI Explanation Quote */}
                      <div className="bg-dark-card p-3 rounded-lg border border-dark-border text-xs text-slate-300 italic flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-lime-primary shrink-0 mt-0.5" />
                        <span>"{rec.explanation}"</span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-dark-border">
                        <button
                          onClick={() => setActiveRecommendation(rec)}
                          className="px-3 py-1.5 bg-dark-card hover:bg-dark-cardHover text-slate-200 rounded-lg text-xs font-semibold transition"
                        >
                          View Changes
                        </button>
                        <button
                          onClick={() => handleApplyOptimization(rec)}
                          disabled={isApplying}
                          className="px-3.5 py-1.5 bg-lime-primary hover:bg-lime-hover text-lime-dark rounded-lg text-xs font-bold transition shadow-sm flex items-center gap-1.5"
                        >
                          {isApplying ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Apply Suggestion</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <Sparkles className="w-8 h-8 text-lime-primary mx-auto" />
                <h4 className="text-sm font-bold text-white">
                  Ready to optimize this meal?
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Click below to generate deterministic portion adjustments and balanced Indian food alternatives.
                </p>
                <button
                  onClick={() => handleTriggerOptimization()}
                  className="px-5 py-2.5 bg-lime-primary hover:bg-lime-hover text-lime-dark font-extrabold text-xs rounded-xl shadow-lg shadow-lime-primary/10 transition"
                >
                  Generate Optimization Suggestions
                </button>
              </div>
            )}

            {/* Disclaimer */}
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-2 border-t border-dark-border">
              <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>
                <strong>Transparency notice:</strong> The optimizer provides nutritional suggestions based on verified food baselines and does not replace medical dietary advice.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* BEFORE / AFTER COMPARISON MODAL */}
      {activeRecommendation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-dark-card rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-dark-border max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-lime-primary bg-lime-dim px-2 py-0.5 rounded border border-lime-primary/20">
                  Before vs After Comparison
                </span>
                <h3 className="text-lg font-bold text-white mt-1">
                  {activeRecommendation.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveRecommendation(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Specific Modification Changes List */}
            <div className="space-y-1.5 bg-dark-inner p-3.5 rounded-xl border border-dark-border">
              <span className="text-xs font-bold text-white">Detailed Adjustments:</span>
              <ul className="space-y-1 text-xs text-slate-300">
                {activeRecommendation.changes.map((ch, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <ChevronRight className="w-3.5 h-3.5 text-lime-primary shrink-0 mt-0.5" />
                    <span>{ch}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Side-by-Side Nutrition Grid */}
            <div className="grid grid-cols-2 gap-4">
              {/* Original */}
              <div className="p-4 rounded-xl bg-dark-inner border border-dark-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-slate-400">Original Meal</span>
                  <span className="text-[10px] bg-dark-card text-slate-300 px-2 py-0.5 rounded font-mono font-semibold border border-dark-border">
                    Baseline
                  </span>
                </div>
                <div className="text-3xl font-black text-white">
                  ~{Math.round(activeRecommendation.original_nutrition.calories)}{' '}
                  <span className="text-xs font-normal text-slate-400">kcal</span>
                </div>
                <div className="space-y-1 text-xs text-slate-300 font-mono">
                  <div className="flex justify-between">
                    <span>Protein:</span>
                    <strong className="text-sky-400 font-bold">
                      {activeRecommendation.original_nutrition.protein}g
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Carbs:</span>
                    <strong className="text-amber-400 font-bold">
                      {activeRecommendation.original_nutrition.carbohydrates}g
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Fat:</span>
                    <strong className="text-rose-400 font-bold">
                      {activeRecommendation.original_nutrition.fat}g
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Fiber:</span>
                    <strong className="text-lime-primary font-bold">
                      {activeRecommendation.original_nutrition.fiber}g
                    </strong>
                  </div>
                </div>
              </div>

              {/* Optimized */}
              <div className="p-4 rounded-xl bg-lime-dim/20 border border-lime-primary/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-lime-primary">
                    Optimized Alternative
                  </span>
                  <span className="text-[10px] bg-lime-dim text-lime-primary px-2 py-0.5 rounded font-mono font-bold border border-lime-primary/20">
                    Suggested
                  </span>
                </div>
                <div className="text-3xl font-black text-white">
                  ~{Math.round(activeRecommendation.optimized_nutrition.calories)}{' '}
                  <span className="text-xs font-normal text-slate-400">kcal</span>
                </div>
                <div className="space-y-1 text-xs text-slate-200 font-mono">
                  <div className="flex justify-between">
                    <span>Protein:</span>
                    <strong className="text-sky-400 font-bold">
                      {activeRecommendation.optimized_nutrition.protein}g{' '}
                      {activeRecommendation.protein_delta !== 0 && (
                        <span className="text-[10px]">
                          ({activeRecommendation.protein_delta > 0 ? '+' : ''}
                          {activeRecommendation.protein_delta}g)
                        </span>
                      )}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Carbs:</span>
                    <strong className="text-amber-400 font-bold">
                      {activeRecommendation.optimized_nutrition.carbohydrates}g
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Fat:</span>
                    <strong className="text-rose-400 font-bold">
                      {activeRecommendation.optimized_nutrition.fat}g
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Fiber:</span>
                    <strong className="text-lime-primary font-bold">
                      {activeRecommendation.optimized_nutrition.fiber}g{' '}
                      {activeRecommendation.fiber_delta !== 0 && (
                        <span className="text-[10px]">
                          ({activeRecommendation.fiber_delta > 0 ? '+' : ''}
                          {activeRecommendation.fiber_delta}g)
                        </span>
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-dark-border">
              <button
                onClick={() => setActiveRecommendation(null)}
                className="px-4 py-2 bg-dark-inner hover:bg-dark-cardHover text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                Keep Original Meal
              </button>
              <button
                onClick={() => handleApplyOptimization(activeRecommendation)}
                disabled={isApplying}
                className="px-5 py-2 bg-lime-primary hover:bg-lime-hover text-lime-dark rounded-xl text-xs font-bold transition shadow-lg shadow-lime-primary/10 flex items-center gap-1.5"
              >
                {isApplying ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Apply This Version</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
