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
        <div className="bg-dark-card rounded-2xl border border-dark-border p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-dark-muted text-xs">
            <span className="font-semibold uppercase tracking-wider">Average Intake</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {insights.average_calories_logged_days !== null ? (
              <>
                ~{Math.round(insights.average_calories_logged_days)}{' '}
                <span className="text-xs font-normal text-dark-muted font-sans">kcal / day</span>
              </>
            ) : (
              <span className="text-base font-semibold text-dark-muted">No logs</span>
            )}
          </div>
          <p className="text-[11px] text-dark-muted">
            {insights.logged_days_count > 0
              ? `Average across ${insights.logged_days_count} logged day${
                  insights.logged_days_count > 1 ? 's' : ''
                }`
              : 'Log meals to calculate intake averages'}
          </p>
        </div>

        {/* Average Protein */}
        <div className="bg-dark-card rounded-2xl border border-dark-border p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-dark-muted text-xs">
            <span className="font-semibold uppercase tracking-wider">Average Protein</span>
            <Dumbbell className="w-4 h-4 text-lime-primary" />
          </div>
          <div className="text-2xl font-black text-white">
            {insights.average_protein_logged_days !== null ? (
              <>
                {insights.average_protein_logged_days}{' '}
                <span className="text-xs font-normal text-dark-muted font-sans">g / day</span>
              </>
            ) : (
              <span className="text-base font-semibold text-dark-muted">No logs</span>
            )}
          </div>
          <p className="text-[11px] text-dark-muted">
            Target met on {insights.protein_target_met_days} of{' '}
            {insights.logged_days_count} logged days
          </p>
        </div>

        {/* Logging Consistency */}
        <div className="bg-dark-card rounded-2xl border border-dark-border p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-dark-muted text-xs">
            <span className="font-semibold uppercase tracking-wider">Logging Consistency</span>
            <Calendar className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white">
            {insights.logged_days_count}{' '}
            <span className="text-xs font-normal text-dark-muted font-sans">/ {insights.total_days} days</span>
          </div>
          <div className="w-full bg-dark-inner border border-dark-border h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-sky-400 h-full rounded-full transition-all"
              style={{
                width: `${(insights.logged_days_count / insights.total_days) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Prior Period Delta */}
        <div className="bg-dark-card rounded-2xl border border-dark-border p-5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-dark-muted text-xs">
            <span className="font-semibold uppercase tracking-wider">Prior Period Delta</span>
            <TrendingUp className="w-4 h-4 text-lime-primary" />
          </div>
          {insights.previous_period_comparison?.has_comparison &&
          insights.previous_period_comparison.calorie_difference !== null ? (
            <div>
              <div className="flex items-center gap-1.5 text-2xl font-black text-white">
                {insights.previous_period_comparison.calorie_difference > 0 ? (
                  <ArrowUpRight className="w-5 h-5 text-amber-400" />
                ) : insights.previous_period_comparison.calorie_difference < 0 ? (
                  <ArrowDownRight className="w-5 h-5 text-lime-primary" />
                ) : (
                  <Minus className="w-5 h-5 text-dark-muted" />
                )}
                <span>
                  {insights.previous_period_comparison.calorie_difference > 0 ? '+' : ''}
                  {Math.round(insights.previous_period_comparison.calorie_difference)} kcal
                </span>
              </div>
              <p className="text-[11px] text-dark-muted mt-1">
                {insights.previous_period_comparison.percent_change}% vs previous 7-day logged avg
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-slate-300 mt-1">Establishing baseline</p>
              <p className="text-[11px] text-dark-muted mt-1">
                Prior 7-day logged records required for trend delta
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Main 7-Day Calorie Intake Bar Chart */}
      <div className="bg-dark-card rounded-2xl border border-dark-border p-6 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-dark-border">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-lime-primary" />
              Daily Calorie Intake vs Target
            </h3>
            <p className="text-xs text-dark-muted mt-0.5">
              Inspect actual consumption against estimated maintenance/goal targets.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-xs bg-lime-primary" />
              <span className="text-slate-300">Logged Intake</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-xs bg-rose-500" />
              <span className="text-slate-300">Target Overage</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-slate-500 border-t border-dashed border-slate-400" />
              <span className="text-slate-300">Daily Target (~{Math.round(days[0]?.calorie_target || 2000)})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-xs bg-dark-inner border border-dashed border-dark-border" />
              <span className="text-dark-muted">Unlogged Day</span>
            </div>
          </div>
        </div>

        {/* Visual Bar Chart Container */}
        <div className="pt-4 pb-2" role="region" aria-label="7-Day Caloric Intake Chart">
          <div className="grid grid-cols-7 gap-2 sm:gap-4 h-56 items-end border-b border-dark-border pb-2 relative">
            {/* Target Reference Line */}
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed border-slate-500/60 z-10 pointer-events-none"
              style={{
                bottom: `${((days[0]?.calorie_target || 2000) / maxCalorieValue) * 100}%`,
              }}
              title={`Daily Target: ~${Math.round(days[0]?.calorie_target || 2000)} kcal`}
            >
              <span className="absolute -top-5 right-1 text-[10px] bg-dark-inner border border-dark-border text-slate-300 px-1.5 py-0.5 rounded font-mono font-bold shadow-2xs">
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
                    isSelected ? 'opacity-100' : 'opacity-85 hover:opacity-100'
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
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded mb-1 transition-all ${
                        isSelected
                          ? 'bg-lime-primary text-dark-bg font-extrabold'
                          : 'bg-dark-inner border border-dark-border text-slate-300 group-hover:border-lime-primary/40 group-hover:text-white'
                      }`}
                    >
                      ~{Math.round(day.calories!)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-600 font-semibold mb-1">
                      No Log
                    </span>
                  )}

                  {/* Bar shape */}
                  <div className="w-full max-w-[48px] h-full flex items-end">
                    {hasLogs ? (
                      <div
                        className={`w-full rounded-t-xl transition-all duration-300 ${
                          day.is_over_calorie_target
                            ? 'bg-gradient-to-t from-rose-600 to-rose-400 shadow-rose-950/20'
                            : 'bg-gradient-to-t from-lime-600 to-lime-primary shadow-lime-950/20'
                        } ${isSelected ? 'ring-2 ring-lime-primary ring-offset-2 ring-offset-dark-card' : ''}`}
                        style={{ height: `${barHeightPct}%` }}
                      />
                    ) : (
                      <div
                        className="w-full h-12 rounded-t-xl bg-dark-inner border border-dashed border-dark-border flex items-center justify-center text-[10px] text-slate-600"
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
                        isSelected ? 'text-lime-primary' : 'text-slate-300'
                      }`}
                    >
                      {day.day_name}
                    </span>
                    <span className="block text-[10px] text-dark-muted font-mono">
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
          <div className="bg-dark-inner border border-dark-border rounded-2xl p-4 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-dark-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white">
                  {selectedDay.day_name}, {selectedDay.date}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    selectedDay.has_logs
                      ? selectedDay.data_completeness === 'LOGGED'
                        ? 'bg-lime-primary/10 text-lime-primary border-lime-primary/30'
                        : 'bg-amber-400/10 text-amber-300 border-amber-400/30'
                      : 'bg-dark-card text-dark-muted border-dark-border'
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
                    <span className="text-rose-400">
                      +{Math.round(selectedDay.overage_calories)} kcal over daily target
                    </span>
                  ) : (
                    <span className="text-lime-primary">
                      Within daily estimated target
                    </span>
                  )}
                </div>
              )}
            </div>

            {selectedDay.has_logs ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3 text-xs">
                <div>
                  <span className="text-dark-muted font-semibold block text-[11px] uppercase tracking-wider">Calories</span>
                  <span className="text-base font-black text-white">
                    ~{Math.round(selectedDay.calories!)} kcal
                  </span>
                </div>
                <div>
                  <span className="text-dark-muted font-semibold block text-[11px] uppercase tracking-wider">Protein</span>
                  <span className="text-base font-black text-lime-primary">
                    {selectedDay.protein}g{' '}
                    <span className="text-[10px] text-dark-muted font-normal">
                      ({selectedDay.protein_target_met ? 'Met' : `Target ${selectedDay.protein_target}g`})
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-dark-muted font-semibold block text-[11px] uppercase tracking-wider">Carbohydrates</span>
                  <span className="text-base font-black text-amber-400">
                    {selectedDay.carbohydrates}g
                  </span>
                </div>
                <div>
                  <span className="text-dark-muted font-semibold block text-[11px] uppercase tracking-wider">Fat</span>
                  <span className="text-base font-black text-rose-400">
                    {selectedDay.fat}g
                  </span>
                </div>
                <div>
                  <span className="text-dark-muted font-semibold block text-[11px] uppercase tracking-wider">Dietary Fiber</span>
                  <span className="text-base font-black text-emerald-400">
                    {selectedDay.fiber}g
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-dark-muted flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-500 shrink-0" />
                <span>
                  No meal records found for this calendar date. Unlogged days are treated as missing data, not as zero food intake.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Accessible Text Summary Table */}
        <div className="pt-2">
          <details className="text-xs text-dark-muted">
            <summary className="font-semibold cursor-pointer hover:text-white transition">
              View accessible numerical data table (7-day intake summary)
            </summary>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-left text-xs border border-dark-border rounded-xl overflow-hidden bg-dark-card">
                <thead className="bg-dark-inner text-slate-300 font-bold border-b border-dark-border">
                  <tr>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5">Calories</th>
                    <th className="p-2.5">Protein</th>
                    <th className="p-2.5">Carbs</th>
                    <th className="p-2.5">Fat</th>
                    <th className="p-2.5">Fiber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border/40 text-slate-300">
                  {days.map((d) => (
                    <tr key={d.date} className="hover:bg-dark-inner/50 transition">
                      <td className="p-2.5 font-medium text-white">
                        {d.day_name}, {d.date}
                      </td>
                      <td className="p-2.5">
                        {d.has_logs ? `${d.meal_count} meals` : 'Unlogged'}
                      </td>
                      <td className="p-2.5 font-mono">
                        {d.calories !== null ? `${Math.round(d.calories)} kcal` : '—'}
                      </td>
                      <td className="p-2.5 font-mono text-lime-primary">{d.protein !== null ? `${d.protein}g` : '—'}</td>
                      <td className="p-2.5 font-mono text-amber-400">
                        {d.carbohydrates !== null ? `${d.carbohydrates}g` : '—'}
                      </td>
                      <td className="p-2.5 font-mono text-rose-400">{d.fat !== null ? `${d.fat}g` : '—'}</td>
                      <td className="p-2.5 font-mono text-emerald-400">{d.fiber !== null ? `${d.fiber}g` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      </div>

      {/* Factual Narrative Insights Card */}
      <div className="bg-dark-card rounded-2xl border border-dark-border p-6 shadow-2xs space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Award className="w-4 h-4 text-lime-primary" />
          Deterministic Nutrition Insights
        </h3>
        <ul className="space-y-2 text-xs text-slate-300">
          {insights.insights_statements.map((statement, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-lime-primary shrink-0 mt-1.5" />
              <span>{statement}</span>
            </li>
          ))}
        </ul>

        <div className="pt-3 border-t border-dark-border text-[11px] text-dark-muted flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
          <span>{insights.disclaimer}</span>
        </div>
      </div>
    </div>
  );
};
