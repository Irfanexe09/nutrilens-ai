import React, { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Utensils,
  X,
  Camera,
  Filter,
} from 'lucide-react';
import { api } from '../services/api';
import { Meal, DailyMealItem, WeeklyAnalyticsResponse } from '../types';

interface MealHistoryProps {
  onSelectMeal: (meal: DailyMealItem) => void;
  onLogMeal: () => void;
}

export const MealHistory: React.FC<MealHistoryProps> = ({ onSelectMeal, onLogMeal }) => {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 10;

  // Filters
  const [selectedMealType, setSelectedMealType] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Weekly analytics
  const [weeklyData, setWeeklyData] = useState<WeeklyAnalyticsResponse | null>(null);

  useEffect(() => {
    if (api.getToken()) {
      api.getWeeklyAnalytics().then(setWeeklyData).catch(() => {});
    }
  }, []);

  useEffect(() => {
    loadMeals();
  }, [page, selectedMealType, selectedDate]);

  const loadMeals = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (selectedMealType !== 'all') filters.meal_type = selectedMealType;
      if (selectedDate) filters.date = selectedDate;

      const res = await api.getMeals(page * limit, limit, filters);
      setMeals(res.meals);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load meal history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSelectedMealType('all');
    setSelectedDate('');
    setPage(0);
  };

  const totalPages = Math.ceil(total / limit);

  // Group meals by date
  const getDateLabel = (dateStr?: string) => {
    if (!dateStr) return 'Past Meals';
    const cleanDate = dateStr.split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    if (cleanDate === today) return 'Today';
    if (cleanDate === yesterday) return 'Yesterday';

    try {
      return new Date(cleanDate + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return cleanDate;
    }
  };

  const hasActiveFilters = selectedMealType !== 'all' || selectedDate !== '';

  return (
    <div className="space-y-6">
      {/* 7-Day Calorie Summary */}
      {weeklyData && weeklyData.days && weeklyData.days.length > 0 && (
        <section aria-labelledby="weekly-summary-heading" className="bg-dark-card rounded-2xl border border-dark-border p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 id="weekly-summary-heading" className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Past 7 Days
            </h2>
            <span className="text-[11px] text-slate-400">
              Daily Target: {weeklyData.days[weeklyData.days.length - 1]?.calorie_target || 2000} kcal
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 pt-2 items-end h-28">
            {weeklyData.days.map((day, i) => {
              const target = day.calorie_target || 2000;
              const cal = day.calories || 0;
              const heightPct = Math.min(100, Math.round((cal / target) * 100));
              const isOver = cal > target;

              return (
                <div key={i} className="flex flex-col items-center h-full justify-end gap-1.5">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {cal > 0 ? Math.round(cal) : ''}
                  </span>
                  <div className="w-full bg-dark-inner rounded-t-lg h-16 flex items-end overflow-hidden p-0.5">
                    <div
                      style={{ height: `${cal === 0 ? 0 : Math.max(8, heightPct)}%` }}
                      className={`w-full rounded-t transition-all duration-300 ${
                        cal === 0
                          ? 'bg-transparent'
                          : isOver
                          ? 'bg-coral-primary'
                          : 'bg-lime-primary'
                      }`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {day.day_name.slice(0, 3)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Filter Bar */}
      <div className="bg-dark-card rounded-2xl border border-dark-border p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-lime-primary shrink-0" />
          <span className="text-xs font-bold text-white">Filter Meals</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category */}
          <select
            value={selectedMealType}
            onChange={(e) => {
              setSelectedMealType(e.target.value);
              setPage(0);
            }}
            className="text-xs bg-dark-inner border border-dark-border rounded-xl px-3 py-1.5 text-slate-200 font-semibold focus:border-lime-primary outline-none"
          >
            <option value="all">All Categories</option>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="snack">Snack</option>
          </select>

          {/* Date */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setPage(0);
            }}
            className="text-xs bg-dark-inner border border-dark-border rounded-xl px-2.5 py-1.5 text-slate-200 font-semibold focus:border-lime-primary outline-none"
          />

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-coral-primary hover:text-white flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-dark-inner hover:bg-dark-cardHover transition"
            >
              <X className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Meals List */}
      {loading ? (
        <div className="py-16 text-center space-y-2">
          <div className="w-8 h-8 border-2 border-lime-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading your meal records...</p>
        </div>
      ) : meals.length === 0 ? (
        <div className="bg-dark-card rounded-2xl border border-dashed border-dark-border p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-dark-inner text-lime-primary flex items-center justify-center mx-auto border border-dark-border">
            <Utensils className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              {hasActiveFilters ? 'No meals found' : 'No meals logged yet.'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {hasActiveFilters
                ? 'No saved meals matched the selected filters. Clear your filters or log a meal photo.'
                : 'Start by scanning your first meal.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 bg-dark-inner hover:bg-dark-cardHover text-slate-300 text-xs font-semibold rounded-xl border border-dark-border transition"
              >
                Clear Filters
              </button>
            )}
            <button
              onClick={onLogMeal}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-lime-primary hover:bg-lime-hover text-lime-dark text-xs font-extrabold rounded-xl shadow-md transition"
            >
              <Camera className="w-4 h-4" />
              <span>Scan Food</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total} meals
            </span>
          </div>

          <div className="space-y-2.5">
            {meals.map((meal) => {
              const foodNames = meal.items?.map((it) => it.food_name) || [];
              const timeStr = meal.created_at
                ? new Date(meal.created_at).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : '';
              const dateLabel = getDateLabel(meal.created_at);

              const dailyMealItem: DailyMealItem = {
                id: meal.id,
                meal_type: meal.meal_type || 'meal',
                image_url: meal.image_url,
                created_at: meal.created_at,
                time_logged: timeStr,
                calories: meal.total_calories,
                protein: meal.total_protein,
                carbohydrates: meal.total_carbohydrates,
                fat: meal.total_fat,
                fiber: meal.total_fiber,
                formatted_estimate:
                  meal.formatted_estimate ||
                  `Estimated: ~${Math.round(meal.total_calories)} kcal`,
                item_count: meal.items?.length || 0,
                food_names: foodNames,
                parent_meal_id: meal.parent_meal_id,
                is_optimized_version: meal.is_optimized_version,
                optimization_notes: meal.optimization_notes,
                notes: meal.notes,
              };

              return (
                <div
                  key={meal.id}
                  onClick={() => onSelectMeal(dailyMealItem)}
                  className="p-3.5 rounded-xl bg-dark-card border border-dark-border hover:border-lime-primary/30 cursor-pointer transition flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {meal.image_url ? (
                      <img
                        src={meal.image_url}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover shrink-0 bg-dark-inner border border-dark-border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-dark-inner text-lime-primary flex items-center justify-center shrink-0 border border-dark-border font-bold text-xs uppercase">
                        {meal.meal_type.slice(0, 2)}
                      </div>
                    )}

                    <div className="min-w-0 space-y-0.5">
                      <div className="font-semibold text-white text-sm truncate group-hover:text-lime-primary transition-colors">
                        {foodNames.length > 0 ? foodNames.join(', ') : `${meal.meal_type} meal`}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {dateLabel}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {timeStr || meal.meal_type}
                        </span>
                        <span>•</span>
                        <span className="capitalize">{meal.meal_type}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-white">
                      {Math.round(meal.total_calories)} kcal
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {Math.round(meal.total_protein)}g protein
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-dark-card border border-dark-border rounded-xl text-xs font-bold text-slate-300 disabled:opacity-40 hover:bg-dark-inner hover:text-white transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>

              <span className="text-xs text-slate-400 font-semibold">
                Page {page + 1} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-dark-card border border-dark-border rounded-xl text-xs font-bold text-slate-300 disabled:opacity-40 hover:bg-dark-inner hover:text-white transition"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
