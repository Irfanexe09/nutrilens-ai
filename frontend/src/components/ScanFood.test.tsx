import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScanFood } from './ScanFood';
import { api, ApiError } from '../services/api';

describe('ScanFood Component - Direct AI Vision Analysis (No Cloud Storage Dependency)', () => {
  const mockAnalysisResponse = {
    meal_id: 'meal-12345',
    status: 'success' as const,
    analysis: {
      foods: [
        {
          id: 'food-1',
          name: 'Chicken Biryani',
          estimated_portion: { value: 1, unit: 'plate', display_text: '1 plate (~350g)' },
          confidence: 0.96,
        },
      ],
      overall_confidence: 0.96,
      uncertainties: [],
    },
  };

  const dummyFile = new File(['dummy-image-bytes'], 'biryani.jpg', { type: 'image/jpeg' });

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    // Default mock: authenticated user
    vi.spyOn(api, 'getToken').mockReturnValue('mock-auth-jwt-token');
  });

  const selectTestFile = (container: HTMLElement, file: File = dummyFile) => {
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput, { target: { files: [file] } });
  };

  it('1. Unauthenticated user: prompts to sign in or register before proceeding without calling AI analysis', async () => {
    vi.spyOn(api, 'getToken').mockReturnValue(null);
    const analyzeSpy = vi.spyOn(api, 'analyzeImage');
    const onSignInClick = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <ScanFood
        onAnalysisComplete={vi.fn()}
        onExploreDemo={vi.fn()}
        onSignInClick={onSignInClick}
      />
    );

    selectTestFile(container);
    expect(await screen.findByText('biryani.jpg')).toBeInTheDocument();

    const analyzeBtn = screen.getByRole('button', { name: /analyze food/i });
    await user.click(analyzeBtn);

    // AI analysis must NOT be called
    expect(analyzeSpy).not.toHaveBeenCalled();

    // Prompts user with Authentication Required
    expect(await screen.findByText(/Authentication Required/i)).toBeInTheDocument();
    expect(screen.getByText(/Please sign in or register to analyze your meal photos/i)).toBeInTheDocument();

    // Clicking Sign In / Register button triggers onSignInClick callback
    const signInBtn = screen.getByRole('button', { name: /sign in \/ register/i });
    await user.click(signInBtn);
    expect(onSignInClick).toHaveBeenCalledTimes(1);
  });

  it('2. Direct AI analysis: sends food image directly to backend without cloud storage upload delay', async () => {
    const user = userEvent.setup();
    const onAnalysisComplete = vi.fn();
    const analyzeSpy = vi.spyOn(api, 'analyzeImage').mockResolvedValue(mockAnalysisResponse as any);

    const { container } = render(
      <ScanFood onAnalysisComplete={onAnalysisComplete} onExploreDemo={vi.fn()} />
    );

    selectTestFile(container);
    expect(await screen.findByText('biryani.jpg')).toBeInTheDocument();

    // Metadata bar displays Direct AI Vision badge
    expect(screen.getByText(/Direct AI Vision/i)).toBeInTheDocument();

    const analyzeBtn = screen.getByRole('button', { name: /analyze food/i });
    await user.click(analyzeBtn);

    // Directly calls backend analysis
    await waitFor(() => {
      expect(analyzeSpy).toHaveBeenCalledTimes(1);
      expect(analyzeSpy).toHaveBeenCalledWith(dummyFile, expect.any(AbortSignal));
    });

    // Successfully navigates to confirmation screen with detected foods
    expect(await screen.findByText('Chicken Biryani')).toBeInTheDocument();
  });

  it('3. Cancellation: user can cancel an in-flight analysis, restoring UI cleanly', async () => {
    const user = userEvent.setup();

    // Create a pending promise that aborts when signal is triggered
    vi.spyOn(api, 'analyzeImage').mockImplementation((_file, signal) => {
      return new Promise((_, reject) => {
        signal?.addEventListener('abort', () => {
          const abortErr = new Error('The user aborted a request.');
          abortErr.name = 'AbortError';
          reject(abortErr);
        });
      });
    });

    const { container } = render(
      <ScanFood onAnalysisComplete={vi.fn()} onExploreDemo={vi.fn()} />
    );

    selectTestFile(container);
    const analyzeBtn = await screen.findByRole('button', { name: /analyze food/i });
    await user.click(analyzeBtn);

    // Cancel button should be visible during active analysis
    const cancelBtns = await screen.findAllByRole('button', { name: /cancel/i });
    expect(cancelBtns.length).toBeGreaterThan(0);
    await user.click(cancelBtns[0]);

    // Clean loading state reset and cancellation message
    await waitFor(() => {
      expect(screen.getByText(/Meal analysis was canceled by user/i)).toBeInTheDocument();
    });

    // Buttons are restored and active
    expect(screen.getByRole('button', { name: /retry analysis/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /choose different photo/i })).not.toBeDisabled();
  });

  it('4. Double-click prevention: prevents multiple concurrent analysis requests', async () => {
    let resolveAnalysis: (val: any) => void;
    const pendingPromise = new Promise<any>((res) => {
      resolveAnalysis = res;
    });

    const analyzeSpy = vi.spyOn(api, 'analyzeImage').mockReturnValue(pendingPromise);

    const { container } = render(
      <ScanFood onAnalysisComplete={vi.fn()} onExploreDemo={vi.fn()} />
    );

    selectTestFile(container);
    const analyzeBtn = await screen.findByRole('button', { name: /analyze food/i });

    // Click twice rapidly
    fireEvent.click(analyzeBtn);
    fireEvent.click(analyzeBtn);

    expect(analyzeSpy).toHaveBeenCalledTimes(1);

    resolveAnalysis!(mockAnalysisResponse);
    await waitFor(() => {
      expect(screen.getByText('Chicken Biryani')).toBeInTheDocument();
    });
  });

  it('5. Reset flow: clicking Choose Different Photo clears preview and resets state', async () => {
    const user = userEvent.setup();

    const { container } = render(
      <ScanFood onAnalysisComplete={vi.fn()} onExploreDemo={vi.fn()} />
    );

    selectTestFile(container);
    expect(await screen.findByText('biryani.jpg')).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /choose different photo/i });
    await user.click(resetBtn);

    // Returns to initial upload drop zone
    expect(screen.queryByText('biryani.jpg')).not.toBeInTheDocument();
    expect(screen.getByText(/Drag & drop your food photo here/i)).toBeInTheDocument();
  });

  it('6. Analysis failure handling: displays clear notice on 503 high demand and allows retry', async () => {
    const user = userEvent.setup();
    const apiError = new ApiError('The AI vision service is currently experiencing high demand. Please try again in a few moments.', 503);
    vi.spyOn(api, 'analyzeImage').mockRejectedValue(apiError);

    const { container } = render(
      <ScanFood onAnalysisComplete={vi.fn()} onExploreDemo={vi.fn()} />
    );

    selectTestFile(container);
    const analyzeBtn = await screen.findByRole('button', { name: /analyze food/i });
    await user.click(analyzeBtn);

    // Analysis Notice is rendered
    expect(await screen.findByText(/Analysis Notice/i)).toBeInTheDocument();
    expect(screen.getByText(/The AI vision service is currently experiencing high demand/i)).toBeInTheDocument();

    // No confusing storage notices are shown
    expect(screen.queryByText(/Storage Notice/i)).not.toBeInTheDocument();

    // UI is not stuck: Retry button is active
    const retryBtn = screen.getByRole('button', { name: /retry analysis/i });
    expect(retryBtn).not.toBeDisabled();
  });

  it('7. Analysis failure handling: displays polite notice on 504 gateway timeout', async () => {
    const user = userEvent.setup();
    const apiError = new ApiError('Gateway Timeout', 504);
    vi.spyOn(api, 'analyzeImage').mockRejectedValue(apiError);

    const { container } = render(
      <ScanFood onAnalysisComplete={vi.fn()} onExploreDemo={vi.fn()} />
    );

    selectTestFile(container);
    const analyzeBtn = await screen.findByRole('button', { name: /analyze food/i });
    await user.click(analyzeBtn);

    expect(await screen.findByText(/Food analysis timed out. The vision model took too long to respond/i)).toBeInTheDocument();
  });

  it('8. Analysis failure handling: displays distinct Daily Quota Notice on 429 daily quota exhaustion', async () => {
    const user = userEvent.setup();
    const apiError = new ApiError(
      'Daily AI vision quota exhausted. Free-tier quota has been reached for today. Please try again tomorrow.',
      429
    );
    vi.spyOn(api, 'analyzeImage').mockRejectedValue(apiError);

    const { container } = render(
      <ScanFood onAnalysisComplete={vi.fn()} onExploreDemo={vi.fn()} />
    );

    selectTestFile(container);
    const analyzeBtn = await screen.findByRole('button', { name: /analyze food/i });
    await user.click(analyzeBtn);

    expect(await screen.findByText('Daily Quota Notice')).toBeInTheDocument();
    expect(screen.getByText(/Daily AI vision quota exhausted/i)).toBeInTheDocument();
  });

  it('9. Analysis failure handling: displays Rate Limit Notice on 429 burst rate limits', async () => {
    const user = userEvent.setup();
    const apiError = new ApiError(
      'The AI vision service is receiving requests too quickly. Please wait a moment and try again.',
      429
    );
    vi.spyOn(api, 'analyzeImage').mockRejectedValue(apiError);

    const { container } = render(
      <ScanFood onAnalysisComplete={vi.fn()} onExploreDemo={vi.fn()} />
    );

    selectTestFile(container);
    const analyzeBtn = await screen.findByRole('button', { name: /analyze food/i });
    await user.click(analyzeBtn);

    expect(await screen.findByText('Rate Limit Notice')).toBeInTheDocument();
    expect(screen.getByText(/The AI vision service is receiving requests too quickly/i)).toBeInTheDocument();
  });

  it('10. Analysis failure handling: displays configuration notice on 503 provider model error', async () => {
    const user = userEvent.setup();
    const apiError = new ApiError(
      "Configured Gemini vision model 'gemini-2.0-flash' is unavailable or deprecated.",
      503
    );
    vi.spyOn(api, 'analyzeImage').mockRejectedValue(apiError);

    const { container } = render(
      <ScanFood onAnalysisComplete={vi.fn()} onExploreDemo={vi.fn()} />
    );

    selectTestFile(container);
    const analyzeBtn = await screen.findByRole('button', { name: /analyze food/i });
    await user.click(analyzeBtn);

    expect(await screen.findByText(/Analysis Notice/i)).toBeInTheDocument();
    expect(screen.getByText(/unavailable or deprecated/i)).toBeInTheDocument();
  });

  it('11. File validation: rejects files exceeding 10MB limit', async () => {
    const largeFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' });
    const { container } = render(
      <ScanFood onAnalysisComplete={vi.fn()} onExploreDemo={vi.fn()} />
    );

    selectTestFile(container, largeFile);

    expect(await screen.findByText(/Selected file exceeds the 10MB maximum upload limit/i)).toBeInTheDocument();
    expect(screen.queryByText('huge.jpg')).not.toBeInTheDocument();
  });

  it('12. File validation: rejects unsupported media types', async () => {
    const pdfFile = new File(['%PDF content'], 'document.pdf', { type: 'application/pdf' });
    const { container } = render(
      <ScanFood onAnalysisComplete={vi.fn()} onExploreDemo={vi.fn()} />
    );

    selectTestFile(container, pdfFile);

    expect(await screen.findByText(/Unsupported format. Please upload a JPEG, PNG, or WEBP image/i)).toBeInTheDocument();
  });
});
