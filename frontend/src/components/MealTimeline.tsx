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
  iconBg: string;
}

const SLOTS: SlotConfig[] = [
  {
    key: 'breakfast',
    title: 'Breakfast',
    subtitle: 'Morning meal & fuel',
    icon: <Coffee className="w-4 h-4 text-amber-400" />,
    iconBg: 'bg-amber-400/10 border border-amber-400/20',
  },
  {
    key: 'lunch',
    title: 'Lunch',
    subtitle: 'Midday energy & sustenance',
    icon: <Sun className="w-4 h-4 text-lime-primary" />,
    iconBg: 'bg-lime-dim border border-lime-primary/20',
  },
  {
    key: 'dinner',
    title: 'Dinner',
    subtitle: 'Evening nutrition & recovery',
    icon: <Moon className="w-4 h-4 text-sky-400" />,
    iconBg: 'bg-sky-400/10 border border-sky-400/20',
  },
  {
    key: 'snack',
    title: 'Snacks & Beverages',
    subtitle: 'Intermittent sides & nourishment',
    icon: <Apple className="w-4 h-4 text-rose-400" />,
    iconBg: 'bg-rose-400/10 border border-rose-400/20',
  },
];

export const MealTimeline: React.FC<MealTimelineProps> = ({
  timeline,
  onLogMeal,
  onViewMealDetail,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-dark-border">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Utensils className="w-4 h-4 text-lime-primary" />
            Today's Meal Timeline
          </h3>
          <p className="text-xs text-slate-400">
            Chronological breakdown of recorded meals across daily slots.
          </p>
        </div>
        <button
          onClick={onLogMeal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-lime-primary hover:bg-lime-hover text-lime-dark rounded-xl text-xs font-bold transition shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Log Meal</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SLOTS.map((slot) => {
          const meals = timeline ? timeline[slot.key] || [] : [];
          const slotCalories = meals.reduce((sum, m) => sum + m.calories, 0);

          return (
            <div
              key={slot.key}
              className={`rounded-2xl border p-4 transition-all ${
                meals.length > 0
                  ? 'bg-dark-card border-dark-border shadow-md'
                  : 'bg-dark-inner/40 border-dashed border-dark-border'
              }`}
            >
              {/* Slot Header */}
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-dark-border">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl ${slot.iconBg}`}>{slot.icon}</div>
                  <div>
                    <h4 className="text-sm font-bold text-white">{slot.title}</h4>
                    <span className="text-[10px] text-slate-400">{slot.subtitle}</span>
                  </div>
                </div>

                {meals.length > 0 ? (
                  <span className="text-xs font-black text-white font-mono">
                    ~{Math.round(slotCalories)}{' '}
                    <span className="text-[10px] font-normal text-slate-400">kcal</span>
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-500 font-medium font-mono">Unlogged</span>
                )}
              </div>

              {/* Slot Content */}
              {meals.length === 0 ? (
                <div className="py-5 text-center space-y-2">
                  <p className="text-xs text-slate-500">No {slot.title.toLowerCase()} recorded yet.</p>
                  <button
                    onClick={onLogMeal}
                    className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold text-lime-primary bg-lime-dim hover:bg-lime-dim/80 rounded-lg transition border border-lime-primary/20"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Record {slot.title}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {meals.map((meal) => (
                    <div
                      key={meal.id}
                      onClick={() => onViewMealDetail(meal)}
                      className="p-3 rounded-xl border border-dark-border bg-dark-inner hover:bg-dark-cardHover cursor-pointer transition flex items-center justify-between gap-3 group"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white truncate group-hover:text-lime-primary transition-colors">
                            {meal.food_names && meal.food_names.length > 0
                              ? meal.food_names.join(', ')
                              : `${meal.meal_type} meal`}
                          </span>
                          {meal.is_optimized_version && (
                            <span className="text-[9px] font-bold uppercase text-lime-primary bg-lime-dim px-1.5 py-0.5 rounded border border-lime-primary/20 flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" />
                              Optimized
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                          {meal.time_logged && (
                            <span className="flex items-center gap-0.5 text-slate-500">
                              <Clock className="w-3 h-3" />
                              {meal.time_logged}
                            </span>
                          )}
                          <span>•</span>
                          <span className="text-sky-400">{meal.protein}g P</span>
                          <span>•</span>
                          <span className="text-amber-400">{meal.carbohydrates}g C</span>
                          <span>•</span>
                          <span className="text-rose-400">{meal.fat}g F</span>
                        </div>
                      </div>

                      <div className="text-right flex items-center gap-2 shrink-0">
                        <div>
                          <div className="text-xs font-black text-white font-mono">
                            ~{Math.round(meal.calories)} kcal
                          </div>
                          <span className="text-[10px] text-lime-primary font-semibold group-hover:underline">
                            Inspect
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-lime-primary transition-colors" />
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
