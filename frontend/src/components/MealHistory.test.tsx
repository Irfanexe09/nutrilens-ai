import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MealHistory } from './MealHistory';
import { api } from '../services/api';
import {
  DailyNutritionResponse,
  WeeklyAnalyticsResponse,
  WeightHistoryResponse,
} from '../types';

describe('MealHistory Component - Date Navigation, Daily Totals & Historical Trends', () => {
  const mockDailyData: DailyNutritionResponse = {
    date: '2026-10-14',
    target: {
      calorie_target: 2100,
      protein_target_g: 130,
      carbohydrates_target_g: 240,
      fat_target_g: 65,
      fiber_target_g: 28,
      has_custom_target: true,
      disclaimer: 'Custom target.',
    },
    consumed: {
      calories: 1450,
      protein_g: 95,
      carbohydrates_g: 160,
      fat_g: 45,
      fiber_g: 20,
    },
    remaining: {
      calories: 650,
      protein_g: 35,
      carbohydrates_g: 80,
      fat_g: 20,
      fiber_g: 8,
    },
    overage: {
      calories: 0,
      is_over_target: false,
      status_message: 'On track',
    },
    percentages: {
      calories: 69,
      protein: 73,
      carbohydrates: 67,
      fat: 69,
      fiber: 71,
    },
    meal_count: 2,
    meals: [
      {
        id: 'meal-1',
        meal_type: 'breakfast',
        calories: 550,
        protein: 30,
        carbohydrates: 60,
        fat: 18,
        fiber: 6,
        time_logged: '08:30 AM',
        formatted_estimate: 'Estimated: ~550 kcal',
        item_count: 2,
        food_names: ['Oatmeal with berries', 'Greek Yogurt'],
      },
      {
        id: 'meal-2',
        meal_type: 'lunch',
        calories: 900,
        protein: 65,
        carbohydrates: 100,
        fat: 27,
        fiber: 14,
        time_logged: '01:15 PM',
        formatted_estimate: 'Estimated: ~900 kcal',
        item_count: 3,
        food_names: ['Grilled Chicken Bowl', 'Quinoa', 'Avocado Salad'],
      },
    ],
  };

  const mockWeeklyAnalytics: WeeklyAnalyticsResponse = {
    start_date: '2026-10-08',
    end_date: '2026-10-14',
    days: [
      {
        date: '2026-10-08',
        day_name: 'Wednesday',
        has_logs: true,
        data_completeness: 'LOGGED',
        meal_count: 3,
        calories: 2050,
        protein: 125,
        carbohydrates: 220,
        fat: 60,
        fiber: 25,
        calorie_target: 2100,
        protein_target: 130,
        is_over_calorie_target: false,
        overage_calories: 0,
        calorie_percentage: 97,
        protein_target_met: false,
      },
      {
        date: '2026-10-09',
        day_name: 'Thursday',
        has_logs: true,
        data_completeness: 'LOGGED',
        meal_count: 3,
        calories: 1950,
        protein: 135,
        carbohydrates: 210,
        fat: 58,
        fiber: 26,
        calorie_target: 2100,
        protein_target: 130,
        is_over_calorie_target: false,
        overage_calories: 0,
        calorie_percentage: 92,
        protein_target_met: true,
      },
      {
        date: '2026-10-10',
        day_name: 'Friday',
        has_logs: true,
        data_completeness: 'LOGGED',
        meal_count: 2,
        calories: 2250,
        protein: 110,
        carbohydrates: 260,
        fat: 75,
        fiber: 18,
        calorie_target: 2100,
        protein_target: 130,
        is_over_calorie_target: true,
        overage_calories: 150,
        calorie_percentage: 107,
        protein_target_met: false,
      },
      {
        date: '2026-10-11',
        day_name: 'Saturday',
        has_logs: false,
        data_completeness: 'UNLOGGED',
        meal_count: 0,
        calories: null,
        protein: null,
        carbohydrates: null,
        fat: null,
        fiber: null,
        calorie_target: 2100,
        protein_target: 130,
        is_over_calorie_target: false,
        overage_calories: 0,
        calorie_percentage: 0,
        protein_target_met: false,
      },
      {
        date: '2026-10-12',
        day_name: 'Sunday',
        has_logs: true,
        data_completeness: 'LOGGED',
        meal_count: 2,
        calories: 1800,
        protein: 120,
        carbohydrates: 190,
        fat: 55,
        fiber: 22,
        calorie_target: 2100,
        protein_target: 130,
        is_over_calorie_target: false,
        overage_calories: 0,
        calorie_percentage: 85,
        protein_target_met: false,
      },
      {
        date: '2026-10-13',
        day_name: 'Monday',
        has_logs: true,
        data_completeness: 'LOGGED',
        meal_count: 3,
        calories: 2100,
        protein: 140,
        carbohydrates: 230,
        fat: 62,
        fiber: 30,
        calorie_target: 2100,
        protein_target: 130,
        is_over_calorie_target: false,
        overage_calories: 0,
        calorie_percentage: 100,
        protein_target_met: true,
      },
      {
        date: '2026-10-14',
        day_name: 'Tuesday',
        has_logs: true,
        data_completeness: 'PARTIAL',
        meal_count: 2,
        calories: 1450,
        protein: 95,
        carbohydrates: 160,
        fat: 45,
        fiber: 20,
        calorie_target: 2100,
        protein_target: 130,
        is_over_calorie_target: false,
        overage_calories: 0,
        calorie_percentage: 69,
        protein_target_met: false,
      },
    ],
    insights: {
      logged_days_count: 6,
      total_days: 7,
      average_calories_logged_days: 1933.3,
      average_protein_logged_days: 120.8,
      average_carbs_logged_days: 211.7,
      average_fat_logged_days: 59.2,
      average_fiber_logged_days: 23.5,
      protein_target_met_days: 2,
      highest_calorie_day: { date: '2026-10-10', calories: 2250 },
      lowest_calorie_day: { date: '2026-10-14', calories: 1450 },
      insights_statements: [
        'Average daily calories were 1933 kcal across 6 logged days.',
        'Met daily protein target on 2 days.',
      ],
      disclaimer: 'Calculated over logged days.',
    },
  };

  const mockWeightHistory: WeightHistoryResponse = {
    entries: [
      {
        id: 'w-1',
        user_id: 'user-1',
        weight_kg: 74.5,
        date: '2026-10-14',
        notes: 'Morning weigh-in',
        created_at: '2026-10-14T07:00:00Z',
      },
      {
        id: 'w-2',
        user_id: 'user-1',
        weight_kg: 75.2,
        date: '2026-10-07',
        notes: null,
        created_at: '2026-10-07T07:00:00Z',
      },
    ],
    total: 2,
    latest: {
      id: 'w-1',
      user_id: 'user-1',
      weight_kg: 74.5,
      date: '2026-10-14',
      notes: 'Morning weigh-in',
      created_at: '2026-10-14T07:00:00Z',
    },
    change_kg: -0.7,
    trend: 'DECREASING',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, 'getToken').mockReturnValue('mock-token');
    vi.spyOn(api, 'getDailyNutrition').mockResolvedValue(mockDailyData);
    vi.spyOn(api, 'getWeeklyAnalytics').mockResolvedValue(mockWeeklyAnalytics);
    vi.spyOn(api, 'getWeightHistory').mockResolvedValue(mockWeightHistory);
    vi.spyOn(api, 'getMeals').mockResolvedValue({
      meals: [
        {
          id: 'meal-1',
          user_id: 'user-1',
          meal_type: 'breakfast',
          total_calories: 550,
          total_protein: 30,
          total_carbohydrates: 60,
          total_fat: 18,
          total_fiber: 6,
          uncertainty_calories: 25,
          created_at: '2026-10-14T08:30:00Z',
          items: [{ food_name: 'Oatmeal with berries' }],
        } as any,
      ],
      total: 1,
    });
  });

  it('1. Renders date navigation bar and daily nutrition totals for selected date', async () => {
    render(<MealHistory onSelectMeal={vi.fn()} onLogMeal={vi.fn()} />);

    await waitFor(() => {
      expect(api.getDailyNutrition).toHaveBeenCalled();
    });

    // Check header
    expect(screen.getByText(/Meal History & Daily Nutrition/i)).toBeInTheDocument();

    // Check navigation controls
    expect(screen.getByLabelText(/Previous day/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Next day/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Select Date/i)).toBeInTheDocument();

    // Check calories and macros
    expect(screen.getByText('1450')).toBeInTheDocument();
    expect(screen.getByText(/650 kcal remaining/i)).toBeInTheDocument();
    expect(screen.getByText(/95/)).toBeInTheDocument();
    expect(screen.getByText(/\/ 130g/i)).toBeInTheDocument();
  });

  it('2. Navigates to previous day and loads historical data for that date', async () => {
    const user = userEvent.setup();
    render(<MealHistory onSelectMeal={vi.fn()} onLogMeal={vi.fn()} />);

    await waitFor(() => {
      expect(api.getDailyNutrition).toHaveBeenCalled();
    });

    // Click Previous Day button
    const prevBtn = screen.getByLabelText(/Previous day/i);
    await user.click(prevBtn);

    await waitFor(() => {
      // api.getDailyNutrition should have been called twice (initial + navigated)
      expect(api.getDailyNutrition).toHaveBeenCalledTimes(2);
    });
  });

  it('3. Renders meal cards and triggers onSelectMeal when clicking a meal', async () => {
    const user = userEvent.setup();
    const handleSelectMeal = vi.fn();
    render(<MealHistory onSelectMeal={handleSelectMeal} onLogMeal={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Oatmeal with berries/i)).toBeInTheDocument();
      expect(screen.getByText(/Grilled Chicken Bowl/i)).toBeInTheDocument();
    });

    // Click first meal card
    await user.click(screen.getByText(/Oatmeal with berries/i));

    expect(handleSelectMeal).toHaveBeenCalledTimes(1);
    expect(handleSelectMeal).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'meal-1',
        meal_type: 'breakfast',
        calories: 550,
      })
    );
  });

  it('4. Displays clean empty state with Scan Food button when no meals exist for date', async () => {
    const user = userEvent.setup();
    const handleLogMeal = vi.fn();

    vi.spyOn(api, 'getDailyNutrition').mockResolvedValueOnce({
      ...mockDailyData,
      consumed: { calories: 0, protein_g: 0, carbohydrates_g: 0, fat_g: 0, fiber_g: 0 },
      meals: [],
      meal_count: 0,
    });

    render(<MealHistory onSelectMeal={vi.fn()} onLogMeal={handleLogMeal} />);

    await waitFor(() => {
      expect(screen.getByText(/No meals logged for this date/i)).toBeInTheDocument();
    });

    // Click Scan Food button
    const scanBtn = screen.getAllByRole('button', { name: /Scan Food/i })[1];
    await user.click(scanBtn);

    expect(handleLogMeal).toHaveBeenCalled();
  });

  it('5. Handles API failure gracefully with Try Again retry action', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'getDailyNutrition')
      .mockRejectedValueOnce(new Error('Network error loading daily record'))
      .mockResolvedValueOnce(mockDailyData);

    render(<MealHistory onSelectMeal={vi.fn()} onLogMeal={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Network error loading daily record/i)).toBeInTheDocument();
    });

    // Click Try Again
    const retryBtn = screen.getByRole('button', { name: /Try Again/i });
    await user.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('1450')).toBeInTheDocument();
    });
  });

  it('6. Enforces honest reporting guardrail when user has <= 1 logged day in Nutrition Trends', async () => {
    const user = userEvent.setup();

    // Insufficient logged days (only 1 logged day)
    vi.spyOn(api, 'getWeeklyAnalytics').mockResolvedValueOnce({
      ...mockWeeklyAnalytics,
      days: [
        {
          ...mockWeeklyAnalytics.days[0],
          has_logs: true,
          calories: 1800,
        },
        ...mockWeeklyAnalytics.days.slice(1).map((d) => ({
          ...d,
          has_logs: false,
          calories: null,
        })),
      ],
      insights: {
        ...mockWeeklyAnalytics.insights,
        logged_days_count: 1,
      },
    });

    render(<MealHistory onSelectMeal={vi.fn()} onLogMeal={vi.fn()} />);

    // Switch to Nutrition Trends tab
    const trendsTabBtn = screen.getByRole('button', { name: /Nutrition Trends/i });
    await user.click(trendsTabBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Record more meals to see meaningful trends/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Once you log meals across multiple days/i)
      ).toBeInTheDocument();
    });

    // Averages should NOT be shown when insufficient data
    expect(screen.queryByText(/Average Daily Calories/i)).not.toBeInTheDocument();
  });

  it('7. Displays average calories, average protein, weight trend, and bar chart when sufficient historical data exists', async () => {
    const user = userEvent.setup();
    render(<MealHistory onSelectMeal={vi.fn()} onLogMeal={vi.fn()} />);

    // Switch to Nutrition Trends tab
    const trendsTabBtn = screen.getByRole('button', { name: /Nutrition Trends/i });
    await user.click(trendsTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Average Daily Calories')).toBeInTheDocument();
    });

    expect(screen.getByText('1933')).toBeInTheDocument();
    expect(screen.getByText(/Average Daily Protein/i)).toBeInTheDocument();
    expect(screen.getByText('121')).toBeInTheDocument();
    expect(screen.getByText(/Weight Trend/i)).toBeInTheDocument();
    expect(screen.getByText('74.5')).toBeInTheDocument();
    expect(screen.getByText(/Losing weight/i)).toBeInTheDocument();
    expect(screen.getByText(/Calorie Intake vs Target/i)).toBeInTheDocument();
  });

  it('8. Switches between 7-day and 30-day analytics windows', async () => {
    const user = userEvent.setup();
    render(<MealHistory onSelectMeal={vi.fn()} onLogMeal={vi.fn()} />);

    // Switch to Nutrition Trends tab
    await user.click(screen.getByRole('button', { name: /Nutrition Trends/i }));

    await waitFor(() => {
      expect(api.getWeeklyAnalytics).toHaveBeenCalledWith(undefined, 7);
    });

    // Click 30 Days toggle
    const thirtyDaysBtn = screen.getByRole('button', { name: /30 Days/i });
    await user.click(thirtyDaysBtn);

    await waitFor(() => {
      expect(api.getWeeklyAnalytics).toHaveBeenCalledWith(undefined, 30);
    });
  });

  it('9. Switches to All Meals tab and renders paginated meal records', async () => {
    const user = userEvent.setup();
    render(<MealHistory onSelectMeal={vi.fn()} onLogMeal={vi.fn()} />);

    // Switch to All Meals tab
    const allMealsTab = screen.getByRole('button', { name: /All Meals/i });
    await user.click(allMealsTab);

    await waitFor(() => {
      expect(api.getMeals).toHaveBeenCalled();
      expect(screen.getByText(/Filter Past Meals/i)).toBeInTheDocument();
      expect(screen.getByText(/Showing 1–1 of 1 meals/i)).toBeInTheDocument();
    });
  });
});
