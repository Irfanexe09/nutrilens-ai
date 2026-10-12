import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Profile } from './Profile';
import { api, ApiError } from '../services/api';
import * as firebaseService from '../services/firebase';

describe('Profile Auth Modal - Password Recovery & Account Linking', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    // Default mock for profile
    vi.spyOn(api, 'getToken').mockReturnValue(null);
  });

  it('1. Clicking "Forgot password?" switches to the password recovery screen', async () => {
    const user = userEvent.setup();
    render(<Profile />);

    const openAuthBtn = screen.getByRole('button', { name: /sign in \/ sync data/i });
    await user.click(openAuthBtn);

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();

    const forgotBtn = screen.getByRole('button', { name: /forgot password\?/i });
    await user.click(forgotBtn);

    expect(screen.getByRole('heading', { name: /reset your password/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send recovery link/i })).toBeInTheDocument();
  });

  it('2. Submitting forgot password calls api.forgotPassword and shows confirmation message', async () => {
    const forgotSpy = vi.spyOn(api, 'forgotPassword').mockResolvedValue({
      message: 'If an account exists with this email, a password reset link has been sent.',
    });

    const user = userEvent.setup();
    render(<Profile />);

    await user.click(screen.getByRole('button', { name: /sign in \/ sync data/i }));
    await user.click(screen.getByRole('button', { name: /forgot password\?/i }));

    const emailInput = screen.getByPlaceholderText(/name@example.com/i);
    await user.type(emailInput, 'user@nutrilens.ai');

    const submitBtn = screen.getByRole('button', { name: /send recovery link/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(forgotSpy).toHaveBeenCalledWith('user@nutrilens.ai');
    });

    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to sign in/i })).toBeInTheDocument();
  });

  it('3. Google sign-in encountering 409 ACCOUNT_LINKING_REQUIRED transitions to link-account mode', async () => {
    const mockFirebaseUser = {
      email: 'existing@nutrilens.ai',
      getIdToken: vi.fn().mockResolvedValue('mock-google-id-token-xyz'),
    };
    vi.spyOn(firebaseService, 'signInWithGoogle').mockResolvedValue(mockFirebaseUser as any);

    // Mock api.firebaseAuth rejecting with 409 ACCOUNT_LINKING_REQUIRED
    vi.spyOn(api, 'firebaseAuth').mockRejectedValue(
      new ApiError('An account with this email already exists.', 409, {
        detail: {
          error_code: 'ACCOUNT_LINKING_REQUIRED',
          email: 'existing@nutrilens.ai',
        },
      })
    );

    const user = userEvent.setup();
    render(<Profile />);

    await user.click(screen.getByRole('button', { name: /sign in \/ sync data/i }));

    const googleBtn = screen.getByRole('button', { name: /continue with google/i });
    await user.click(googleBtn);

    // Should transition to Account Verification / Link Google Account modal
    expect(await screen.findByRole('heading', { name: /link google account/i })).toBeInTheDocument();
    expect(screen.getByText('existing@nutrilens.ai')).toBeInTheDocument();
    expect(screen.getByLabelText(/nutrilens password/i)).toBeInTheDocument();
  });

  it('4. Submitting password on link-account verifies password and links Google in-memory token', async () => {
    const mockFirebaseUser = {
      email: 'linkme@nutrilens.ai',
      getIdToken: vi.fn().mockResolvedValue('in-memory-firebase-token-123'),
    };
    vi.spyOn(firebaseService, 'signInWithGoogle').mockResolvedValue(mockFirebaseUser as any);
    vi.spyOn(api, 'firebaseAuth').mockRejectedValue(
      new ApiError('Link required', 409, {
        detail: {
          error_code: 'ACCOUNT_LINKING_REQUIRED',
          email: 'linkme@nutrilens.ai',
        },
      })
    );

    const loginSpy = vi.spyOn(api, 'login').mockResolvedValue({
      access_token: 'nutrilens-jwt-token',
      user: { id: 'usr-1', email: 'linkme@nutrilens.ai', firebase_uid: null },
    });
    const linkSpy = vi.spyOn(api, 'linkFirebase').mockResolvedValue({
      id: 'usr-1',
      email: 'linkme@nutrilens.ai',
      firebase_uid: 'google-uid-abc',
    });
    vi.spyOn(api, 'updateProfile').mockResolvedValue({
      profile: {} as any,
      targets: {} as any,
    });

    const user = userEvent.setup();
    render(<Profile />);

    await user.click(screen.getByRole('button', { name: /sign in \/ sync data/i }));
    await user.click(screen.getByRole('button', { name: /continue with google/i }));

    // Wait for link modal
    const passwordInput = await screen.findByLabelText(/nutrilens password/i);
    await user.type(passwordInput, 'MySecurePass123!');

    const linkSubmitBtn = screen.getByRole('button', { name: /verify password & link google/i });
    await user.click(linkSubmitBtn);

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith('linkme@nutrilens.ai', 'MySecurePass123!');
      expect(linkSpy).toHaveBeenCalledWith('in-memory-firebase-token-123');
    });

    // Modal should close and show linked email in header
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /link google account/i })).not.toBeInTheDocument();
    });
  });

  it('5. URL reset_token parameter automatically opens reset-password mode', async () => {
    // Simulate ?reset_token=tok_test_456 in URL
    window.history.pushState({}, '', '/?reset_token=tok_test_456');

    const resetSpy = vi.spyOn(api, 'resetPassword').mockResolvedValue({
      message: 'Password reset successful. Please sign in.',
    });

    const user = userEvent.setup();
    render(<Profile />);

    expect(await screen.findByRole('heading', { name: /create new password/i })).toBeInTheDocument();

    const newPassInput = screen.getByLabelText(/^new password/i);
    const confirmPassInput = screen.getByLabelText(/^confirm new password/i);

    await user.type(newPassInput, 'NewPass123!');
    await user.type(confirmPassInput, 'NewPass123!');

    const submitBtn = screen.getByRole('button', { name: /update password & continue/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(resetSpy).toHaveBeenCalledWith('tok_test_456', 'NewPass123!');
    });

    expect(await screen.findByText(/password reset complete/i)).toBeInTheDocument();
  });
});
