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
  Loader2,
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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-fadeIn">
      {/* Top Banner & Date Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-dark-border gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-lime-dim text-lime-primary border border-lime-primary/30">
              Nutrition Intelligence Dashboard
            </span>
            {isToday && (
              <span className="text-[11px] bg-dark-card text-slate-300 px-2.5 py-0.5 rounded-full border border-dark-border font-semibold">
                Today
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Daily Intake & Fuel Metrics
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
            Deterministic daily calories, macro ratios, and meal timeline.
          </p>
        </div>

        {/* Date Selector & Primary Action */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-dark-inner border border-dark-border rounded-xl p-1 shadow-sm">
            <button
              onClick={() => shiftDate(-1)}
              className="p-1.5 hover:bg-dark-card rounded-lg text-slate-300 hover:text-white transition-colors"
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
              className="text-xs font-semibold text-white bg-transparent px-2 py-1 focus:outline-none"
              aria-label="Select Date"
            />
            <button
              onClick={() => shiftDate(1)}
              disabled={isFuturePrevented}
              className="p-1.5 hover:bg-dark-card rounded-lg text-slate-300 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title={isFuturePrevented ? 'Future dates not supported' : 'Next Day'}
              aria-label="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={onLogMealClick}
            className="flex items-center gap-2 px-4 py-2.5 bg-lime-primary hover:bg-lime-hover text-lime-dark rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-lg shadow-lime-primary/10"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Scan / Log Meal</span>
          </button>
        </div>
      </div>

      {/* Quick 7-Day Jump Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
          Jump:
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
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-lime-primary text-lime-dark font-bold shadow-md shadow-lime-primary/10'
                  : 'bg-dark-card hover:bg-dark-cardHover text-slate-300 border border-dark-border'
              }`}
            >
              <span>{dayName}</span>
              <span className={`text-[10px] ${isSelected ? 'text-lime-900 font-bold' : 'text-slate-500'}`}>
                {dStr.slice(5)}
              </span>
              {isCurrentToday && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-lime-900' : 'bg-lime-primary'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Sub-Tabs: Daily | Weekly | History */}
      <div className="flex items-center gap-3 border-b border-dark-border">
        <button
          onClick={() => setActiveSubTab('daily')}
          className={`flex items-center gap-2 pb-3 px-2 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'daily'
              ? 'border-lime-primary text-lime-primary'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Intake & Timeline</span>
        </button>

        <button
          onClick={() => setActiveSubTab('weekly')}
          className={`flex items-center gap-2 pb-3 px-2 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'weekly'
              ? 'border-lime-primary text-lime-primary'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>7-Day Trends</span>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`flex items-center gap-2 pb-3 px-2 text-xs sm:text-sm font-bold border-b-2 transition-all ${
            activeSubTab === 'history'
              ? 'border-lime-primary text-lime-primary'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Meal History</span>
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-coral-dim border border-coral-primary/30 rounded-2xl p-4 text-xs text-coral-primary flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadDailyMetrics}
            className="underline font-bold hover:text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* SUB-TAB 1: DAILY INTAKE & TIMELINE */}
      {activeSubTab === 'daily' && (
        loadingDaily ? (
          <div className="py-24 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-lime-primary animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Loading daily metrics...</p>
          </div>
        ) : dailyData ? (
          <div className="space-y-6">
            {/* Energy Expenditure Progress Hero Card */}
            <div className="bg-gradient-to-br from-dark-card to-dark-elevated rounded-2xl border border-dark-border p-6 shadow-xl space-y-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-lime-primary/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-dark-border">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-lime-dim text-lime-primary border border-lime-primary/20 flex items-center justify-center shadow-sm">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Daily Caloric Budget & Balance
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      <span>Target: ~{Math.round(dailyData.target.calorie_target)} kcal</span>
                      <span>•</span>
                      <button
                        onClick={onConfigureProfileClick}
                        className="text-lime-primary hover:underline font-semibold flex items-center gap-1"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>Adjust Goals</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div
                  className={`px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-2 self-start sm:self-auto ${
                    dailyData.overage.is_over_target
                      ? 'bg-coral-dim text-coral-primary border-coral-primary/30'
                      : 'bg-lime-dim text-lime-primary border-lime-primary/30'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{dailyData.overage.status_message}</span>
                </div>
              </div>

              {/* 3-Column Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Consumed Today */}
                <div className="bg-dark-inner p-4 rounded-xl border border-dark-border space-y-2">
                  <span className="text-xs font-semibold text-slate-400">Consumed Today</span>
                  <p className="text-2xl font-black text-white">
                    ~{Math.round(dailyData.consumed.calories)}{' '}
                    <span className="text-xs font-normal text-slate-400">kcal</span>
                  </p>
                  <div className="w-full bg-dark-bg h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        dailyData.overage.is_over_target ? 'bg-coral-primary' : 'bg-lime-primary'
                      }`}
                      style={{ width: `${Math.min(100, dailyData.percentages.calories)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 text-right">
                    {dailyData.percentages.calories}% of daily target
                  </p>
                </div>

                {/* Target */}
                <div className="bg-dark-inner p-4 rounded-xl border border-dark-border space-y-2">
                  <span className="text-xs font-semibold text-slate-400">Estimated Target</span>
                  <p className="text-2xl font-black text-white">
                    ~{Math.round(dailyData.target.calorie_target)}{' '}
                    <span className="text-xs font-normal text-slate-400">kcal</span>
                  </p>
                  <p className="text-[11px] text-slate-500 pt-3">
                    Calculated via Mifflin-St Jeor equation & activity factor
                  </p>
                </div>

                {/* Remaining / Overage */}
                <div
                  className={`p-4 rounded-xl border space-y-2 ${
                    dailyData.overage.is_over_target
                      ? 'bg-coral-dim/30 border-coral-primary/30'
                      : 'bg-lime-dim/20 border-lime-primary/30'
                  }`}
                >
                  <span
                    className={`text-xs font-semibold ${
                      dailyData.overage.is_over_target ? 'text-coral-primary' : 'text-lime-primary'
                    }`}
                  >
                    {dailyData.overage.is_over_target ? 'Amount Above Target' : 'Remaining Budget'}
                  </span>
                  <p
                    className={`text-2xl font-black ${
                      dailyData.overage.is_over_target ? 'text-coral-primary' : 'text-white'
                    }`}
                  >
                    {dailyData.overage.is_over_target
                      ? `+${Math.round(dailyData.overage.calories)}`
                      : `~${Math.round(dailyData.remaining.calories)}`}{' '}
                    <span className="text-xs font-normal text-slate-400">kcal</span>
                  </p>
                  <p className="text-[11px] text-slate-400 pt-3">
                    {dailyData.overage.is_over_target
                      ? 'Consumed calories exceed daily target'
                      : 'Available caloric budget remaining'}
                  </p>
                </div>
              </div>
            </div>

            {/* Macronutrients Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Protein */}
              <div className="bg-dark-card rounded-2xl border border-dark-border p-5 shadow-sm space-y-2 hover:border-sky-400/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Dumbbell className="w-4 h-4 text-sky-400" />
                    <h4 className="text-xs font-bold text-white">Protein</h4>
                  </div>
                  <span className="text-xs font-bold text-sky-400 font-mono">
                    {dailyData.percentages.protein}%
                  </span>
                </div>
                <p className="text-xl font-bold text-white">
                  {dailyData.consumed.protein_g}g{' '}
                  <span className="text-xs font-normal text-slate-400">
                    / {dailyData.target.protein_target_g}g
                  </span>
                </p>
                <div className="w-full bg-dark-inner h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-400 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, dailyData.percentages.protein)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {dailyData.remaining.protein_g > 0
                    ? `${dailyData.remaining.protein_g}g remaining`
                    : 'Target fulfilled!'}
                </p>
              </div>

              {/* Carbohydrates */}
              <div className="bg-dark-card rounded-2xl border border-dark-border p-5 shadow-sm space-y-2 hover:border-amber-400/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Wheat className="w-4 h-4 text-amber-400" />
                    <h4 className="text-xs font-bold text-white">Carbs</h4>
                  </div>
                  <span className="text-xs font-bold text-amber-400 font-mono">
                    {dailyData.percentages.carbohydrates}%
                  </span>
                </div>
                <p className="text-xl font-bold text-white">
                  {dailyData.consumed.carbohydrates_g}g{' '}
                  <span className="text-xs font-normal text-slate-400">
                    / {dailyData.target.carbohydrates_target_g}g
                  </span>
                </p>
                <div className="w-full bg-dark-inner h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, dailyData.percentages.carbohydrates)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {dailyData.remaining.carbohydrates_g > 0
                    ? `${dailyData.remaining.carbohydrates_g}g remaining`
                    : 'Target fulfilled!'}
                </p>
              </div>

              {/* Fat */}
              <div className="bg-dark-card rounded-2xl border border-dark-border p-5 shadow-sm space-y-2 hover:border-rose-400/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Droplet className="w-4 h-4 text-rose-400" />
                    <h4 className="text-xs font-bold text-white">Fat</h4>
                  </div>
                  <span className="text-xs font-bold text-rose-400 font-mono">
                    {dailyData.percentages.fat}%
                  </span>
                </div>
                <p className="text-xl font-bold text-white">
                  {dailyData.consumed.fat_g}g{' '}
                  <span className="text-xs font-normal text-slate-400">
                    / {dailyData.target.fat_target_g}g
                  </span>
                </p>
                <div className="w-full bg-dark-inner h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-400 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, dailyData.percentages.fat)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {dailyData.remaining.fat_g > 0
                    ? `${dailyData.remaining.fat_g}g remaining`
                    : 'Target fulfilled!'}
                </p>
              </div>

              {/* Fiber */}
              <div className="bg-dark-card rounded-2xl border border-dark-border p-5 shadow-sm space-y-2 hover:border-lime-primary/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Salad className="w-4 h-4 text-lime-primary" />
                    <h4 className="text-xs font-bold text-white">Fiber</h4>
                  </div>
                  <span className="text-xs font-bold text-lime-primary font-mono">
                    {dailyData.percentages.fiber}%
                  </span>
                </div>
                <p className="text-xl font-bold text-white">
                  {dailyData.consumed.fiber_g}g{' '}
                  <span className="text-xs font-normal text-slate-400">
                    / {dailyData.target.fiber_target_g}g
                  </span>
                </p>
                <div className="w-full bg-dark-inner h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-lime-primary h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, dailyData.percentages.fiber)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  {dailyData.remaining.fiber_g > 0
                    ? `${dailyData.remaining.fiber_g}g remaining`
                    : 'Target fulfilled!'}
                </p>
              </div>
            </div>

            {/* Meal Timeline */}
            <MealTimeline
              timeline={dailyData.timeline}
              onLogMeal={onLogMealClick}
              onViewMealDetail={(meal) => setSelectedMealDetail(meal)}
            />
          </div>
        ) : null
      )}

      {/* SUB-TAB 2: 7-DAY TRENDS */}
      {activeSubTab === 'weekly' && (
        loadingWeekly ? (
          <div className="py-24 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-lime-primary animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">Compiling 7-day trend analytics...</p>
          </div>
        ) : weeklyData ? (
          <WeeklyAnalyticsChart data={weeklyData} />
        ) : null
      )}

      {/* SUB-TAB 3: MEAL HISTORY */}
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

      {/* Educational Notice */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-400">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed text-[11px]">
          <strong>Notice:</strong> NutriLens estimates and daily targets are calculated using verified nutritional datasets and peer-reviewed metabolic formulas. They do not constitute diagnostic medical advice or personalized clinical dietary prescriptions.
        </p>
      </div>
    </div>
  );
};
