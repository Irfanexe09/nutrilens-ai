import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle,
  Scale,
  Plus,
  Trash2,
  BookmarkCheck,
  ChevronRight,
  Info,
  Loader2,
} from 'lucide-react';
import { MealItem, NutritionBreakdown, FoodItem, OptimizationGoal } from '../types';
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
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Recalculate deterministic nutrition whenever meal items change
  const recalculateNutrition = async (currentItems: MealItem[]) => {
    if (currentItems.length === 0) {
      setNutrition(null);
      return;
    }
    setIsRecalculating(true);
    try {
      const result = await api.calculateNutrition(currentItems);
      setNutrition(result);
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
    updated[index] = { ...updated[index], serving_count: clamped };
    setItems(updated);
    recalculateNutrition(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_: MealItem, i: number) => i !== index);
    setItems(updated);
    recalculateNutrition(updated);
  };

  const handleAddFoodItem = (food: FoodItem) => {
    const newItem: MealItem = {
      food_id: food.id,
      food_name: food.name,
      serving_count: 1.0,
      serving_size: food.serving_size,
      serving_unit: food.serving_unit,
      calories: food.calories,
      protein: food.protein,
      carbohydrates: food.carbohydrates,
      fat: food.fat,
      fiber: food.fiber,
      uncertainty_pct: food.uncertainty_pct,
    };
    const updated = [...items, newItem];
    setItems(updated);
    recalculateNutrition(updated);
  };

  const handleSaveMeal = async () => {
    if (items.length === 0) return;
    try {
      await api.saveMeal({
        meal_type: 'lunch',
        notes: isDemo ? 'Saved from verified interactive demo' : 'Scanned meal analysis',
        image_url: previewImageUrl,
        items,
      });
      setIsSaved(true);
      setSaveSuccessMessage('Meal successfully recorded to PostgreSQL database!');
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  // Meal Optimizer simulation calculations based on the user's selected goal
  const getOptimizerScenario = () => {
    if (!nutrition) return null;

    if (selectedGoal === 'weight_loss') {
      const suggestedCalories = Math.round(nutrition.total_calories * 0.78);
      const suggestedProtein = Math.round(nutrition.total_protein * 1.15);
      const suggestedCarbs = Math.round(nutrition.total_carbohydrates * 0.65);
      const suggestedFat = Math.round(nutrition.total_fat * 0.75);

      return {
        title: 'Weight Loss Optimization Scenario',
        recommendations: [
          'Reduce primary rice/flatbread portion by approximately 25–30%.',
          'Increase lean protein portion (skinless chicken / egg white / paneer) to maintain high satiety.',
          'Add a portion of fiber-rich cucumber salad or roasted greens.',
          'Limit deep-fried sides or high-fat gravies.',
        ],
        originalCalories: Math.round(nutrition.total_calories),
        originalProtein: Math.round(nutrition.total_protein),
        originalCarbs: Math.round(nutrition.total_carbohydrates),
        originalFat: Math.round(nutrition.total_fat),
        suggestedCalories,
        suggestedProtein,
        suggestedCarbs,
        suggestedFat,
      };
    } else if (selectedGoal === 'muscle_gain') {
      const suggestedCalories = Math.round(nutrition.total_calories * 1.12);
      const suggestedProtein = Math.round(nutrition.total_protein * 1.4);
      const suggestedCarbs = Math.round(nutrition.total_carbohydrates * 1.05);
      const suggestedFat = Math.round(nutrition.total_fat * 1.0);

      return {
        title: 'Muscle Synthesis Optimization Scenario',
        recommendations: [
          'Boost total protein to reach ~35–45g for this meal window.',
          'Add a side of sprouted moong, curd, or boiled eggs.',
          'Maintain complex carbohydrates for glycogen replenishment.',
          'Stay well-hydrated to support protein metabolism.',
        ],
        originalCalories: Math.round(nutrition.total_calories),
        originalProtein: Math.round(nutrition.total_protein),
        originalCarbs: Math.round(nutrition.total_carbohydrates),
        originalFat: Math.round(nutrition.total_fat),
        suggestedCalories,
        suggestedProtein,
        suggestedCarbs,
        suggestedFat,
      };
    } else {
      const suggestedCalories = Math.round(nutrition.total_calories);
      const suggestedProtein = Math.round(nutrition.total_protein * 1.1);
      const suggestedCarbs = Math.round(nutrition.total_carbohydrates * 0.9);
      const suggestedFat = Math.round(nutrition.total_fat * 0.95);

      return {
        title: 'Balanced Metabolic Optimization Scenario',
        recommendations: [
          'Distribute macronutrients towards a 25% Protein / 50% Carbs / 25% Fat caloric ratio.',
          'Introduce dietary fiber (sambar/veggies) to flatten glycemic response.',
          'Maintain regular portion timing.',
        ],
        originalCalories: Math.round(nutrition.total_calories),
        originalProtein: Math.round(nutrition.total_protein),
        originalCarbs: Math.round(nutrition.total_carbohydrates),
        originalFat: Math.round(nutrition.total_fat),
        suggestedCalories,
        suggestedProtein,
        suggestedCarbs,
        suggestedFat,
      };
    }
  };

  const optimizerData = getOptimizerScenario();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Nutritional Breakdown
            </h2>
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

        <div className="flex items-center gap-2">
          <button
            onClick={onScanAnother}
            className="px-4 py-2 rounded-xl text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold transition-colors"
          >
            Scan Another Meal
          </button>
          <button
            onClick={handleSaveMeal}
            disabled={items.length === 0 || isSaved}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs"
          >
            <BookmarkCheck className="w-4 h-4" />
            {isSaved ? 'Meal Saved' : 'Save Meal'}
          </button>
        </div>
      </div>

      {saveSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{saveSuccessMessage}</span>
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
                <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded">Verified</span>
              </div>
              <img
                src={previewImageUrl}
                alt="Analyzed food"
                className="w-full h-52 object-cover object-center bg-slate-50"
              />
            </div>
          )}

          {/* Calorie Card with Honest Uncertainty */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                Total Energy
                {isRecalculating && <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />}
              </span>
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                Honest Estimation
              </span>
            </div>

            <div>
              <div className="text-4xl font-extrabold text-slate-900 tracking-tight">
                {nutrition ? Math.round(nutrition.total_calories) : 0}{' '}
                <span className="text-lg font-semibold text-slate-500">kcal</span>
              </div>
              <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 font-medium">
                <Scale className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {nutrition
                    ? `Estimated range: ${Math.round(nutrition.calorie_min)} – ${Math.round(
                        nutrition.calorie_max
                      )} kcal (±${Math.round(nutrition.uncertainty_calories)} kcal)`
                    : 'Awaiting items'}
                </span>
              </div>
            </div>

            {/* Macro Distribution Bar */}
            {nutrition && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Caloric Distribution
                </span>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${nutrition.macro_distribution.protein_pct}%` }}
                    className="bg-emerald-500"
                    title={`Protein: ${nutrition.macro_distribution.protein_pct}%`}
                  />
                  <div
                    style={{ width: `${nutrition.macro_distribution.carbohydrates_pct}%` }}
                    className="bg-amber-400"
                    title={`Carbohydrates: ${nutrition.macro_distribution.carbohydrates_pct}%`}
                  />
                  <div
                    style={{ width: `${nutrition.macro_distribution.fat_pct}%` }}
                    className="bg-rose-400"
                    title={`Fat: ${nutrition.macro_distribution.fat_pct}%`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 font-medium pt-1">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Protein{' '}
                    {nutrition.macro_distribution.protein_pct}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> Carbs{' '}
                    {nutrition.macro_distribution.carbohydrates_pct}%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-400" /> Fat{' '}
                    {nutrition.macro_distribution.fat_pct}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Phase 2 Multimodal AI Status Notice Card */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-2 text-xs text-slate-600">
            <div className="flex items-center gap-2 text-slate-900 font-semibold">
              <Info className="w-4 h-4 text-emerald-600" />
              <span>AI Vision Roadmap (Phase 2)</span>
            </div>
            <p className="leading-relaxed">
              Automated bounding-box detection and zero-shot multimodal food identification will be activated in Phase 2.
            </p>
            <p className="text-slate-500 font-medium">
              In Phase 1, the deterministic nutrition engine, portion scaler, and database schema are 100% active.
            </p>
          </div>
        </div>

        {/* Right Column (2 cols wide): Detailed Macros & Food Items confirmation */}
        <div className="lg:col-span-2 space-y-6">
          {/* 4 Macro Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Protein
              </span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {nutrition ? nutrition.total_protein : 0} <span className="text-xs font-normal text-slate-500">g</span>
              </div>
              <span className="text-[11px] text-emerald-600 font-medium block mt-0.5">Muscle & Repair</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Carbs
              </span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {nutrition ? nutrition.total_carbohydrates : 0} <span className="text-xs font-normal text-slate-500">g</span>
              </div>
              <span className="text-[11px] text-amber-600 font-medium block mt-0.5">Primary Fuel</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Fats
              </span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {nutrition ? nutrition.total_fat : 0} <span className="text-xs font-normal text-slate-500">g</span>
              </div>
              <span className="text-[11px] text-rose-600 font-medium block mt-0.5">Lipids & Hormones</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Dietary Fiber
              </span>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {nutrition ? nutrition.total_fiber : 0} <span className="text-xs font-normal text-slate-500">g</span>
              </div>
              <span className="text-[11px] text-teal-600 font-medium block mt-0.5">Gut Microbiome</span>
            </div>
          </div>

          {/* Confirmed Food Items Table with Portion Adjuster */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Confirmed Meal Items & Portion Sizing
                </h3>
                <p className="text-xs text-slate-500">
                  Adjust portion multipliers (e.g. 0.75x or 1.5x) to see real-time deterministic updates.
                </p>
              </div>
              <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md font-medium border border-emerald-100 self-start sm:self-auto">
                {items.length} item{items.length === 1 ? '' : 's'} in meal
              </span>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No food items currently selected. Add an item below to calculate nutrition.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map((item: MealItem, idx: number) => (
                  <div key={idx} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-sm font-semibold text-slate-900">{item.food_name}</div>
                      <div className="text-xs text-slate-500">
                        Base: {item.serving_size} {item.serving_unit} • {item.calories} kcal (P: {item.protein}g, C: {item.carbohydrates}g, F: {item.fat}g)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Variance margin: ±{item.uncertainty_pct}%
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Portion count controls */}
                      <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleServingChange(idx, item.serving_count - 0.25)}
                          className="w-6 h-6 rounded bg-white text-slate-700 border border-slate-200 text-xs font-bold hover:bg-slate-100 flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="text-xs font-semibold px-2 text-slate-800">
                          {item.serving_count.toFixed(2)}x
                        </span>
                        <button
                          type="button"
                          onClick={() => handleServingChange(idx, item.serving_count + 0.25)}
                          className="w-6 h-6 rounded bg-white text-slate-700 border border-slate-200 text-xs font-bold hover:bg-slate-100 flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>

                      {/* Contribution */}
                      <div className="text-right min-w-[70px]">
                        <div className="text-xs font-bold text-slate-900">
                          {Math.round(item.calories * item.serving_count)} kcal
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {(item.protein * item.serving_count).toFixed(1)}g P
                        </div>
                      </div>

                      {/* Remove */}
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Add dish dropdown */}
            <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-600 shrink-0" />
              <select
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const found = availableFoods.find((f) => f.id === id);
                  if (found) {
                    handleAddFoodItem(found);
                    e.target.value = '';
                  }
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

          {/* MEAL OPTIMIZER SECTION */}
          {optimizerData && (
            <div className="bg-gradient-to-br from-white to-emerald-50/30 rounded-2xl border border-emerald-200 p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-emerald-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Optimize My Meal
                    </h3>
                    <p className="text-xs text-slate-500">
                      Goal-aligned recommendations with estimated before-and-after macro adjustments.
                    </p>
                  </div>
                </div>

                {/* Goal Selector */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
                  <button
                    onClick={() => setSelectedGoal('weight_loss')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedGoal === 'weight_loss'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Weight Loss
                  </button>
                  <button
                    onClick={() => setSelectedGoal('muscle_gain')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedGoal === 'muscle_gain'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Muscle Gain
                  </button>
                  <button
                    onClick={() => setSelectedGoal('balanced')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      selectedGoal === 'balanced'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Balanced
                  </button>
                </div>
              </div>

              {/* Suggestions List */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Actionable Recommendations:
                </span>
                <ul className="space-y-1.5 text-xs text-slate-700">
                  {optimizerData.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Side-by-side comparison: Original vs Optimized */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Original */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Current Meal Estimate
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900">
                    {optimizerData.originalCalories} <span className="text-xs font-medium text-slate-500">kcal</span>
                  </div>
                  <div className="text-xs text-slate-600 space-x-3 font-medium">
                    <span>Protein: {optimizerData.originalProtein}g</span>
                    <span>Carbs: {optimizerData.originalCarbs}g</span>
                    <span>Fat: {optimizerData.originalFat}g</span>
                  </div>
                </div>

                {/* Suggested */}
                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                      Suggested Optimized Version
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      Estimate
                    </span>
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-900">
                    {optimizerData.suggestedCalories} <span className="text-xs font-medium text-emerald-700">kcal</span>
                  </div>
                  <div className="text-xs text-emerald-800 space-x-3 font-medium">
                    <span>Protein: {optimizerData.suggestedProtein}g</span>
                    <span>Carbs: {optimizerData.suggestedCarbs}g</span>
                    <span>Fat: {optimizerData.suggestedFat}g</span>
                  </div>
                </div>
              </div>

              {/* Critical requirement: Explain that these are estimates */}
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  <strong>Clinical transparency disclaimer:</strong> All optimized meal metrics are mathematical scenario projections and should not replace individualized clinical dietary advice.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
