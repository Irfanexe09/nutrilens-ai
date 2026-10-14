import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Utensils,
  X,
  Camera,
  Filter,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Scale,
  Activity,
  AlertCircle,
  RefreshCw,
  Flame,
} from 'lucide-react';
import { api } from '../services/api';
import {
  Meal,
  DailyMealItem,
  DailyNutritionResponse,
  WeeklyAnalyticsResponse,
  WeightHistoryResponse,
} from '../types';

interface MealHistoryProps {
  onSelectMeal: (meal: DailyMealItem) => void;
  onLogMeal: () => void;
}

export const MealHistory: React.FC<MealHistoryProps> = ({ onSelectMeal, onLogMeal }) => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'day' | 'trends' | 'all'>('day');

  // Today string helper (local date)
  const getTodayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const todayStr = getTodayStr();

  // --- Day View State ---
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [dayData, setDayData] = useState<DailyNutritionResponse | null>(null);
  const [loadingDay, setLoadingDay] = useState<boolean>(true);
  const [dayError, setDayError] = useState<string | null>(null);

  // --- Trends View State ---
  const [trendsDays, setTrendsDays] = useState<number>(7);
  const [analyticsData, setAnalyticsData] = useState<WeeklyAnalyticsResponse | null>(null);
  const [weightData, setWeightData] = useState<WeightHistoryResponse | null>(null);
  const [loadingTrends, setLoadingTrends] = useState<boolean>(false);
  const [trendsError, setTrendsError] = useState<string | null>(null);

  // --- All Meals View State ---
  const [meals, setMeals] = useState<Meal[]>([]);
  const [totalMeals, setTotalMeals] = useState(0);
  const [loadingAllMeals, setLoadingAllMeals] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedMealType, setSelectedMealType] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const limit = 10;

  // Race condition guards
  const activeDayReqId = useRef(0);
  const activeTrendsReqId = useRef(0);

  // Load Day Data when selectedDate changes
  useEffect(() => {
    loadDayData(selectedDate);
  }, [selectedDate]);

  // Load Trends when switching to trends tab or changing days
  useEffect(() => {
    if (activeTab === 'trends') {
      loadTrendsData(trendsDays);
    }
  }, [activeTab, trendsDays]);

  // Load All Meals when on 'all' tab or filter changes
  useEffect(() => {
    if (activeTab === 'all') {
      loadAllMeals();
    }
  }, [activeTab, page, selectedMealType, filterDate]);

  // --- Date Math Helpers ---
  const navigateDay = (deltaDays: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + deltaDays);
    const nextStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    setSelectedDate(nextStr);
  };

  const formatDateLabel = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    if (dateStr === todayStr) return 'Today';
    if (dateStr === yesterdayStr) return 'Yesterday';

    return targetDate.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // --- API Fetchers ---
  const loadDayData = async (dateToLoad: string) => {
    const reqId = ++activeDayReqId.current;
    setLoadingDay(true);
    setDayError(null);

    try {
      if (api.getToken()) {
        const res = await api.getDailyNutrition(dateToLoad);
        if (reqId === activeDayReqId.current) {
          setDayData(res);
        }
      } else {
        // Honest fallback for demo / unauthenticated state
        if (reqId === activeDayReqId.current) {
          setDayData({
            date: dateToLoad,
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
              status_message: 'On target',
            },
            percentages: {
              calories: 0,
              protein: 0,
              carbohydrates: 0,
              fat: 0,
              fiber: 0,
            },
            meals: [],
            meal_count: 0,
          });
        }
      }
    } catch (err: any) {
      if (reqId === activeDayReqId.current) {
        setDayError(err.message || 'Unable to load daily nutrition data.');
      }
    } finally {
      if (reqId === activeDayReqId.current) {
        setLoadingDay(false);
      }
    }
  };

  const loadTrendsData = async (daysCount: number) => {
    const reqId = ++activeTrendsReqId.current;
    setLoadingTrends(true);
    setTrendsError(null);

    try {
      if (api.getToken()) {
        const [analRes, weightRes] = await Promise.all([
          api.getWeeklyAnalytics(undefined, daysCount).catch(() => null),
          api.getWeightHistory(undefined, undefined, 30).catch(() => null),
        ]);

        if (reqId === activeTrendsReqId.current) {
          setAnalyticsData(analRes);
          setWeightData(weightRes);
        }
      } else {
        if (reqId === activeTrendsReqId.current) {
          setAnalyticsData(null);
          setWeightData(null);
        }
      }
    } catch (err: any) {
      if (reqId === activeTrendsReqId.current) {
        setTrendsError(err.message || 'Unable to load nutrition trends.');
      }
    } finally {
      if (reqId === activeTrendsReqId.current) {
        setLoadingTrends(false);
      }
    }
  };

  const loadAllMeals = async () => {
    setLoadingAllMeals(true);
    try {
      const filters: any = {};
      if (selectedMealType !== 'all') filters.meal_type = selectedMealType;
      if (filterDate) filters.date = filterDate;

      const res = await api.getMeals(page * limit, limit, filters);
      setMeals(res.meals || []);
      setTotalMeals(res.total || 0);
    } catch (err) {
      console.error('Failed to load meal history:', err);
      setMeals([]);
      setTotalMeals(0);
    } finally {
      setLoadingAllMeals(false);
    }
  };

  const handleClearFilters = () => {
    setSelectedMealType('all');
    setFilterDate('');
    setPage(0);
  };

  const totalPages = Math.ceil(totalMeals / limit);

  // Helper for trend badge
  const renderTrendBadge = (trend?: string | null) => {
    if (trend === 'DECREASING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-lime-dim text-lime-primary border border-lime-primary/30">
          <TrendingDown className="w-3 h-3" />
          Losing weight
        </span>
      );
    }
    if (trend === 'INCREASING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-coral-primary/15 text-coral-primary border border-coral-primary/30">
          <TrendingUp className="w-3 h-3" />
          Gaining weight
        </span>
      );
    }
    if (trend === 'STABLE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-dark-inner text-slate-300 border border-dark-border">
          Stable weight
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-dark-inner text-slate-400 border border-dark-border">
        Need more weigh-ins
      </span>
    );
  };

  // Check if historical data has enough logged days for honest reporting
  const loggedDaysList =
    analyticsData?.days?.filter((d) => d.has_logs && d.calories !== null && d.calories > 0) || [];
  const hasSufficientTrendsData = loggedDaysList.length > 1;

  return (
    <div className="space-y-6">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Meal History & Daily Nutrition
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Review daily meal logs, inspect nutrition targets, and track progress over time.
          </p>
        </div>

        <button
          onClick={onLogMeal}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-lime-primary hover:bg-lime-hover text-lime-dark text-xs font-black rounded-xl shadow-sm transition shrink-0"
        >
          <Camera className="w-4 h-4" />
          <span>Scan Food</span>
        </button>
      </div>

      {/* Primary Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-dark-card border border-dark-border rounded-xl">
        <button
          onClick={() => setActiveTab('day')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition ${
            activeTab === 'day'
              ? 'bg-lime-primary text-lime-dark shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-dark-inner'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Daily History</span>
        </button>

        <button
          onClick={() => setActiveTab('trends')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition ${
            activeTab === 'trends'
              ? 'bg-lime-primary text-lime-dark shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-dark-inner'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Nutrition Trends</span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition ${
            activeTab === 'all'
              ? 'bg-lime-primary text-lime-dark shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-dark-inner'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>All Meals</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: DAILY HISTORY (Date navigation + Day totals + Day meals) */}
      {/* ======================================================== */}
      {activeTab === 'day' && (
        <div className="space-y-6">
          {/* Date Navigation Bar */}
          <section
            aria-label="Date Navigation"
            className="bg-dark-card rounded-2xl border border-dark-border p-3.5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
              <button
                onClick={() => navigateDay(-1)}
                className="p-2 bg-dark-inner hover:bg-dark-cardHover border border-dark-border rounded-xl text-slate-300 hover:text-white transition"
                title="Previous Day"
                aria-label="Previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white px-1">
                  {formatDateLabel(selectedDate)}
                </span>
                <span className="text-xs text-slate-400 font-mono">({selectedDate})</span>
              </div>

              <button
                onClick={() => navigateDay(1)}
                disabled={selectedDate >= todayStr}
                className="p-2 bg-dark-inner hover:bg-dark-cardHover border border-dark-border rounded-xl text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
                title="Next Day"
                aria-label="Next day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <input
                type="date"
                value={selectedDate}
                max={todayStr}
                onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                aria-label="Select Date"
                className="text-xs bg-dark-inner border border-dark-border rounded-xl px-2.5 py-1.5 text-slate-200 font-semibold focus:border-lime-primary outline-none"
              />

              {selectedDate !== todayStr && (
                <button
                  onClick={() => setSelectedDate(todayStr)}
                  className="px-3 py-1.5 bg-dark-inner hover:bg-dark-cardHover border border-dark-border rounded-xl text-xs font-bold text-lime-primary transition"
                >
                  Today
                </button>
              )}
            </div>
          </section>

          {/* Loading or Error */}
          {loadingDay ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-8 h-8 border-2 border-lime-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Loading daily nutrition...</p>
            </div>
          ) : dayError ? (
            <div className="bg-coral-primary/10 border border-coral-primary/20 rounded-2xl p-6 text-center space-y-3">
              <AlertCircle className="w-6 h-6 text-coral-primary mx-auto" />
              <p className="text-sm text-slate-300 font-medium">{dayError}</p>
              <button
                onClick={() => loadDayData(selectedDate)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-dark-card hover:bg-dark-cardHover border border-dark-border rounded-xl text-xs font-bold text-white transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          ) : (
            <>
              {/* Daily Nutrition Totals for Selected Date */}
              {dayData && (
                <section
                  aria-labelledby="day-nutrition-heading"
                  className="bg-dark-card rounded-2xl border border-dark-border p-5 space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h2
                      id="day-nutrition-heading"
                      className="text-xs font-bold uppercase tracking-wider text-slate-400"
                    >
                      Nutrition Summary — {formatDateLabel(selectedDate)}
                    </h2>
                    {dayData.target?.calorie_target && (
                      <span className="text-xs text-slate-400">
                        Target: {Math.round(dayData.target.calorie_target)} kcal
                      </span>
                    )}
                  </div>

                  {/* Calorie Card & Macro Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {/* Calories */}
                    <div className="sm:col-span-1 bg-dark-inner rounded-xl p-4 border border-dark-border space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                        <span>Calories</span>
                        <Flame className="w-3.5 h-3.5 text-lime-primary" />
                      </div>
                      <div>
                        <div className="text-2xl font-black text-white">
                          {Math.round(dayData.consumed.calories)}
                          <span className="text-xs font-normal text-slate-400 ml-1">kcal</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {dayData.consumed.calories > dayData.target.calorie_target ? (
                            <span className="text-coral-primary font-bold">
                              +{Math.round(dayData.consumed.calories - dayData.target.calorie_target)} kcal over
                            </span>
                          ) : (
                            <span>
                              {Math.round(dayData.target.calorie_target - dayData.consumed.calories)} kcal remaining
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Bar */}
                      <div className="w-full bg-dark-card rounded-full h-1.5 overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (dayData.consumed.calories / (dayData.target.calorie_target || 2000)) * 100
                              )
                            )}%`,
                          }}
                          className={`h-full rounded-full transition-all duration-300 ${
                            dayData.consumed.calories > dayData.target.calorie_target
                              ? 'bg-coral-primary'
                              : 'bg-lime-primary'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Protein */}
                    <div className="bg-dark-inner rounded-xl p-3.5 border border-dark-border space-y-1.5">
                      <div className="text-xs text-slate-400 font-semibold">Protein</div>
                      <div className="text-lg font-bold text-white">
                        {Math.round(dayData.consumed.protein_g)}
                        <span className="text-xs text-slate-400 font-normal">
                          {' '}
                          / {Math.round(dayData.target.protein_target_g)}g
                        </span>
                      </div>
                      <div className="w-full bg-dark-card rounded-full h-1 overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (dayData.consumed.protein_g /
                                  (dayData.target.protein_target_g || 100)) *
                                  100
                              )
                            )}%`,
                          }}
                          className="h-full bg-lime-primary rounded-full"
                        />
                      </div>
                    </div>

                    {/* Carbohydrates */}
                    <div className="bg-dark-inner rounded-xl p-3.5 border border-dark-border space-y-1.5">
                      <div className="text-xs text-slate-400 font-semibold">Carbs</div>
                      <div className="text-lg font-bold text-white">
                        {Math.round(dayData.consumed.carbohydrates_g)}
                        <span className="text-xs text-slate-400 font-normal">
                          {' '}
                          / {Math.round(dayData.target.carbohydrates_target_g)}g
                        </span>
                      </div>
                      <div className="w-full bg-dark-card rounded-full h-1 overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (dayData.consumed.carbohydrates_g /
                                  (dayData.target.carbohydrates_target_g || 200)) *
                                  100
                              )
                            )}%`,
                          }}
                          className="h-full bg-amber-400 rounded-full"
                        />
                      </div>
                    </div>

                    {/* Fat */}
                    <div className="bg-dark-inner rounded-xl p-3.5 border border-dark-border space-y-1.5">
                      <div className="text-xs text-slate-400 font-semibold">Fat</div>
                      <div className="text-lg font-bold text-white">
                        {Math.round(dayData.consumed.fat_g)}
                        <span className="text-xs text-slate-400 font-normal">
                          {' '}
                          / {Math.round(dayData.target.fat_target_g)}g
                        </span>
                      </div>
                      <div className="w-full bg-dark-card rounded-full h-1 overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (dayData.consumed.fat_g /
                                  (dayData.target.fat_target_g || 65)) *
                                  100
                              )
                            )}%`,
                          }}
                          className="h-full bg-purple-400 rounded-full"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* Meals Logged on Selected Date */}
              <section aria-labelledby="day-meals-heading" className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 id="day-meals-heading" className="text-sm font-bold text-white">
                    Meals Logged ({dayData?.meals?.length || 0})
                  </h2>
                </div>

                {!dayData || !dayData.meals || dayData.meals.length === 0 ? (
                  <div className="bg-dark-card rounded-2xl border border-dashed border-dark-border p-10 text-center space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-dark-inner text-lime-primary flex items-center justify-center mx-auto border border-dark-border">
                      <Utensils className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-white">
                        No meals logged for this date
                      </h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        You didn't record any meals for {formatDateLabel(selectedDate)}. Take a photo of
                        your food to track calories and macros.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      {selectedDate !== todayStr && (
                        <button
                          onClick={() => setSelectedDate(todayStr)}
                          className="px-4 py-2 bg-dark-inner hover:bg-dark-cardHover text-slate-300 text-xs font-semibold rounded-xl border border-dark-border transition"
                        >
                          Return to Today
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
                  <div className="space-y-2.5">
                    {dayData.meals.map((meal) => {
                      const foodNames = meal.food_names || [];
                      return (
                        <div
                          key={meal.id}
                          onClick={() => onSelectMeal(meal)}
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
                                <span className="capitalize font-medium text-slate-300">
                                  {meal.meal_type}
                                </span>
                                {meal.time_logged && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-slate-500" />
                                      {meal.time_logged}
                                    </span>
                                  </>
                                )}
                                <span>•</span>
                                <span>{meal.item_count} items</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-white">
                              {Math.round(meal.calories)} kcal
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {Math.round(meal.protein)}g protein
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: NUTRITION TRENDS & INSIGHTS (7-day / 30-day analytics) */}
      {/* ======================================================== */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* Controls: 7 Days vs 30 Days */}
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Historical Nutrition & Progress
            </h2>

            <div className="flex items-center gap-1 bg-dark-card border border-dark-border p-1 rounded-xl">
              <button
                onClick={() => setTrendsDays(7)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  trendsDays === 7
                    ? 'bg-lime-primary text-lime-dark shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTrendsDays(30)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  trendsDays === 30
                    ? 'bg-lime-primary text-lime-dark shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                30 Days
              </button>
            </div>
          </div>

          {loadingTrends ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-8 h-8 border-2 border-lime-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Analyzing historical nutrition...</p>
            </div>
          ) : trendsError ? (
            <div className="bg-coral-primary/10 border border-coral-primary/20 rounded-2xl p-6 text-center space-y-3">
              <AlertCircle className="w-6 h-6 text-coral-primary mx-auto" />
              <p className="text-sm text-slate-300 font-medium">{trendsError}</p>
              <button
                onClick={() => loadTrendsData(trendsDays)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-dark-card hover:bg-dark-cardHover border border-dark-border rounded-xl text-xs font-bold text-white transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          ) : !hasSufficientTrendsData ? (
            /* Honest Guardrail: No fabricated data when <= 1 logged day */
            <div className="bg-dark-card rounded-2xl border border-dashed border-dark-border p-10 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-dark-inner text-lime-primary flex items-center justify-center mx-auto border border-dark-border">
                <Activity className="w-5 h-5" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-bold text-white">
                  Record more meals to see meaningful trends.
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Once you log meals across multiple days, your daily averages, macronutrient targets,
                  and progress trends will appear here.
                </p>
              </div>
              <div className="pt-2">
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
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Average Daily Calories */}
                <div className="bg-dark-card rounded-2xl border border-dark-border p-4 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                    <span>Average Daily Calories</span>
                    <Flame className="w-3.5 h-3.5 text-lime-primary" />
                  </div>
                  <div className="text-2xl font-black text-white">
                    {analyticsData?.insights?.average_calories_logged_days != null
                      ? Math.round(analyticsData.insights.average_calories_logged_days)
                      : '—'}
                    <span className="text-xs font-normal text-slate-400 ml-1">kcal/day</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Over {loggedDaysList.length} logged days in past {trendsDays} days
                  </div>
                </div>

                {/* Average Daily Protein */}
                <div className="bg-dark-card rounded-2xl border border-dark-border p-4 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                    <span>Average Daily Protein</span>
                    <Activity className="w-3.5 h-3.5 text-lime-primary" />
                  </div>
                  <div className="text-2xl font-black text-white">
                    {analyticsData?.insights?.average_protein_logged_days != null
                      ? Math.round(analyticsData.insights.average_protein_logged_days)
                      : '—'}
                    <span className="text-xs font-normal text-slate-400 ml-1">g/day</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Target: {Math.round(analyticsData?.days?.[0]?.protein_target || 100)}g / day
                  </div>
                </div>

                {/* Weight Trend */}
                <div className="bg-dark-card rounded-2xl border border-dark-border p-4 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-semibold">
                    <span>Weight Trend</span>
                    <Scale className="w-3.5 h-3.5 text-lime-primary" />
                  </div>
                  <div className="text-2xl font-black text-white">
                    {weightData?.latest?.weight_kg != null ? (
                      <>
                        {weightData.latest.weight_kg}{' '}
                        <span className="text-xs font-normal text-slate-400">kg</span>
                      </>
                    ) : (
                      <span className="text-base text-slate-400 font-semibold">No weigh-ins</span>
                    )}
                  </div>
                  <div>{renderTrendBadge(weightData?.trend)}</div>
                </div>
              </div>

              {/* Calorie Intake vs Target Bar Chart */}
              {analyticsData && analyticsData.days && (
                <section
                  aria-labelledby="trends-chart-heading"
                  className="bg-dark-card rounded-2xl border border-dark-border p-5 space-y-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h3
                      id="trends-chart-heading"
                      className="text-xs font-bold uppercase tracking-wider text-slate-400"
                    >
                      Calorie Intake vs Target ({trendsDays} Days)
                    </h3>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-lime-primary inline-block" />
                        On target
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-coral-primary inline-block" />
                        Exceeded
                      </span>
                    </div>
                  </div>

                  <div
                    className={`grid gap-1.5 pt-2 items-end h-36 ${
                      trendsDays === 7 ? 'grid-cols-7' : 'grid-cols-15 sm:grid-cols-30'
                    }`}
                  >
                    {analyticsData.days.map((day, i) => {
                      const target = day.calorie_target || 2000;
                      const cal = day.calories || 0;
                      const heightPct = Math.min(100, Math.round((cal / target) * 100));
                      const isOver = cal > target;

                      return (
                        <div
                          key={i}
                          className="flex flex-col items-center h-full justify-end gap-1 group relative"
                        >
                          {trendsDays === 7 && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {cal > 0 ? Math.round(cal) : ''}
                            </span>
                          )}

                          <div className="w-full bg-dark-inner rounded-t-lg h-24 flex items-end overflow-hidden p-0.5">
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

                          <span className="text-[10px] text-slate-400 font-medium truncate w-full text-center">
                            {trendsDays === 7
                              ? day.day_name.slice(0, 3)
                              : day.date.slice(8, 10)}
                          </span>

                          {/* Hover Tooltip */}
                          <div className="absolute bottom-full mb-1 hidden group-hover:block bg-dark-bg border border-dark-border text-white text-[10px] py-1 px-2 rounded-lg whitespace-nowrap shadow-lg z-10 pointer-events-none">
                            <div className="font-bold">{day.date}</div>
                            <div>
                              {cal > 0
                                ? `${Math.round(cal)} / ${Math.round(target)} kcal`
                                : 'No meals logged'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Insights Statements */}
              {analyticsData?.insights?.insights_statements &&
                analyticsData.insights.insights_statements.length > 0 && (
                  <div className="bg-dark-card rounded-2xl border border-dark-border p-4 space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Nutrition Takeaways
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {analyticsData.insights.insights_statements.map((statement, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-lime-primary font-bold">•</span>
                          <span>{statement}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: ALL MEALS (Paginated archive with category filter) */}
      {/* ======================================================== */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-dark-card rounded-2xl border border-dark-border p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-lime-primary shrink-0" />
              <span className="text-xs font-bold text-white">Filter Past Meals</span>
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
                value={filterDate}
                onChange={(e) => {
                  setFilterDate(e.target.value);
                  setPage(0);
                }}
                className="text-xs bg-dark-inner border border-dark-border rounded-xl px-2.5 py-1.5 text-slate-200 font-semibold focus:border-lime-primary outline-none"
              />

              {(selectedMealType !== 'all' || filterDate !== '') && (
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
          {loadingAllMeals ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-8 h-8 border-2 border-lime-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Loading all meal records...</p>
            </div>
          ) : meals.length === 0 ? (
            <div className="bg-dark-card rounded-2xl border border-dashed border-dark-border p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-xl bg-dark-inner text-lime-primary flex items-center justify-center mx-auto border border-dark-border">
                <Utensils className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  {selectedMealType !== 'all' || filterDate !== ''
                    ? 'No meals found'
                    : 'No meals logged yet.'}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {selectedMealType !== 'all' || filterDate !== ''
                    ? 'No saved meals matched the selected filters. Clear your filters or log a meal photo.'
                    : 'Start by scanning your first meal.'}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                {(selectedMealType !== 'all' || filterDate !== '') && (
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
                  Showing {page * limit + 1}–{Math.min((page + 1) * limit, totalMeals)} of{' '}
                  {totalMeals} meals
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
                  const dateStr = meal.created_at ? meal.created_at.split('T')[0] : '';
                  const dateLabel = formatDateLabel(dateStr);

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
      )}
    </div>
  );
};
