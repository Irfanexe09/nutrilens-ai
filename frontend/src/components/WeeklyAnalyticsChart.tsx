import React, { useState } from 'react';
import {
  TrendingUp,
  Award,
  Calendar,
  AlertCircle,
  Info,
  Flame,
  Dumbbell,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import { WeeklyAnalyticsResponse, DayAnalyticsItem } from '../types';

interface WeeklyAnalyticsChartProps {
  data: WeeklyAnalyticsResponse;
}

export const WeeklyAnalyticsChart: React.FC<WeeklyAnalyticsChartProps> = ({ data }) => {
  const [selectedDay, setSelectedDay] = useState<DayAnalyticsItem | null>(
    data.days[data.days.length - 1] || null
  );

  const { days, insights } = data;

  // Maximum calorie value to scale bars accurately
  const maxCalorieValue = Math.max(
    ...days.map((d) => d.calories || 0),
    ...days.map((d) => d.calorie_target || 2000),
    2200
  );

  return (
    <div className="space-y-6">
      {/* Top Trend Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average Intake */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider">Average Intake</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {insights.average_calories_logged_days !== null ? (
              <>
                ~{Math.round(insights.average_calories_logged_days)}{' '}
                <span className="text-xs font-normal text-slate-500">kcal / day</span>
              </>
            ) : (
              <span className="text-base font-semibold text-slate-400">No logs</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            {insights.logged_days_count > 0
              ? `Average across ${insights.logged_days_count} logged day${
                  insights.logged_days_count > 1 ? 's' : ''
                }`
              : 'Log meals to calculate intake averages'}
          </p>
        </div>

        {/* Average Protein */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider">Average Protein</span>
            <Dumbbell className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {insights.average_protein_logged_days !== null ? (
              <>
                {insights.average_protein_logged_days}{' '}
                <span className="text-xs font-normal text-slate-500">g / day</span>
              </>
            ) : (
              <span className="text-base font-semibold text-slate-400">No logs</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            Target met on {insights.protein_target_met_days} of{' '}
            {insights.logged_days_count} logged days
          </p>
        </div>

        {/* Logging Consistency */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider">Logging Consistency</span>
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {insights.logged_days_count}{' '}
            <span className="text-xs font-normal text-slate-500">/ {insights.total_days} days</span>
          </div>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all"
              style={{
                width: `${(insights.logged_days_count / insights.total_days) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Prior Period Delta */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold uppercase tracking-wider">Prior Period Delta</span>
            <TrendingUp className="w-4 h-4 text-teal-600" />
          </div>
          {insights.previous_period_comparison?.has_comparison &&
          insights.previous_period_comparison.calorie_difference !== null ? (
            <div>
              <div className="flex items-center gap-1.5 text-2xl font-black text-slate-900">
                {insights.previous_period_comparison.calorie_difference > 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-amber-600" />
                ) : insights.previous_period_comparison.calorie_difference < 0 ? (
                  <ArrowDownRight className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Minus className="w-5 h-5 text-slate-400" />
                )}
                <span>
                  {insights.previous_period_comparison.calorie_difference > 0 ? '+' : ''}
                  {Math.round(insights.previous_period_comparison.calorie_difference)} kcal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {insights.previous_period_comparison.percent_change}% vs previous 7-day logged avg
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-slate-500 mt-1">Establishing baseline</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Prior 7-day logged records required for trend delta
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main 7-Day Calorie Intake Bar Chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Flame className="w-4 h-4 text-emerald-600" />
              Daily Calorie Intake vs Target
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect actual consumption against estimated maintenance/goal targets.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-xs bg-emerald-500" />
              <span className="text-slate-600">Logged Intake</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-xs bg-rose-500" />
              <span className="text-slate-600">Target Overage</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-slate-400 border-t border-dashed border-slate-500" />
              <span className="text-slate-600">Daily Target (~{Math.round(days[0]?.calorie_target || 2000)})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-xs bg-slate-200 border border-dashed border-slate-300" />
              <span className="text-slate-500">Unlogged Day</span>
            </div>
          </div>
        </div>

        {/* Visual Bar Chart Container */}
        <div className="pt-4 pb-2" role="region" aria-label="7-Day Caloric Intake Chart">
          <div className="grid grid-cols-7 gap-2 sm:gap-4 h-56 items-end border-b border-slate-200 pb-2 relative">
            {/* Target Reference Line */}
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed border-slate-400 z-10 pointer-events-none"
              style={{
                bottom: `${((days[0]?.calorie_target || 2000) / maxCalorieValue) * 100}%`,
              }}
              title={`Daily Target: ~${Math.round(days[0]?.calorie_target || 2000)} kcal`}
            >
              <span className="absolute -top-5 right-1 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold shadow-2xs">
                Target: {Math.round(days[0]?.calorie_target || 2000)} kcal
              </span>
            </div>

            {/* Individual Day Bars */}
            {days.map((day) => {
              const isSelected = selectedDay?.date === day.date;
              const hasLogs = day.has_logs && day.calories !== null;
              const barHeightPct = hasLogs
                ? Math.min(100, Math.max(8, (day.calories! / maxCalorieValue) * 100))
                : 0;

              return (
                <div
                  key={day.date}
                  onClick={() => setSelectedDay(day)}
                  className={`flex flex-col items-center h-full justify-end cursor-pointer group transition-all ${
                    isSelected ? 'opacity-100' : 'opacity-90 hover:opacity-100'
                  }`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${day.day_name} ${day.date}: ${
                    hasLogs ? `${Math.round(day.calories!)} kcal` : 'Unlogged'
                  }`}
                >
                  {/* Calorie tooltip badge on hover/selected */}
                  {hasLogs ? (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded mb-1 transition-all ${
                        isSelected
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 group-hover:bg-slate-800 group-hover:text-white'
                      }`}
                    >
                      ~{Math.round(day.calories!)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-semibold mb-1">
                      No Log
                    </span>
                  )}

                  {/* Bar shape */}
                  <div className="w-full max-w-[48px] h-full flex items-end">
                    {hasLogs ? (
                      <div
                        className={`w-full rounded-t-xl transition-all duration-300 ${
                          day.is_over_calorie_target
                            ? 'bg-gradient-to-t from-rose-500 to-rose-400'
                            : 'bg-gradient-to-t from-emerald-600 to-emerald-500'
                        } ${isSelected ? 'ring-2 ring-emerald-600 ring-offset-2' : ''}`}
                        style={{ height: `${barHeightPct}%` }}
                      />
                    ) : (
                      <div
                        className="w-full h-12 rounded-t-xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400"
                        title="Unlogged day - not zero actual consumption"
                      >
                        —
                      </div>
                    )}
                  </div>

                  {/* Day Label */}
                  <div className="text-center mt-2">
                    <span
                      className={`block text-xs font-bold ${
                        isSelected ? 'text-emerald-700' : 'text-slate-700'
                      }`}
                    >
                      {day.day_name}
                    </span>
                    <span className="block text-[10px] text-slate-400">
                      {day.date.slice(5)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Detail Card */}
        {selectedDay && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">
                  {selectedDay.day_name}, {selectedDay.date}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    selectedDay.has_logs
                      ? selectedDay.data_completeness === 'LOGGED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {selectedDay.has_logs
                    ? `${selectedDay.meal_count} meals recorded (${selectedDay.data_completeness})`
                    : 'Unlogged Day'}
                </span>
              </div>

              {selectedDay.has_logs && (
                <div className="text-xs font-bold">
                  {selectedDay.is_over_calorie_target ? (
                    <span className="text-rose-600">
                      +{Math.round(selectedDay.overage_calories)} kcal over daily target
                    </span>
                  ) : (
                    <span className="text-emerald-700">
                      Within daily estimated target
                    </span>
                  )}
                </div>
              )}
            </div>

            {selectedDay.has_logs ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3 text-xs">
                <div>
                  <span className="text-slate-500 font-semibold block">Calories</span>
                  <span className="text-base font-black text-slate-900">
                    ~{Math.round(selectedDay.calories!)} kcal
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Protein</span>
                  <span className="text-base font-black text-emerald-800">
                    {selectedDay.protein}g{' '}
                    <span className="text-[10px] text-slate-500">
                      ({selectedDay.protein_target_met ? 'Goal reached' : `Target ${selectedDay.protein_target}g`})
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Carbohydrates</span>
                  <span className="text-base font-black text-amber-800">
                    {selectedDay.carbohydrates}g
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Fat</span>
                  <span className="text-base font-black text-rose-800">
                    {selectedDay.fat}g
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block">Dietary Fiber</span>
                  <span className="text-base font-black text-teal-800">
                    {selectedDay.fiber}g
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-slate-500 flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  No meal records found for this calendar date. Unlogged days are treated as missing data, not as zero food intake.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Accessible Text Summary Table */}
        <div className="pt-2">
          <details className="text-xs text-slate-600">
            <summary className="font-semibold cursor-pointer hover:text-slate-900">
              View accessible numerical data table (7-day intake summary)
            </summary>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-xs border border-slate-200 rounded-lg">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Calories</th>
                    <th className="p-2">Protein</th>
                    <th className="p-2">Carbs</th>
                    <th className="p-2">Fat</th>
                    <th className="p-2">Fiber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {days.map((d) => (
                    <tr key={d.date} className="hover:bg-slate-50/50">
                      <td className="p-2 font-medium">
                        {d.day_name}, {d.date}
                      </td>
                      <td className="p-2">
                        {d.has_logs ? `${d.meal_count} meals` : 'Unlogged'}
                      </td>
                      <td className="p-2">
                        {d.calories !== null ? `${Math.round(d.calories)} kcal` : '—'}
                      </td>
                      <td className="p-2">{d.protein !== null ? `${d.protein}g` : '—'}</td>
                      <td className="p-2">
                        {d.carbohydrates !== null ? `${d.carbohydrates}g` : '—'}
                      </td>
                      <td className="p-2">{d.fat !== null ? `${d.fat}g` : '—'}</td>
                      <td className="p-2">{d.fiber !== null ? `${d.fiber}g` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>

      {/* Factual Narrative Insights Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-600" />
          Deterministic Nutrition Insights
        </h3>
        <ul className="space-y-2 text-xs text-slate-700">
          {insights.insights_statements.map((statement, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
              <span>{statement}</span>
            </li>
          ))}
        </ul>

        <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>{insights.disclaimer}</span>
        </div>
      </div>
    </div>
  );
};
