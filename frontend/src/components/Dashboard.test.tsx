import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dashboard } from './Dashboard';
import { api } from '../services/api';
import { DailyNutritionResponse, ProfileWithTarget, WeeklyAnalyticsResponse } from '../types';

describe('Dashboard Component - Health & Daily Nutrition Tracking', () => {
  const mockDailyData: DailyNutritionResponse = {
    date: '2026-10-14',
    target: {
      calorie_target: 2200,
      protein_target_g: 130,
      carbohydrates_target_g: 250,
      fat_target_g: 70,
      fiber_target_g: 30,
      has_custom_target: true,
      disclaimer: 'Custom target.',
    },
    consumed: {
      calories: 1450,
      protein_g: 95,
      carbohydrates_g: 160,
      fat_g: 45,
      fiber_g: 22,
    },
    remaining: {
      calories: 750,
      protein_g: 35,
      carbohydrates_g: 90,
      fat_g: 25,
      fiber_g: 8,
    },
    overage: {
      calories: 0,
      is_over_target: false,
      status_message: 'On track',
    },
    percentages: {
      calories: 66,
      protein: 73,
      carbohydrates: 64,
      fat: 64,
      fiber: 73,
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
        fiber: 8,
        time_logged: '08:30 AM',
        formatted_estimate: 'Estimated: ~550 kcal',
        item_count: 2,
        food_names: ['Oatmeal', 'Banana'],
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
        food_names: ['Grilled Chicken', 'Rice', 'Broccoli'],
      },
    ],
  };

  const mockProfile: ProfileWithTarget = {
    profile: {
      id: 'prof-1',
      user_id: 'user-1',
      name: 'Irfan Khan',
      age: 28,
      sex: 'MALE',
      height_cm: 180,
      weight_kg: 78.5,
      activity_level: 'MODERATELY_ACTIVE',
      goal: 'MAINTENANCE',
    },
    targets: {
      bmr: 1750,
      tdee: 2712,
      calorie_target: 2200,
      protein_target_g: 130,
      carbohydrates_target_g: 250,
      fat_target_g: 70,
      fiber_target_g: 30,
      disclaimer: 'Personalized target.',
      is_active: true,
    },
  };

  const mockWeekly = {
    start_date: '2026-10-08',
    end_date: '2026-10-14',
    days: [
      {
        date: '2026-10-13',
        day_name: 'Tue',
        has_logs: true,
        data_completeness: 'LOGGED',
        meal_count: 3,
        calories: 2150,
        protein: 125,
        carbohydrates: 200,
        fat: 60,
        fiber: 20,
        calorie_target: 2200,
        protein_target: 130,
        is_over_calorie_target: false,
        overage_calories: 0,
        calorie_percentage: 97,
        protein_target_met: false,
      },
      {
        date: '2026-10-14',
        day_name: 'Wed',
        has_logs: true,
        data_completeness: 'LOGGED',
        meal_count: 2,
        calories: 1450,
        protein: 95,
        carbohydrates: 150,
        fat: 45,
        fiber: 15,
        calorie_target: 2200,
        protein_target: 130,
        is_over_calorie_target: false,
        overage_calories: 0,
        calorie_percentage: 65,
        protein_target_met: false,
      },
    ],
    insights: {
      logged_days_count: 2,
      total_days: 7,
      average_calories_logged_days: 1800,
      average_protein_logged_days: 110,
      average_carbs_logged_days: 175,
      average_fat_logged_days: 52.5,
      average_fiber_logged_days: 17.5,
      protein_target_met_days: 0,
      highest_calorie_day: null,
      lowest_calorie_day: null,
      disclaimer: 'Trend analytics.',
      insights_statements: ['Good protein adherence.'],
    },
  } as WeeklyAnalyticsResponse;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('1. Renders today nutrition progress with consumed, target, and remaining calories', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(api, 'getDailyNutrition').mockResolvedValue(mockDailyData);
    vi.spyOn(api, 'getProfile').mockResolvedValue(mockProfile);
    vi.spyOn(api, 'getWeeklyAnalytics').mockResolvedValue(mockWeekly);

    render(
      <Dashboard
        onLogMealClick={() => {}}
        onConfigureProfileClick={() => {}}
      />
    );

    // Verify calories
    const calorieMatches = await screen.findAllByText(/1450/);
    expect(calorieMatches.length).toBeGreaterThan(0);
    expect(screen.getByText(/\/ 2200 kcal/i)).toBeInTheDocument();
    expect(screen.getByText(/750 kcal/i)).toBeInTheDocument();


    // Verify macros
    expect(screen.getByText(/95g/)).toBeInTheDocument();
    expect(screen.getByText(/160g/)).toBeInTheDocument();
    expect(screen.getByText(/45g/)).toBeInTheDocument();
  });

  it('2. Renders logged meals with time, name, and calories', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(api, 'getDailyNutrition').mockResolvedValue(mockDailyData);
    vi.spyOn(api, 'getProfile').mockResolvedValue(mockProfile);
    vi.spyOn(api, 'getWeeklyAnalytics').mockResolvedValue(mockWeekly);

    render(
      <Dashboard
        onLogMealClick={() => {}}
        onConfigureProfileClick={() => {}}
      />
    );

    expect(await screen.findByText('Oatmeal, Banana')).toBeInTheDocument();
    expect(screen.getByText('550 kcal')).toBeInTheDocument();
    expect(screen.getByText('08:30 AM')).toBeInTheDocument();

    expect(screen.getByText('Grilled Chicken, Rice, Broccoli')).toBeInTheDocument();
    expect(screen.getByText('900 kcal')).toBeInTheDocument();
  });

  it('3. Displays saved personal health summary when profile is configured', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(api, 'getDailyNutrition').mockResolvedValue(mockDailyData);
    vi.spyOn(api, 'getProfile').mockResolvedValue(mockProfile);
    vi.spyOn(api, 'getWeeklyAnalytics').mockResolvedValue(mockWeekly);

    render(
      <Dashboard
        onLogMealClick={() => {}}
        onConfigureProfileClick={() => {}}
      />
    );

    expect(await screen.findByText(/Personal Health Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/78.5/)).toBeInTheDocument(); // Weight
    expect(screen.getByText(/180/)).toBeInTheDocument(); // Height
    expect(screen.getByText(/28/)).toBeInTheDocument(); // Age
    expect(screen.getByRole('button', { name: /Edit Profile/i })).toBeInTheDocument();
  });

  it('4. Prompts to complete profile without displaying invented numbers when no profile exists', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(api, 'getDailyNutrition').mockResolvedValue(mockDailyData);
    vi.spyOn(api, 'getProfile').mockRejectedValue(new Error('Profile not found'));
    vi.spyOn(api, 'getWeeklyAnalytics').mockResolvedValue(mockWeekly);

    render(
      <Dashboard
        onLogMealClick={() => {}}
        onConfigureProfileClick={() => {}}
      />
    );

    expect(await screen.findByText(/Complete your profile to personalize/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Complete Profile/i })).toBeInTheDocument();
    // Verify no default fake 70 kg or 175 cm are displayed in the summary
    expect(screen.queryByText(/70 kg/)).not.toBeInTheDocument();
  });

  it('5. Handles failed requests by terminating loading and providing a Try Again action', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    const mockDaily = vi
      .spyOn(api, 'getDailyNutrition')
      .mockRejectedValueOnce(new Error('Network error loading data'))
      .mockResolvedValueOnce(mockDailyData);
    vi.spyOn(api, 'getProfile').mockResolvedValue(mockProfile);

    const user = userEvent.setup();
    render(
      <Dashboard
        onLogMealClick={() => {}}
        onConfigureProfileClick={() => {}}
      />
    );

    // Error is shown and loading indicator is gone
    expect(await screen.findByText(/Network error loading data/i)).toBeInTheDocument();
    expect(screen.queryByText(/Loading today's nutrition/i)).not.toBeInTheDocument();

    // Click Try Again
    const retryBtn = screen.getByRole('button', { name: /Try Again/i });
    await user.click(retryBtn);

    // Verify recovery
    await waitFor(() => {
      expect(mockDaily).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/1450/)).toBeInTheDocument();
    });
  });

  it('6. Handles empty meal history with clean empty state and scan shortcut', async () => {
    const emptyDaily: DailyNutritionResponse = {
      ...mockDailyData,
      consumed: { calories: 0, protein_g: 0, carbohydrates_g: 0, fat_g: 0, fiber_g: 0 },
      remaining: { calories: 2200, protein_g: 130, carbohydrates_g: 250, fat_g: 70, fiber_g: 30 },
      meal_count: 0,
      meals: [],
    };

    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(api, 'getDailyNutrition').mockResolvedValue(emptyDaily);
    vi.spyOn(api, 'getProfile').mockResolvedValue(mockProfile);
    vi.spyOn(api, 'getWeeklyAnalytics').mockResolvedValue(mockWeekly);

    const onLogMeal = vi.fn();
    const user = userEvent.setup();

    render(
      <Dashboard
        onLogMealClick={onLogMeal}
        onConfigureProfileClick={() => {}}
      />
    );

    expect(await screen.findByText(/Your day starts here./i)).toBeInTheDocument();
    expect(screen.getByText(/Take or upload a food photo to track your nutrition./i)).toBeInTheDocument();

    const scanBtn = screen.getByRole('button', { name: /Scan Food/i });
    await user.click(scanBtn);
    expect(onLogMeal).toHaveBeenCalled();
  });
});
