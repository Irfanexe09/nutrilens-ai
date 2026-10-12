import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Profile } from './Profile';
import { api } from '../services/api';
import { ProfileWithTarget } from '../types';

describe('Profile Component - Biometric Inputs & Target Calculations', () => {
  const mockProfileData: ProfileWithTarget = {
    profile: {
      id: 'prof-123',
      user_id: 'user-123',
      name: 'Test Athlete',
      age: 26,
      sex: 'MALE',
      height_cm: 175,
      weight_kg: 70,
      activity_level: 'MODERATELY_ACTIVE',
      goal: 'WEIGHT_LOSS',
    },
    targets: {
      bmr: 1674,
      tdee: 2595,
      calorie_target: 2195,
      protein_target_g: 98,
      carbohydrates_target_g: 273.4,
      fat_target_g: 61,
      fiber_target_g: 30.7,
      disclaimer: 'Informational target.',
      is_active: true,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('1. Replaces an existing weight value without resetting or rejecting new digits', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'user-123', email: 'test@nutrilens.ai' });
    vi.spyOn(api, 'getProfile').mockResolvedValue(mockProfileData);

    const user = userEvent.setup();
    render(<Profile />);

    const weightInput = await screen.findByLabelText(/weight/i);
    expect(weightInput).toHaveValue('70');

    // Select all and replace with 82.5
    await user.clear(weightInput);
    await user.type(weightInput, '82.5');

    expect(weightInput).toHaveValue('82.5');
  });

  it('2. Clears and re-enters a weight value without snapping back to 70', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'user-123', email: 'test@nutrilens.ai' });
    vi.spyOn(api, 'getProfile').mockResolvedValue(mockProfileData);

    const user = userEvent.setup();
    render(<Profile />);

    const weightInput = await screen.findByLabelText(/weight/i);
    expect(weightInput).toHaveValue('70');

    // Clear input
    await user.clear(weightInput);
    expect(weightInput).toHaveValue('');

    // Type a new weight
    await user.type(weightInput, '65');
    expect(weightInput).toHaveValue('65');
  });

  it('3. Edits height without resetting the field to 170 on backspace or typing', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'user-123', email: 'test@nutrilens.ai' });
    vi.spyOn(api, 'getProfile').mockResolvedValue(mockProfileData);

    const user = userEvent.setup();
    render(<Profile />);

    const heightInput = await screen.findByLabelText(/height/i);
    expect(heightInput).toHaveValue('175');

    await user.clear(heightInput);
    expect(heightInput).toHaveValue('');

    await user.type(heightInput, '182');
    expect(heightInput).toHaveValue('182');
  });

  it('4. Edits age without resetting the field to 25', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'user-123', email: 'test@nutrilens.ai' });
    vi.spyOn(api, 'getProfile').mockResolvedValue(mockProfileData);

    const user = userEvent.setup();
    render(<Profile />);

    const ageInput = await screen.findByLabelText(/age/i);
    expect(ageInput).toHaveValue('26');

    await user.clear(ageInput);
    expect(ageInput).toHaveValue('');

    await user.type(ageInput, '34');
    expect(ageInput).toHaveValue('34');
  });

  it('5. Invalid values display clear validation errors and block save', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'user-123', email: 'test@nutrilens.ai' });
    vi.spyOn(api, 'getProfile').mockResolvedValue(mockProfileData);
    const updateSpy = vi.spyOn(api, 'updateProfile');

    const user = userEvent.setup();
    render(<Profile />);

    const ageInput = await screen.findByLabelText(/age/i);
    await user.clear(ageInput);
    await user.type(ageInput, '5'); // Invalid (< 10)

    const submitBtn = screen.getByRole('button', { name: /save profile/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/age must be a whole number between 10 and 120/i)).toBeInTheDocument();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('6. Saving valid values sends the correct numeric API payload', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'user-123', email: 'test@nutrilens.ai' });
    vi.spyOn(api, 'getProfile').mockResolvedValue(mockProfileData);

    const updateSpy = vi.spyOn(api, 'updateProfile').mockResolvedValue({
      profile: {
        ...mockProfileData.profile,
        age: 30,
        height_cm: 180,
        weight_kg: 75.5,
      },
      targets: {
        ...mockProfileData.targets,
        calorie_target: 2350,
      },
    });

    const user = userEvent.setup();
    render(<Profile />);

    const ageInput = await screen.findByLabelText(/age/i);
    const heightInput = screen.getByLabelText(/height/i);
    const weightInput = screen.getByLabelText(/weight/i);

    await user.clear(ageInput);
    await user.type(ageInput, '30');

    await user.clear(heightInput);
    await user.type(heightInput, '180');

    await user.clear(weightInput);
    await user.type(weightInput, '75.5');

    const submitBtn = screen.getByRole('button', { name: /save profile/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          age: 30,
          height_cm: 180,
          weight_kg: 75.5,
          sex: 'MALE',
          activity_level: 'MODERATELY_ACTIVE',
          goal: 'WEIGHT_LOSS',
        })
      );
    });
  });

  it('7. Successful saves preserve updated values and show confirmation', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'user-123', email: 'test@nutrilens.ai' });
    vi.spyOn(api, 'getProfile').mockResolvedValue(mockProfileData);

    vi.spyOn(api, 'updateProfile').mockResolvedValue({
      profile: {
        ...mockProfileData.profile,
        weight_kg: 78,
      },
      targets: {
        ...mockProfileData.targets,
        calorie_target: 2400,
      },
    });

    const user = userEvent.setup();
    render(<Profile />);

    const weightInput = await screen.findByLabelText(/weight/i);
    await user.clear(weightInput);
    await user.type(weightInput, '78');

    const submitBtn = screen.getByRole('button', { name: /save profile/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/saved successfully/i)).toBeInTheDocument();
    expect(weightInput).toHaveValue('78');
  });

  it('8. Failed saves show an error without silently discarding user edits', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'user-123', email: 'test@nutrilens.ai' });
    vi.spyOn(api, 'getProfile').mockResolvedValue(mockProfileData);

    vi.spyOn(api, 'updateProfile').mockRejectedValue(new Error('Network error on save'));

    const user = userEvent.setup();
    render(<Profile />);

    const weightInput = await screen.findByLabelText(/weight/i);
    await user.clear(weightInput);
    await user.type(weightInput, '79.2');

    const submitBtn = screen.getByRole('button', { name: /save profile/i });
    await user.click(submitBtn);

    expect(await screen.findByText(/Network error on save/i)).toBeInTheDocument();
    // User value must be preserved in state
    expect(weightInput).toHaveValue('79.2');
  });

  it('9. Delayed API responses do not overwrite active unsaved edits', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'user-123', email: 'test@nutrilens.ai' });

    // Simulate slow network response for getProfile
    let resolveProfile: (data: ProfileWithTarget) => void;
    const slowProfilePromise = new Promise<ProfileWithTarget>((resolve) => {
      resolveProfile = resolve;
    });
    vi.spyOn(api, 'getProfile').mockReturnValue(slowProfilePromise);

    const user = userEvent.setup();
    render(<Profile />);

    const weightInput = screen.getByLabelText(/weight/i);

    // User starts typing before API resolves
    await user.clear(weightInput);
    await user.type(weightInput, '88');
    expect(weightInput).toHaveValue('88');

    // API now resolves with stale server weight of 70
    resolveProfile!(mockProfileData);

    // Wait and ensure the user's active edit was NOT overwritten
    await waitFor(() => {
      expect(weightInput).toHaveValue('88');
    });
  });

  it('10. Reloading displays persisted values after initial fetch', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue('valid-token');
    vi.spyOn(api, 'getMe').mockResolvedValue({ id: 'user-123', email: 'test@nutrilens.ai' });
    vi.spyOn(api, 'getProfile').mockResolvedValue({
      profile: {
        ...mockProfileData.profile,
        age: 42,
        height_cm: 185,
        weight_kg: 84,
      },
      targets: mockProfileData.targets,
    });

    render(<Profile />);

    expect(await screen.findByLabelText(/age/i)).toHaveValue('42');
    expect(screen.getByLabelText(/height/i)).toHaveValue('185');
    expect(screen.getByLabelText(/weight/i)).toHaveValue('84');
  });
});
