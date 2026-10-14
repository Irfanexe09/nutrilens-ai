import React, { useState, useEffect } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Clock,
} from 'lucide-react';
import { api } from '../services/api';
import { DailyNutritionResponse, DailyMealItem } from '../types';
import { MealDetailModal } from './MealDetailModal';

interface DashboardProps {
  onLogMealClick: () => void;
  onConfigureProfileClick: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onLogMealClick,
  onConfigureProfileClick,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [dailyData, setDailyData] = useState<DailyNutritionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMealDetail, setSelectedMealDetail] = useState<DailyMealItem | null>(null);

  const isAuthenticated = Boolean(api.getToken());

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    loadDailyMetrics();
  }, [selectedDate]);

  const loadDailyMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      if (api.getToken()) {
        const res = await api.getDailyNutrition(selectedDate);
        setDailyData(res);
      } else {
        // Unauthenticated preview with default 2000 kcal target without polluting backend DB
        setDailyData({
          date: selectedDate,
          target: {
            calorie_target: 2000,
            protein_target_g: 125,
            carbohydrates_target_g: 225,
            fat_target_g: 65,
            fiber_target_g: 28,
            has_custom_target: false,
            disclaimer: 'Default target for demonstration.',
          },
          consumed: {
            calories: 0,
            protein_g: 0,
            carbohydrates_g: 0,
            fat_g: 0,
            fiber_g: 0,
          },
          remaining: {
            calories: 2000,
            protein_g: 125,
            carbohydrates_g: 225,
            fat_g: 65,
            fiber_g: 28,
          },
          overage: {
            calories: 0,
            is_over_target: false,
            status_message: 'On track',
          },
          percentages: {
            calories: 0,
            protein: 0,
            carbohydrates: 0,
            fat: 0,
            fiber: 0,
          },
          meal_count: 0,
          meals: [],
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load nutrition data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const shiftDate = (days: number) => {
    const cur = new Date(selectedDate);
    cur.setDate(cur.getDate() + days);
    const newDateStr = cur.toISOString().split('T')[0];
    if (newDateStr <= todayStr) {
      setSelectedDate(newDateStr);
    }
  };

  const isToday = selectedDate === todayStr;

  const targetCalories = dailyData?.target.calorie_target || 2000;
  const consumedCalories = Math.round(dailyData?.consumed.calories || 0);
  const remainingCalories = Math.max(0, targetCalories - consumedCalories);
  const calPercent = Math.min(100, Math.round((consumedCalories / targetCalories) * 100));

  const consumedProtein = Math.round(dailyData?.consumed.protein_g || 0);
  const targetProtein = Math.round(dailyData?.target.protein_target_g || 125);
  const proteinPercent = Math.min(100, Math.round((consumedProtein / Math.max(1, targetProtein)) * 100));

  const consumedCarbs = Math.round(dailyData?.consumed.carbohydrates_g || 0);
  const targetCarbs = Math.round(dailyData?.target.carbohydrates_target_g || 225);
  const carbsPercent = Math.min(100, Math.round((consumedCarbs / Math.max(1, targetCarbs)) * 100));

  const consumedFat = Math.round(dailyData?.consumed.fat_g || 0);
  const targetFat = Math.round(dailyData?.target.fat_target_g || 65);
  const fatPercent = Math.min(100, Math.round((consumedFat / Math.max(1, targetFat)) * 100));

  const meals = dailyData?.meals || [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header & Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {getGreeting()}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            What have you eaten today?
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-1.5 bg-dark-card border border-dark-border rounded-xl px-2 py-1 self-start sm:self-auto text-xs text-slate-300">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            aria-label="Previous day"
            className="p-1 hover:text-white rounded-lg hover:bg-dark-inner transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-semibold px-2 min-w-[90px] text-center">
            {isToday ? 'Today' : selectedDate}
          </span>
          <button
            type="button"
            onClick={() => shiftDate(1)}
            disabled={isToday}
            aria-label="Next day"
            className="p-1 hover:text-white rounded-lg hover:bg-dark-inner transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Guest Notice (Gentle, Non-Intrusive) */}
      {!isAuthenticated && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-dark-card border border-dark-border text-xs text-slate-300">
          <span>Set up your profile to personalize your calorie and protein targets.</span>
          <button
            type="button"
            onClick={onConfigureProfileClick}
            className="px-3 py-1.5 rounded-lg bg-lime-primary text-lime-dark font-bold text-xs hover:bg-lime-hover transition-colors shrink-0"
          >
            Set Up Profile
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400 text-xs gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-lime-primary" />
          <span>Loading today's nutrition...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-4 rounded-xl bg-coral-dim border border-coral-primary/30 text-coral-primary text-xs">
          {error}
        </div>
      )}

      {!loading && (
        <>
          {/* Section B: Today's Nutrition Progress */}
          <section aria-labelledby="todays-nutrition-heading" className="bg-dark-card rounded-2xl border border-dark-border p-6 shadow-sm space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <span id="todays-nutrition-heading" className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Today's Calories
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold text-white mt-1">
                  {consumedCalories}{' '}
                  <span className="text-sm font-normal text-slate-400">/ {targetCalories} kcal</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  Remaining
                </span>
                <span className="text-xl font-bold text-lime-primary">
                  {remainingCalories} kcal
                </span>
              </div>
            </div>

            {/* Calorie Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-2.5 rounded-full bg-dark-inner overflow-hidden">
                <div
                  style={{ width: `${calPercent}%` }}
                  className={`h-full rounded-full transition-all duration-300 ${
                    consumedCalories > targetCalories ? 'bg-coral-primary' : 'bg-lime-primary'
                  }`}
                />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>{calPercent}% of daily goal</span>
                {consumedCalories > targetCalories && (
                  <span className="text-coral-primary font-semibold">
                    +{consumedCalories - targetCalories} kcal over target
                  </span>
                )}
              </div>
            </div>

            {/* Macros Breakdown (Protein, Carbs, Fat) */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-dark-border">
              {/* Protein */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Protein</span>
                  <span className="text-white font-semibold">{consumedProtein}g</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-dark-inner overflow-hidden">
                  <div
                    style={{ width: `${proteinPercent}%` }}
                    className="h-full bg-sky-400 rounded-full transition-all"
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">Goal: {targetProtein}g</span>
              </div>

              {/* Carbohydrates */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Carbs</span>
                  <span className="text-white font-semibold">{consumedCarbs}g</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-dark-inner overflow-hidden">
                  <div
                    style={{ width: `${carbsPercent}%` }}
                    className="h-full bg-amber-400 rounded-full transition-all"
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">Goal: {targetCarbs}g</span>
              </div>

              {/* Fat */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400 font-medium">Fat</span>
                  <span className="text-white font-semibold">{consumedFat}g</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-dark-inner overflow-hidden">
                  <div
                    style={{ width: `${fatPercent}%` }}
                    className="h-full bg-rose-400 rounded-full transition-all"
                  />
                </div>
                <span className="text-[10px] text-slate-500 block">Goal: {targetFat}g</span>
              </div>
            </div>
          </section>

          {/* Section C: Primary Quick Action */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onLogMealClick}
              className="w-full py-3.5 px-6 rounded-xl bg-lime-primary text-lime-dark font-extrabold text-sm hover:bg-lime-hover active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 shadow-md shadow-lime-primary/10"
            >
              <Camera className="w-4 h-4" />
              <span>Scan your food</span>
            </button>
          </div>

          {/* Section D: Today's Meals */}
          <section aria-labelledby="todays-meals-heading" className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h2 id="todays-meals-heading" className="text-base font-bold text-white">
                Today's Meals
              </h2>
              {meals.length > 0 && (
                <span className="text-xs text-slate-400 font-medium">
                  {meals.length} {meals.length === 1 ? 'meal' : 'meals'} logged
                </span>
              )}
            </div>

            {/* Empty State */}
            {meals.length === 0 ? (
              <div className="bg-dark-card rounded-2xl border border-dark-border p-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-dark-inner text-lime-primary flex items-center justify-center mx-auto border border-dark-border">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">Your day starts here.</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    Scan your first meal to track your nutrition.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLogMealClick}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-lime-primary text-lime-dark font-extrabold text-xs hover:bg-lime-hover transition-all"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan Food</span>
                </button>
              </div>
            ) : (
              /* Meals List */
              <div className="space-y-2.5">
                {meals.map((meal) => (
                  <button
                    key={meal.id}
                    type="button"
                    onClick={() => setSelectedMealDetail(meal)}
                    className="w-full text-left p-3.5 rounded-xl bg-dark-card border border-dark-border hover:border-lime-primary/30 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {meal.image_url ? (
                        <img
                          src={meal.image_url}
                          alt={meal.meal_type}
                          className="w-12 h-12 rounded-lg object-cover shrink-0 bg-dark-inner border border-dark-border"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-dark-inner text-lime-primary flex items-center justify-center shrink-0 border border-dark-border font-bold text-xs uppercase">
                          {meal.meal_type.slice(0, 2)}
                        </div>
                      )}

                      <div className="min-w-0 space-y-0.5">
                        <div className="font-semibold text-white text-sm truncate capitalize group-hover:text-lime-primary transition-colors">
                          {meal.food_names && meal.food_names.length > 0
                            ? meal.food_names.join(', ')
                            : `${meal.meal_type} meal`}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span className="capitalize">{meal.meal_type}</span>
                          {meal.time_logged && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {meal.time_logged}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold text-white">
                        {Math.round(meal.calories)} kcal
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {Math.round(meal.protein)}g P • {Math.round(meal.carbohydrates)}g C
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Meal Detail Modal */}
      {selectedMealDetail && (
        <MealDetailModal
          meal={selectedMealDetail}
          onClose={() => setSelectedMealDetail(null)}
        />
      )}
    </div>
  );
};
