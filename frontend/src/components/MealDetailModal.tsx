import React from 'react';
import { X, Sparkles, Info, Clock, Calendar } from 'lucide-react';
import { DailyMealItem } from '../types';

interface MealDetailModalProps {
  meal: DailyMealItem | null;
  onClose: () => void;
}

export const MealDetailModal: React.FC<MealDetailModalProps> = ({ meal, onClose }) => {
  if (!meal) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 capitalize">
                {meal.meal_type}
              </span>
              {meal.is_optimized_version && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-teal-600" />
                  Optimized Version
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-1 capitalize">
              {meal.food_names && meal.food_names.length > 0
                ? meal.food_names.join(', ')
                : `${meal.meal_type} Meal`}
            </h3>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              {meal.created_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {meal.created_at.split('T')[0]}
                </span>
              )}
              {meal.time_logged && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {meal.time_logged}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Optimization Notes Banner */}
        {meal.is_optimized_version && meal.optimization_notes && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs text-teal-900 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Meal Optimizer History:</span>
              <p className="mt-0.5">{meal.optimization_notes}</p>
            </div>
          </div>
        )}

        {/* Total Energy and Honest Uncertainty */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Energy
            </span>
            <div className="text-3xl font-black text-slate-900 mt-0.5">
              ~{Math.round(meal.calories)}{' '}
              <span className="text-xs font-normal text-slate-500">kcal</span>
            </div>
            <p className="text-xs text-slate-600 font-medium mt-1">
              {meal.formatted_estimate}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-semibold text-slate-500 block">Items Logged</span>
            <span className="text-lg font-bold text-slate-800">{meal.item_count}</span>
          </div>
        </div>

        {/* Macronutrient Distribution */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
            Macronutrient Breakdown
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
              <span className="text-[11px] font-bold text-emerald-800">Protein</span>
              <p className="text-base font-black text-emerald-950 mt-0.5">{meal.protein}g</p>
            </div>
            <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3">
              <span className="text-[11px] font-bold text-amber-800">Carbs</span>
              <p className="text-base font-black text-amber-950 mt-0.5">{meal.carbohydrates}g</p>
            </div>
            <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-3">
              <span className="text-[11px] font-bold text-rose-800">Fat</span>
              <p className="text-base font-black text-rose-950 mt-0.5">{meal.fat}g</p>
            </div>
            <div className="bg-teal-50/60 border border-teal-100 rounded-xl p-3">
              <span className="text-[11px] font-bold text-teal-800">Fiber</span>
              <p className="text-base font-black text-teal-950 mt-0.5">{meal.fiber}g</p>
            </div>
          </div>
        </div>

        {/* Constituent Foods */}
        {meal.food_names && meal.food_names.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Constituent Food Items
            </h4>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 divide-y divide-slate-200 text-xs">
              {meal.food_names.map((name, i) => (
                <div key={i} className="py-1.5 flex items-center justify-between text-slate-700">
                  <span className="font-semibold">{name}</span>
                  <span className="text-slate-500 text-[11px]">Database verified item</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Notes */}
        {meal.notes && (
          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <span className="font-bold text-slate-700 block mb-0.5">Notes:</span>
            {meal.notes}
          </div>
        )}

        {/* Scientific Disclaimer */}
        <div className="text-[11px] text-slate-500 flex items-start gap-1.5 pt-2 border-t border-slate-100">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>
            Portion estimates and macro aggregations are calculated mathematically using verified nutritional databases.
          </span>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
