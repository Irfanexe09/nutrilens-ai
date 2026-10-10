import React, { useState, useEffect } from 'react';
import {
  Filter,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Clock,
  Utensils,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import { Meal, DailyMealItem } from '../types';

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
  const [versionFilter, setVersionFilter] = useState<'all' | 'original' | 'optimized'>('all');

  useEffect(() => {
    loadMeals();
  }, [page, selectedMealType, selectedDate, versionFilter]);

  const loadMeals = async () => {
    setLoading(true);
    try {
      const filters: any = {};
      if (selectedMealType !== 'all') filters.meal_type = selectedMealType;
      if (selectedDate) filters.date = selectedDate;
      if (versionFilter === 'original') filters.is_optimized_version = false;
      if (versionFilter === 'optimized') filters.is_optimized_version = true;

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
    setVersionFilter('all');
    setPage(0);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Meal History Filters</h3>
          </div>

          {(selectedMealType !== 'all' || selectedDate !== '' || versionFilter !== 'all') && (
            <button
              onClick={handleClearFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 self-start sm:self-auto"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Meal Type Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Meal Category
            </label>
            <select
              value={selectedMealType}
              onChange={(e) => {
                setSelectedMealType(e.target.value);
                setPage(0);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-emerald-500"
            >
              <option value="all">All Categories</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Calendar Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPage(0);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-emerald-500"
            />
          </div>

          {/* Version Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Optimizer Version
            </label>
            <select
              value={versionFilter}
              onChange={(e) => {
                setVersionFilter(e.target.value as any);
                setPage(0);
              }}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:outline-emerald-500"
            >
              <option value="all">All Versions</option>
              <option value="original">Original Meals Only</option>
              <option value="optimized">Optimized Versions Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Meals List */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading meal records...</p>
        </div>
      ) : meals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center space-y-3">
          <Utensils className="w-10 h-10 text-slate-400 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">No Meals Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            No saved meals matched the selected filters. Clear your filters or log a meal photo to record your nutrition.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={handleClearFilters}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              Clear Filters
            </button>
            <button
              onClick={onLogMeal}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
            >
              Scan Food
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total} meals
            </span>
          </div>

          <div className="divide-y divide-slate-100 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            {meals.map((meal) => {
              const foodNames = meal.items?.map((it) => it.food_name) || [];
              const dateStr = meal.created_at ? meal.created_at.split('T')[0] : '';
              const timeStr = meal.created_at
                ? new Date(meal.created_at).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : '';

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
                  `Estimated: ~${Math.round(meal.total_calories)} kcal (±${Math.round(meal.uncertainty_calories)} kcal)`,
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
                  className="p-4 hover:bg-slate-50/80 cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {meal.meal_type}
                      </span>
                      {meal.is_optimized_version && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-teal-600" />
                          Optimized Alternative
                        </span>
                      )}
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {foodNames.length > 0 ? foodNames.join(', ') : `${meal.meal_type} meal`}
                      </span>
                    </div>

                    {meal.is_optimized_version && meal.optimization_notes && (
                      <p className="text-xs text-teal-700 italic">"{meal.optimization_notes}"</p>
                    )}

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {dateStr}
                      </span>
                      {timeStr && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {timeStr}
                        </span>
                      )}
                      <span>·</span>
                      <span>{meal.items?.length || 0} items</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-base font-black text-slate-900">
                      ~{Math.round(meal.total_calories)}{' '}
                      <span className="text-xs font-normal text-slate-500">kcal</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {meal.total_protein}g P · {meal.total_carbohydrates}g C · {meal.total_fat}g F · {meal.total_fiber}g Fib
                    </div>
                    <span className="text-[11px] text-emerald-700 font-semibold group-hover:underline block mt-1">
                      Inspect breakdown →
                    </span>
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
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>

              <span className="text-xs text-slate-500 font-semibold">
                Page {page + 1} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 disabled:opacity-40 hover:bg-slate-50 transition"
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
