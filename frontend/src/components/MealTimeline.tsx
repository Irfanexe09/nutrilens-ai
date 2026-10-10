import React from 'react';
import { Clock, Plus, Sparkles, ChevronRight, Utensils, Coffee, Sun, Moon, Apple } from 'lucide-react';
import { DailyMealItem } from '../types';

interface MealTimelineProps {
  timeline?: {
    breakfast: DailyMealItem[];
    lunch: DailyMealItem[];
    dinner: DailyMealItem[];
    snack: DailyMealItem[];
  };
  onLogMeal: () => void;
  onViewMealDetail: (meal: DailyMealItem) => void;
}

interface SlotConfig {
  key: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  bgLight: string;
}

const SLOTS: SlotConfig[] = [
  {
    key: 'breakfast',
    title: 'Breakfast',
    subtitle: 'Morning meal & fuel',
    icon: <Coffee className="w-4 h-4 text-amber-600" />,
    bgLight: 'bg-amber-50/50',
  },
  {
    key: 'lunch',
    title: 'Lunch',
    subtitle: 'Midday energy & sustenance',
    icon: <Sun className="w-4 h-4 text-emerald-600" />,
    bgLight: 'bg-emerald-50/50',
  },
  {
    key: 'dinner',
    title: 'Dinner',
    subtitle: 'Evening nutrition & recovery',
    icon: <Moon className="w-4 h-4 text-indigo-600" />,
    bgLight: 'bg-indigo-50/50',
  },
  {
    key: 'snack',
    title: 'Snacks & Beverages',
    subtitle: 'Intermittent sides & nourishment',
    icon: <Apple className="w-4 h-4 text-rose-600" />,
    bgLight: 'bg-rose-50/50',
  },
];

export const MealTimeline: React.FC<MealTimelineProps> = ({
  timeline,
  onLogMeal,
  onViewMealDetail,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Utensils className="w-4 h-4 text-emerald-600" />
            Today's Meal Timeline
          </h3>
          <p className="text-xs text-slate-500">
            Chronological breakdown of recorded meals across daily slots.
          </p>
        </div>
        <button
          onClick={onLogMeal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Log Meal
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SLOTS.map((slot) => {
          const meals = timeline ? timeline[slot.key] || [] : [];
          const slotCalories = meals.reduce((sum, m) => sum + m.calories, 0);

          return (
            <div
              key={slot.key}
              className={`rounded-2xl border border-slate-200 p-4 transition-all ${
                meals.length > 0 ? 'bg-white shadow-2xs' : 'bg-slate-50/60 border-dashed'
              }`}
            >
              {/* Slot Header */}
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${slot.bgLight}`}>{slot.icon}</div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{slot.title}</h4>
                    <span className="text-[10px] text-slate-400">{slot.subtitle}</span>
                  </div>
                </div>

                {meals.length > 0 ? (
                  <span className="text-xs font-black text-slate-900">
                    ~{Math.round(slotCalories)}{' '}
                    <span className="text-[10px] font-normal text-slate-500">kcal</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium">Unlogged</span>
                )}
              </div>

              {/* Slot Content */}
              {meals.length === 0 ? (
                <div className="py-5 text-center">
                  <p className="text-xs text-slate-500 mb-2">No {slot.title.toLowerCase()} recorded yet.</p>
                  <button
                    onClick={onLogMeal}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition border border-emerald-200"
                  >
                    <Plus className="w-3 h-3" />
                    Record {slot.title}
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {meals.map((meal) => (
                    <div
                      key={meal.id}
                      onClick={() => onViewMealDetail(meal)}
                      className="p-3 rounded-xl border border-slate-100 bg-slate-50/80 hover:bg-slate-100/80 cursor-pointer transition flex items-center justify-between gap-3 group"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {meal.food_names && meal.food_names.length > 0
                              ? meal.food_names.join(', ')
                              : `${meal.meal_type} meal`}
                          </span>
                          {meal.is_optimized_version && (
                            <span className="text-[9px] font-bold uppercase text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              Optimized
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          {meal.time_logged && (
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {meal.time_logged}
                            </span>
                          )}
                          <span>·</span>
                          <span>{meal.protein}g P</span>
                          <span>·</span>
                          <span>{meal.carbohydrates}g C</span>
                          <span>·</span>
                          <span>{meal.fat}g F</span>
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-2 shrink-0">
                        <div>
                          <div className="text-xs font-black text-slate-900">
                            ~{Math.round(meal.calories)} kcal
                          </div>
                          <span className="text-[10px] text-emerald-700 font-semibold group-hover:underline">
                            View details
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
