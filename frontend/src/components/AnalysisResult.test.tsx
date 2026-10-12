import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnalysisResult } from './AnalysisResult';
import { api } from '../services/api';
import { MealItem, FoodItem } from '../types';

describe('AnalysisResult Component - Meal Persistence & Duplicate Protection', () => {
  const mockItems: MealItem[] = [
    {
      food_id: 1,
      food_name: 'Chicken Biryani',
      portion_value: 350,
      portion_unit: 'g',
      serving_count: 1,
      serving_size: 350,
      serving_unit: 'plate',
      calories: 520,
      protein: 28,
      carbohydrates: 65,
      fat: 16,
      fiber: 4,
      uncertainty_pct: 10,
    },
  ];

  const mockFoods: FoodItem[] = [
    {
      id: 1,
      name: 'Chicken Biryani',
      category: 'Rice Dish',
      serving_size: 350,
      serving_unit: 'plate',
      calories: 520,
      protein: 28,
      carbohydrates: 65,
      fat: 16,
      fiber: 4,
      sugar: 2,
      sodium: 650,
      is_indian_dish: true,
      uncertainty_pct: 10,
    },
  ];

  const mockSavedMeal = {
    id: 'meal-uuid-999',
    user_id: 'user-123',
    meal_type: 'lunch',
    notes: 'Scanned meal logged as lunch',
    total_calories: 520,
    total_protein: 28,
    total_carbohydrates: 65,
    total_fat: 16,
    total_fiber: 4,
    uncertainty_calories: 52,
    confidence_level: 'HIGH',
    items: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'calculateNutrition').mockResolvedValue({
      total_calories: 520,
      total_protein: 28,
      total_carbohydrates: 65,
      total_fat: 16,
      total_fiber: 4,
      total_sugar: 2,
      total_sodium: 650,
      calorie_min: 468,
      calorie_max: 572,
      uncertainty_calories: 52,
      confidence_level: 'HIGH',
      formatted_estimate: 'Estimated: ~520 kcal (±52 kcal)',
      macro_distribution: {
        protein_pct: 22,
        carbohydrates_pct: 50,
        fat_pct: 28,
      },
    });
  });

  it('1. Log Meal succeeds: disables button, shows confirmation message, and logs meal', async () => {
    const user = userEvent.setup();
    const saveSpy = vi.spyOn(api, 'saveMeal').mockResolvedValue(mockSavedMeal as any);
    const onScanAnother = vi.fn();

    render(
      <AnalysisResult
        initialItems={mockItems}
        previewImageUrl="blob:test-image"
        onScanAnother={onScanAnother}
        availableFoods={mockFoods}
      />
    );

    const logMealBtn = await screen.findByRole('button', { name: /log meal/i });
    expect(logMealBtn).toBeInTheDocument();

    await user.click(logMealBtn);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        meal_type: 'lunch',
        items: expect.any(Array),
      })
    );

    expect(await screen.findByText(/Meal recorded successfully as lunch!/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /meal logged/i })).toBeDisabled();
  });

  it('2. Double-click prevention: prevents duplicate meal submissions on rapid clicks', async () => {
    let resolveSave: (val: any) => void;
    const savePromise = new Promise((resolve) => {
      resolveSave = resolve;
    });

    const saveSpy = vi.spyOn(api, 'saveMeal').mockReturnValue(savePromise as any);
    const onScanAnother = vi.fn();

    render(
      <AnalysisResult
        initialItems={mockItems}
        previewImageUrl="blob:test-image"
        onScanAnother={onScanAnother}
        availableFoods={mockFoods}
      />
    );

    const logMealBtn = await screen.findByRole('button', { name: /log meal/i });

    // Click twice rapidly
    fireEvent.click(logMealBtn);
    fireEvent.click(logMealBtn);

    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Resolve in-flight save
    resolveSave!(mockSavedMeal);
    await waitFor(() => {
      expect(screen.getByText(/Meal recorded successfully as lunch!/i)).toBeInTheDocument();
    });
  });

  it('3. Failure recovery: displays actionable save error and re-enables button if saving fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(api, 'saveMeal').mockRejectedValue(new Error('Network error: server unreachable'));
    const onScanAnother = vi.fn();

    render(
      <AnalysisResult
        initialItems={mockItems}
        previewImageUrl="blob:test-image"
        onScanAnother={onScanAnother}
        availableFoods={mockFoods}
      />
    );

    const logMealBtn = await screen.findByRole('button', { name: /log meal/i });
    await user.click(logMealBtn);

    // Displays clear save error notice
    expect(await screen.findByText(/Network error: server unreachable/i)).toBeInTheDocument();

    // Re-enables button so user can retry
    expect(screen.getByRole('button', { name: /log meal/i })).not.toBeDisabled();
  });
});
