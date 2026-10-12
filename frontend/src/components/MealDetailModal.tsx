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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-dark-card rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-dark-border max-h-[90vh] overflow-y-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-dark-border">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-lime-primary bg-lime-primary/10 px-2 py-0.5 rounded border border-lime-primary/30 capitalize">
                {meal.meal_type}
              </span>
              {meal.is_optimized_version && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-sky-400" />
                  Optimized Version
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-white mt-1 capitalize">
              {meal.food_names && meal.food_names.length > 0
                ? meal.food_names.join(', ')
                : `${meal.meal_type} Meal`}
            </h3>
            <div className="flex items-center gap-3 text-xs text-dark-muted mt-1">
              {meal.created_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  {meal.created_at.split('T')[0]}
                </span>
              )}
              {meal.time_logged && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  {meal.time_logged}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-dark-muted hover:text-white p-1.5 rounded-lg hover:bg-dark-inner transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Optimization Notes Banner */}
        {meal.is_optimized_version && meal.optimization_notes && (
          <div className="bg-dark-inner border border-sky-500/30 rounded-xl p-3 text-xs text-sky-200 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white">Meal Optimizer History:</span>
              <p className="mt-0.5 text-sky-200/90">{meal.optimization_notes}</p>
            </div>
          </div>
        )}

        {/* Total Energy and Honest Uncertainty */}
        <div className="bg-dark-inner border border-dark-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-dark-muted uppercase tracking-wider">
              Total Energy
            </span>
            <div className="text-3xl font-black text-white mt-0.5 font-mono">
              ~{Math.round(meal.calories)}{' '}
              <span className="text-xs font-normal text-dark-muted font-sans">kcal</span>
            </div>
            <p className="text-xs text-lime-primary font-medium mt-1 font-mono">
              {meal.formatted_estimate}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-semibold text-dark-muted block">Items Logged</span>
            <span className="text-lg font-bold text-white font-mono">{meal.item_count}</span>
          </div>
        </div>

        {/* Macronutrient Distribution */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-dark-muted mb-3">
            Macronutrient Breakdown
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-dark-inner border border-lime-primary/30 rounded-xl p-3">
              <span className="text-[11px] font-bold text-lime-primary">Protein</span>
              <p className="text-base font-black text-white mt-0.5 font-mono">{meal.protein}g</p>
            </div>
            <div className="bg-dark-inner border border-amber-400/30 rounded-xl p-3">
              <span className="text-[11px] font-bold text-amber-400">Carbs</span>
              <p className="text-base font-black text-white mt-0.5 font-mono">{meal.carbohydrates}g</p>
            </div>
            <div className="bg-dark-inner border border-rose-400/30 rounded-xl p-3">
              <span className="text-[11px] font-bold text-rose-400">Fat</span>
              <p className="text-base font-black text-white mt-0.5 font-mono">{meal.fat}g</p>
            </div>
            <div className="bg-dark-inner border border-emerald-400/30 rounded-xl p-3">
              <span className="text-[11px] font-bold text-emerald-400">Fiber</span>
              <p className="text-base font-black text-white mt-0.5 font-mono">{meal.fiber}g</p>
            </div>
          </div>
        </div>

        {/* Constituent Foods */}
        {meal.food_names && meal.food_names.length > 0 && (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-dark-muted mb-2">
              Constituent Food Items
            </h4>
            <div className="bg-dark-inner border border-dark-border rounded-xl p-3 divide-y divide-dark-border/40 text-xs">
              {meal.food_names.map((name, i) => (
                <div key={i} className="py-1.5 flex items-center justify-between text-slate-200">
                  <span className="font-semibold">{name}</span>
                  <span className="text-dark-muted text-[11px]">Database verified item</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Notes */}
        {meal.notes && (
          <div className="text-xs text-slate-300 bg-dark-inner border border-dark-border rounded-xl p-3">
            <span className="font-bold text-white block mb-0.5">Notes:</span>
            {meal.notes}
          </div>
        )}

        {/* Scientific Disclaimer */}
        <div className="text-[11px] text-dark-muted flex items-start gap-1.5 pt-2 border-t border-dark-border">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
          <span>
            Portion estimates and macro aggregations are calculated mathematically using verified nutritional databases.
          </span>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-dark-inner hover:bg-dark-border border border-dark-border text-slate-200 text-xs font-bold rounded-xl transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
