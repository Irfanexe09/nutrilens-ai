import React, { useState, useEffect } from 'react';
import {
  Flame,
  Dumbbell,
  Wheat,
  Droplet,
  Salad,
  Clock,
  PlusCircle,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Sliders,
} from 'lucide-react';
import { api } from '../services/api';
import { DailyNutritionResponse } from '../types';

interface DashboardProps {
  onLogMealClick: () => void;
  onConfigureProfileClick: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onLogMealClick,
  onConfigureProfileClick,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [dailyData, setDailyData] = useState<DailyNutritionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDailyMetrics();
  }, [selectedDate]);

  const loadDailyMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      // If no token exists, create a quick demo session so users can immediately experience the dashboard
      if (!api.getToken()) {
        const demoEmail = `demo_guest_${Date.now()}@nutrilens.ai`;
        await api.register(demoEmail, 'DemoPass123!', 'Guest Explorer');
        // create a default profile
        await api.updateProfile({
          age: 26,
          sex: 'MALE',
          height_cm: 175,
          weight_kg: 70,
          activity_level: 'MODERATELY_ACTIVE',
          goal: 'WEIGHT_LOSS',
        });
      }

      const res = await api.getDailyNutrition(selectedDate);
      setDailyData(res);
    } catch (err: any) {
      setError(err.message || 'Unable to fetch daily nutrition data');
    } finally {
      setLoading(false);
    }
  };

  const shiftDate = (days: number) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + days);
    setSelectedDate(cur.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Top Banner & Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Phase 4: Daily Tracking
            </span>
            {isToday && (
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                Today
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Daily Nutrition Dashboard
          </h1>
          <p className="text-slate-600 text-sm mt-0.5">
            Real-time daily intake aggregated against your personalized targets.
          </p>
        </div>

        {/* Date Selector & Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-slate-300 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => shiftDate(-1)}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-transparent px-2 py-1 focus:outline-none"
            />
            <button
              onClick={() => shiftDate(1)}
              className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onLogMealClick}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            Log Meal
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading daily metrics...</p>
        </div>
      ) : error ? (
        <div className="mt-8 bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <h3 className="text-base font-bold text-rose-900">Unable to load daily metrics</h3>
          <p className="text-xs text-rose-700 mt-1">{error}</p>
          <button
            onClick={loadDailyMetrics}
            className="mt-4 px-4 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg"
          >
            Retry
          </button>
        </div>
      ) : dailyData ? (
        <div className="space-y-8 mt-6">
          {/* Main Calorie & Energy Progress Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Energy Expenditure Balance</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-500">
                      Target: ~{dailyData.target.calorie_target} kcal / day
                    </p>
                    <button
                      onClick={onConfigureProfileClick}
                      className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
                    >
                      <Sliders className="w-3 h-3" />
                      Adjust Profile & Goal
                    </button>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div
                className={`px-3 py-1.5 rounded-xl border text-sm font-bold flex items-center gap-2 ${
                  dailyData.overage.is_over_target
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                {dailyData.overage.is_over_target ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                ) : (
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                )}
                <span>{dailyData.overage.status_message}</span>
              </div>
            </div>

            {/* Calorie Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-500">Consumed</span>
                <p className="text-2xl font-black text-slate-900 mt-0.5">
                  ~{Math.round(dailyData.consumed.calories)}{' '}
                  <span className="text-xs font-normal text-slate-500">kcal</span>
                </p>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-3">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      dailyData.overage.is_over_target ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, dailyData.percentages.calories)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 text-right">
                  {dailyData.percentages.calories}% of daily target
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <span className="text-xs font-semibold text-slate-500">Estimated Target</span>
                <p className="text-2xl font-black text-slate-900 mt-0.5">
                  ~{Math.round(dailyData.target.calorie_target)}{' '}
                  <span className="text-xs font-normal text-slate-500">kcal</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-3">
                  Calculated from Mifflin-St Jeor & goal multiplier
                </p>
              </div>

              <div
                className={`p-4 rounded-xl border ${
                  dailyData.overage.is_over_target
                    ? 'bg-rose-50/50 border-rose-200'
                    : 'bg-emerald-50/50 border-emerald-200'
                }`}
              >
                <span
                  className={`text-xs font-semibold ${
                    dailyData.overage.is_over_target ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {dailyData.overage.is_over_target ? 'Target Overage' : 'Remaining Calories'}
                </span>
                <p
                  className={`text-2xl font-black mt-0.5 ${
                    dailyData.overage.is_over_target ? 'text-rose-700' : 'text-emerald-800'
                  }`}
                >
                  {dailyData.overage.is_over_target
                    ? `+${Math.round(dailyData.overage.calories)}`
                    : `~${Math.round(dailyData.remaining.calories)}`}{' '}
                  <span className="text-xs font-normal">kcal</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-3">
                  {dailyData.overage.is_over_target
                    ? 'Total exceeds target goal for today'
                    : 'Available within estimated target'}
                </p>
              </div>
            </div>
          </div>

          {/* Macronutrients Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Protein */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900">Protein</h4>
                </div>
                <span className="text-xs font-bold text-emerald-700">
                  {dailyData.percentages.protein}%
                </span>
              </div>
              <p className="text-xl font-bold text-slate-900 mt-2">
                {dailyData.consumed.protein_g}g{' '}
                <span className="text-xs font-normal text-slate-500">
                  / {dailyData.target.protein_target_g}g
                </span>
              </p>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, dailyData.percentages.protein)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {dailyData.remaining.protein_g > 0
                  ? `${dailyData.remaining.protein_g}g remaining`
                  : 'Goal reached!'}
              </p>
            </div>

            {/* Carbohydrates */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wheat className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-bold text-slate-900">Carbs</h4>
                </div>
                <span className="text-xs font-bold text-amber-700">
                  {dailyData.percentages.carbohydrates}%
                </span>
              </div>
              <p className="text-xl font-bold text-slate-900 mt-2">
                {dailyData.consumed.carbohydrates_g}g{' '}
                <span className="text-xs font-normal text-slate-500">
                  / {dailyData.target.carbohydrates_target_g}g
                </span>
              </p>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, dailyData.percentages.carbohydrates)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {dailyData.remaining.carbohydrates_g > 0
                  ? `${dailyData.remaining.carbohydrates_g}g remaining`
                  : 'Goal reached!'}
              </p>
            </div>

            {/* Healthy Fat */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-rose-600" />
                  <h4 className="text-xs font-bold text-slate-900">Fat</h4>
                </div>
                <span className="text-xs font-bold text-rose-700">
                  {dailyData.percentages.fat}%
                </span>
              </div>
              <p className="text-xl font-bold text-slate-900 mt-2">
                {dailyData.consumed.fat_g}g{' '}
                <span className="text-xs font-normal text-slate-500">
                  / {dailyData.target.fat_target_g}g
                </span>
              </p>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, dailyData.percentages.fat)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {dailyData.remaining.fat_g > 0
                  ? `${dailyData.remaining.fat_g}g remaining`
                  : 'Goal reached!'}
              </p>
            </div>

            {/* Dietary Fiber */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Salad className="w-4 h-4 text-teal-600" />
                  <h4 className="text-xs font-bold text-slate-900">Fiber</h4>
                </div>
                <span className="text-xs font-bold text-teal-700">
                  {dailyData.percentages.fiber}%
                </span>
              </div>
              <p className="text-xl font-bold text-slate-900 mt-2">
                {dailyData.consumed.fiber_g}g{' '}
                <span className="text-xs font-normal text-slate-500">
                  / {dailyData.target.fiber_target_g}g
                </span>
              </p>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-3">
                <div
                  className="bg-teal-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, dailyData.percentages.fiber)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {dailyData.remaining.fiber_g > 0
                  ? `${dailyData.remaining.fiber_g}g remaining`
                  : 'Goal reached!'}
              </p>
            </div>
          </div>

          {/* Meals Recorded Today */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                Meals Recorded ({dailyData.meal_count})
              </h3>
              <button
                onClick={onLogMealClick}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                + Add Another Meal
              </button>
            </div>

            {dailyData.meals.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                <Salad className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No meals logged for this date</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scan a food image or choose from the Indian food catalog to log your first meal.
                </p>
                <button
                  onClick={onLogMealClick}
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
                >
                  Scan Meal Photo
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {dailyData.meals.map((meal) => (
                  <div key={meal.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {meal.image_url ? (
                        <img
                          src={meal.image_url}
                          alt="Meal"
                          className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs uppercase">
                          {meal.meal_type.slice(0, 3)}
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 capitalize">
                          {meal.meal_type} Meal ({meal.item_count} items)
                        </h4>
                        <p className="text-xs text-slate-500">{meal.formatted_estimate}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">~{meal.calories} kcal</p>
                      <p className="text-[11px] text-slate-500">
                        {meal.protein}g P · {meal.carbohydrates}g C · {meal.fat}g F · {meal.fiber}g Fib
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Educational Disclaimer Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-slate-800">
                Informational Daily Target Disclaimer
              </h4>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                {dailyData.target.disclaimer ||
                  'Estimated daily target for informational and educational purposes only. Not a medical diagnosis or nutritional prescription.'}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
