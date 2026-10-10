import React, { useState, useEffect } from 'react';
import {
  Flame,
  Dumbbell,
  Wheat,
  Droplet,
  Salad,
  PlusCircle,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Sliders,
  BarChart3,
  History,
  LayoutDashboard,
} from 'lucide-react';
import { api } from '../services/api';
import {
  DailyNutritionResponse,
  WeeklyAnalyticsResponse,
  DailyMealItem,
} from '../types';
import { MealTimeline } from './MealTimeline';
import { WeeklyAnalyticsChart } from './WeeklyAnalyticsChart';
import { MealHistory } from './MealHistory';
import { MealDetailModal } from './MealDetailModal';

interface DashboardProps {
  onLogMealClick: () => void;
  onConfigureProfileClick: () => void;
}

type DashboardSubTab = 'daily' | 'weekly' | 'history';

export const Dashboard: React.FC<DashboardProps> = ({
  onLogMealClick,
  onConfigureProfileClick,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeSubTab, setActiveSubTab] = useState<DashboardSubTab>('daily');
  const [dailyData, setDailyData] = useState<DailyNutritionResponse | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyAnalyticsResponse | null>(null);
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMealDetail, setSelectedMealDetail] = useState<DailyMealItem | null>(null);

  // Initialize and load daily data
  useEffect(() => {
    loadDailyMetrics();
  }, [selectedDate]);

  // Load weekly data when switching to weekly analytics tab
  useEffect(() => {
    if (activeSubTab === 'weekly') {
      loadWeeklyMetrics();
    }
  }, [activeSubTab, selectedDate]);

  const loadDailyMetrics = async () => {
    setLoadingDaily(true);
    setError(null);
    try {
      if (!api.getToken()) {
        const demoEmail = `demo_guest_${Date.now()}@nutrilens.ai`;
        await api.register(demoEmail, 'DemoPass123!', 'Guest Explorer');
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
      setLoadingDaily(false);
    }
  };

  const loadWeeklyMetrics = async () => {
    setLoadingWeekly(true);
    try {
      const res = await api.getWeeklyAnalytics(selectedDate, 7);
      setWeeklyData(res);
    } catch (err: any) {
      console.error('Failed to load weekly analytics:', err);
    } finally {
      setLoadingWeekly(false);
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
  const isFuturePrevented = selectedDate >= todayStr;

  // Generate quick 7-day strip
  const quickDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Top Banner & Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Phase 6: Tracking & Analytics
            </span>
            {isToday && (
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                Today
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Nutrition Tracking Dashboard
          </h1>
          <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
            Deterministic daily intake, weekly trends, and auditable meal history.
          </p>
        </div>

        {/* Date Selector & Primary Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white border border-slate-300 rounded-xl p-1 shadow-2xs">
            <button
              onClick={() => shiftDate(-1)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600"
              title="Previous Day"
              aria-label="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <input
              type="date"
              max={todayStr}
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value <= todayStr) {
                  setSelectedDate(e.target.value);
                }
              }}
              className="text-xs font-semibold text-slate-700 bg-transparent px-2 py-1 focus:outline-none"
              aria-label="Select Date"
            />
            <button
              onClick={() => shiftDate(1)}
              disabled={isFuturePrevented}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
              title={isFuturePrevented ? 'Future dates not supported' : 'Next Day'}
              aria-label="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onLogMealClick}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            Scan / Log Meal
          </button>
        </div>
      </div>

      {/* Quick 7-Day Quick Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
          Quick Jump:
        </span>
        {quickDays.map((dStr) => {
          const dObj = new Date(dStr);
          const dayName = dObj.toLocaleDateString(undefined, { weekday: 'short' });
          const isSelected = selectedDate === dStr;
          const isCurrentToday = dStr === todayStr;

          return (
            <button
              key={dStr}
              onClick={() => setSelectedDate(dStr)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition shrink-0 flex items-center gap-1 ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              <span>{dayName}</span>
              <span className={`text-[10px] ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                {dStr.slice(5)}
              </span>
              {isCurrentToday && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('daily')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition ${
            activeSubTab === 'daily'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Today's Intake & Timeline
        </button>

        <button
          onClick={() => setActiveSubTab('weekly')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition ${
            activeSubTab === 'weekly'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          7-Day Analytics & Trends
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition ${
            activeSubTab === 'history'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          Meal History Log
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
          <button
            onClick={loadDailyMetrics}
            className="ml-auto underline font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {/* SUB-TAB 1: DAILY INTAKE & TIMELINE */}
      {activeSubTab === 'daily' && (
        loadingDaily ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Loading daily metrics...</p>
          </div>
        ) : dailyData ? (
          <div className="space-y-6">
            {/* Energy Expenditure Progress Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shadow-2xs">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Energy Balance & Daily Budget
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                      <span>Target: ~{Math.round(dailyData.target.calorie_target)} kcal / day</span>
                      <span>·</span>
                      <button
                        onClick={onConfigureProfileClick}
                        className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1"
                      >
                        <Sliders className="w-3 h-3" />
                        Adjust Goal
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 self-start sm:self-auto ${
                    dailyData.overage.is_over_target
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>{dailyData.overage.status_message}</span>
                </div>
              </div>

              {/* Calorie Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <span className="text-xs font-semibold text-slate-500">Consumed Today</span>
                  <p className="text-2xl font-black text-slate-900 mt-0.5">
                    ~{Math.round(dailyData.consumed.calories)}{' '}
                    <span className="text-xs font-normal text-slate-500">kcal</span>
                  </p>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-3">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        dailyData.overage.is_over_target ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(100, dailyData.percentages.calories)}%` }}
                      role="progressbar"
                      aria-valuenow={dailyData.percentages.calories}
                      aria-valuemin={0}
                      aria-valuemax={100}
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
                    Mifflin-St Jeor BMR & personal activity multiplier
                  </p>
                </div>

                <div
                  className={`p-4 rounded-xl border ${
                    dailyData.overage.is_over_target
                      ? 'bg-amber-50/50 border-amber-200'
                      : 'bg-emerald-50/50 border-emerald-200'
                  }`}
                >
                  <span
                    className={`text-xs font-semibold ${
                      dailyData.overage.is_over_target ? 'text-amber-800' : 'text-emerald-700'
                    }`}
                  >
                    {dailyData.overage.is_over_target ? 'Amount Above Target' : 'Remaining Budget'}
                  </span>
                  <p
                    className={`text-2xl font-black mt-0.5 ${
                      dailyData.overage.is_over_target ? 'text-amber-900' : 'text-emerald-800'
                    }`}
                  >
                    {dailyData.overage.is_over_target
                      ? `+${Math.round(dailyData.overage.calories)}`
                      : `~${Math.round(dailyData.remaining.calories)}`}{' '}
                    <span className="text-xs font-normal">kcal</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-3">
                    {dailyData.overage.is_over_target
                      ? 'Total exceeds target budget for today'
                      : 'Available within estimated target'}
                  </p>
                </div>
              </div>
            </div>

            {/* Macronutrients Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Protein */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Dumbbell className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold text-slate-900">Protein</h4>
                  </div>
                  <span className="text-xs font-bold text-emerald-700">
                    {dailyData.percentages.protein}%
                  </span>
                </div>
                <p className="text-xl font-bold text-slate-900">
                  {dailyData.consumed.protein_g}g{' '}
                  <span className="text-xs font-normal text-slate-500">
                    / {dailyData.target.protein_target_g}g
                  </span>
                </p>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, dailyData.percentages.protein)}%` }}
                    role="progressbar"
                    aria-valuenow={dailyData.percentages.protein}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {dailyData.remaining.protein_g > 0
                    ? `${dailyData.remaining.protein_g}g remaining`
                    : 'Target reached!'}
                </p>
              </div>

              {/* Carbohydrates */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Wheat className="w-4 h-4 text-amber-600" />
                    <h4 className="text-xs font-bold text-slate-900">Carbs</h4>
                  </div>
                  <span className="text-xs font-bold text-amber-700">
                    {dailyData.percentages.carbohydrates}%
                  </span>
                </div>
                <p className="text-xl font-bold text-slate-900">
                  {dailyData.consumed.carbohydrates_g}g{' '}
                  <span className="text-xs font-normal text-slate-500">
                    / {dailyData.target.carbohydrates_target_g}g
                  </span>
                </p>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, dailyData.percentages.carbohydrates)}%` }}
                    role="progressbar"
                    aria-valuenow={dailyData.percentages.carbohydrates}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {dailyData.remaining.carbohydrates_g > 0
                    ? `${dailyData.remaining.carbohydrates_g}g remaining`
                    : 'Target reached!'}
                </p>
              </div>

              {/* Fat */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Droplet className="w-4 h-4 text-rose-600" />
                    <h4 className="text-xs font-bold text-slate-900">Fat</h4>
                  </div>
                  <span className="text-xs font-bold text-rose-700">
                    {dailyData.percentages.fat}%
                  </span>
                </div>
                <p className="text-xl font-bold text-slate-900">
                  {dailyData.consumed.fat_g}g{' '}
                  <span className="text-xs font-normal text-slate-500">
                    / {dailyData.target.fat_target_g}g
                  </span>
                </p>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, dailyData.percentages.fat)}%` }}
                    role="progressbar"
                    aria-valuenow={dailyData.percentages.fat}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {dailyData.remaining.fat_g > 0
                    ? `${dailyData.remaining.fat_g}g remaining`
                    : 'Target reached!'}
                </p>
              </div>

              {/* Dietary Fiber */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Salad className="w-4 h-4 text-teal-600" />
                    <h4 className="text-xs font-bold text-slate-900">Fiber</h4>
                  </div>
                  <span className="text-xs font-bold text-teal-700">
                    {dailyData.percentages.fiber}%
                  </span>
                </div>
                <p className="text-xl font-bold text-slate-900">
                  {dailyData.consumed.fiber_g}g{' '}
                  <span className="text-xs font-normal text-slate-500">
                    / {dailyData.target.fiber_target_g}g
                  </span>
                </p>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-teal-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, dailyData.percentages.fiber)}%` }}
                    role="progressbar"
                    aria-valuenow={dailyData.percentages.fiber}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {dailyData.remaining.fiber_g > 0
                    ? `${dailyData.remaining.fiber_g}g remaining`
                    : 'Target reached!'}
                </p>
              </div>
            </div>

            {/* Meal Timeline Slots */}
            <MealTimeline
              timeline={dailyData.timeline}
              onLogMeal={onLogMealClick}
              onViewMealDetail={(meal) => setSelectedMealDetail(meal)}
            />
          </div>
        ) : null
      )}

      {/* SUB-TAB 2: 7-DAY ANALYTICS & TRENDS */}
      {activeSubTab === 'weekly' && (
        loadingWeekly ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500">Compiling 7-day analytics...</p>
          </div>
        ) : weeklyData ? (
          <WeeklyAnalyticsChart data={weeklyData} />
        ) : null
      )}

      {/* SUB-TAB 3: MEAL HISTORY LOG */}
      {activeSubTab === 'history' && (
        <MealHistory
          onSelectMeal={(meal) => setSelectedMealDetail(meal)}
          onLogMeal={onLogMealClick}
        />
      )}

      {/* Detail Modal */}
      <MealDetailModal
        meal={selectedMealDetail}
        onClose={() => setSelectedMealDetail(null)}
      />

      {/* Educational & Clinical Disclaimer */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-600">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px]">
          <strong>Notice:</strong> NutriLens estimates and daily targets are calculated using population formulas and verified nutritional data for informational purposes. They do not constitute medical prescriptions or diagnostic dietary advice.
        </p>
      </div>
    </div>
  );
};
