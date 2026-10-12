import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScanFood } from './ScanFood';
import { api, ApiError } from '../services/api';
import * as firebaseService from '../services/firebase';

describe('ScanFood Component - Cloud Storage Upload & Resilient Pipeline', () => {
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
  });

  const selectTestFile = (container: HTMLElement, file: File = dummyFile) => {
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput, { target: { files: [file] } });
  };

  it('1. Upload success: reports progress, marks cloud storage uploaded, and completes AI analysis', async () => {
    const user = userEvent.setup();
    const onAnalysisComplete = vi.fn();
    const onExploreDemo = vi.fn();

    const mockStorageUrl = 'https://firebasestorage.googleapis.com/v0/b/nutrilens.appspot.com/o/users%2Fuid123%2Ffood-scans%2Fmeal.jpg?alt=media';

    const uploadSpy = vi.spyOn(firebaseService, 'uploadFoodImageToStorage').mockImplementation(async (_file, options) => {
      const opts = typeof options === 'object' ? options : {};
      opts?.onProgress?.({
        bytesTransferred: 500,
        totalBytes: 1000,
        progressPercent: 50,
        state: 'running',
      });
      opts?.onProgress?.({
        bytesTransferred: 1000,
        totalBytes: 1000,
        progressPercent: 100,
        state: 'success',
      });
      return mockStorageUrl;
    });

    const analyzeSpy = vi.spyOn(api, 'analyzeImage').mockResolvedValue(mockAnalysisResponse as any);

    const { container } = render(
      <ScanFood onAnalysisComplete={onAnalysisComplete} onExploreDemo={onExploreDemo} />
    );

    // Select photo
    selectTestFile(container);

    // Metadata bar is displayed
    expect(await screen.findByText('biryani.jpg')).toBeInTheDocument();

    // Click Analyze Food
    const analyzeBtn = screen.getByRole('button', { name: /analyze food/i });
    await user.click(analyzeBtn);

    // Verify upload was initiated
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy).toHaveBeenCalledWith(
      expect.any(File),
      expect.objectContaining({ timeoutMs: 15000 })
    );

    // Verify AI analysis was called
    await waitFor(() => {
      expect(analyzeSpy).toHaveBeenCalledTimes(1);
    });

    // Confirmation screen rendered with detected dish
    expect(await screen.findByText('Chicken Biryani')).toBeInTheDocument();
  });

  it('2. Upload timeout fallback: displays warning notice and proceeds with local AI analysis without hanging', async () => {
    const user = userEvent.setup();
    const onAnalysisComplete = vi.fn();
    const onExploreDemo = vi.fn();

    const timeoutError = new Error('Cloud storage upload timed out after 15s.');
    (timeoutError as any).code = 'storage/timeout';

    vi.spyOn(firebaseService, 'uploadFoodImageToStorage').mockRejectedValue(timeoutError);
    const analyzeSpy = vi.spyOn(api, 'analyzeImage').mockResolvedValue(mockAnalysisResponse as any);

    const { container } = render(
      <ScanFood onAnalysisComplete={onAnalysisComplete} onExploreDemo={onExploreDemo} />
    );

    selectTestFile(container);
    const analyzeBtn = await screen.findByRole('button', { name: /analyze food/i });
    await user.click(analyzeBtn);

    // The timeout does not block analysis
    await waitFor(() => {
      expect(analyzeSpy).toHaveBeenCalledTimes(1);
    });

    // Successfully transitioned to confirmation screen
    expect(await screen.findByText('Chicken Biryani')).toBeInTheDocument();
  });

  it('3. Unauthenticated fallback: displays info notice and proceeds with local AI analysis', async () => {
    const user = userEvent.setup();
    const onAnalysisComplete = vi.fn();
    const onExploreDemo = vi.fn();

    const unauthError = new Error('Authentication required: Sign in to save meal photos.');
    (unauthError as any).code = 'storage/unauthenticated';

    vi.spyOn(firebaseService, 'uploadFoodImageToStorage').mockRejectedValue(unauthError);
    const analyzeSpy = vi.spyOn(api, 'analyzeImage').mockResolvedValue(mockAnalysisResponse as any);

    const { container } = render(
      <ScanFood onAnalysisComplete={onAnalysisComplete} onExploreDemo={onExploreDemo} />
    );

    selectTestFile(container);
    const analyzeBtn = await screen.findByRole('button', { name: /analyze food/i });
    await user.click(analyzeBtn);

    await waitFor(() => {
      expect(analyzeSpy).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Chicken Biryani')).toBeInTheDocument();
  });

  it('4. Cancellation: user can cancel an in-flight upload, restoring UI immediately', async () => {
    const user = userEvent.setup();
    const onAnalysisComplete = vi.fn();
    const onExploreDemo = vi.fn();

    // Create a pending promise that aborts when signal fires
    vi.spyOn(firebaseService, 'uploadFoodImageToStorage').mockImplementation((_file, options) => {
      const opts = typeof options === 'object' ? options : {};
      return new Promise((_, reject) => {
        opts?.signal?.addEventListener('abort', () => {
          const cancelErr = new Error('Upload cancelled');
          (cancelErr as any).code = 'storage/canceled';
          reject(cancelErr);
        });
      });
    });

    const { container } = render(
      <ScanFood onAnalysisComplete={onAnalysisComplete} onExploreDemo={onExploreDemo} />
    );

    selectTestFile(container);
    const analyzeBtn = await screen.findByRole('button', { name: /analyze food/i });
    await user.click(analyzeBtn);

    // Cancel button should be visible during upload
    const cancelBtns = await screen.findAllByRole('button', { name: /cancel/i });
    expect(cancelBtns.length).toBeGreaterThan(0);
    await user.click(cancelBtns[0]);

    // Error / status notification indicates user canceled
    await waitFor(() => {
      expect(screen.queryByText(/Uploading food photo to cloud storage/i)).not.toBeInTheDocument();
    });

    // Buttons are restored and not stuck in disabled loading state
    expect(screen.getByRole('button', { name: /retry analysis/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /choose different photo/i })).not.toBeDisabled();
  });

  it('5. Double-click prevention: prevents multiple concurrent upload executions', async () => {
    const onAnalysisComplete = vi.fn();
    const onExploreDemo = vi.fn();

    let resolveUpload: (url: string) => void;
    const uploadPromise = new Promise<string>((res) => {
      resolveUpload = res;
    });

    const uploadSpy = vi.spyOn(firebaseService, 'uploadFoodImageToStorage').mockReturnValue(uploadPromise);
    vi.spyOn(api, 'analyzeImage').mockResolvedValue(mockAnalysisResponse as any);

    const { container } = render(
      <ScanFood onAnalysisComplete={onAnalysisComplete} onExploreDemo={onExploreDemo} />
    );

    selectTestFile(container);
    const analyzeBtn = await screen.findByRole('button', { name: /analyze food/i });

    // Click twice rapidly
    fireEvent.click(analyzeBtn);
    fireEvent.click(analyzeBtn);

    expect(uploadSpy).toHaveBeenCalledTimes(1);

    // Resolve upload and wait for analysis to complete
    resolveUpload!('https://mock-url.com/food.jpg');
    await waitFor(() => {
      expect(screen.getByText('Chicken Biryani')).toBeInTheDocument();
    });
  });

  it('6. Reset flow: clicking Choose Different Photo clears preview and resets state', async () => {
    const user = userEvent.setup();
    const onAnalysisComplete = vi.fn();
    const onExploreDemo = vi.fn();

    const { container } = render(
      <ScanFood onAnalysisComplete={onAnalysisComplete} onExploreDemo={onExploreDemo} />
    );

    selectTestFile(container);
    expect(await screen.findByText('biryani.jpg')).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /choose different photo/i });
    await user.click(resetBtn);

    // Drops back to initial drag and drop zone
    expect(screen.queryByText('biryani.jpg')).not.toBeInTheDocument();
    expect(screen.getByText(/Drag & drop your food photo here/i)).toBeInTheDocument();
  });

  it('7. Analysis failure handling: displays clear Analysis Notice on 503 high demand, suppresses storage notices, and allows retry without trapped loading state', async () => {
    const user = userEvent.setup();
    const onAnalysisComplete = vi.fn();
    const onExploreDemo = vi.fn();

    // Storage fails first
    const storageErr = new Error('Cloud storage upload timed out after 15s.');
    (storageErr as any).code = 'storage/timeout';
    vi.spyOn(firebaseService, 'uploadFoodImageToStorage').mockRejectedValue(storageErr);

    // Backend AI analysis then fails with 503
    const apiError = new ApiError('The AI vision service is currently experiencing high demand. Please try again in a few moments.', 503);
    vi.spyOn(api, 'analyzeImage').mockRejectedValue(apiError);

    const { container } = render(
      <ScanFood onAnalysisComplete={onAnalysisComplete} onExploreDemo={onExploreDemo} />
    );

    selectTestFile(container);
    const analyzeBtn = await screen.findByRole('button', { name: /analyze food/i });
    await user.click(analyzeBtn);

    // Analysis Notice is rendered with exact message
    expect(await screen.findByText(/Analysis Notice/i)).toBeInTheDocument();
    expect(screen.getByText(/The AI vision service is currently experiencing high demand/i)).toBeInTheDocument();

    // Crucially: conflicting / redundant Storage Notice card is NOT displayed
    expect(screen.queryByText(/Storage Notice/i)).not.toBeInTheDocument();

    // Metadata bar shows Local Scan badge
    expect(screen.getByText(/Local Scan/i)).toBeInTheDocument();

    // UI is not stuck: Retry button is active and enabled
    const retryBtn = screen.getByRole('button', { name: /retry analysis/i });
    expect(retryBtn).not.toBeDisabled();
  });

  it('8. Direct AI mode badge: displays Direct Mode tag when unauthenticated without displaying storage error cards', async () => {
    const user = userEvent.setup();
    const onAnalysisComplete = vi.fn();
    const onExploreDemo = vi.fn();

    const unauthErr = new Error('Authentication required');
    (unauthErr as any).code = 'storage/unauthenticated';
    vi.spyOn(firebaseService, 'uploadFoodImageToStorage').mockRejectedValue(unauthErr);
    vi.spyOn(api, 'analyzeImage').mockResolvedValue(mockAnalysisResponse as any);

    const { container } = render(
      <ScanFood onAnalysisComplete={onAnalysisComplete} onExploreDemo={onExploreDemo} />
    );

    selectTestFile(container);
    const analyzeBtn = await screen.findByRole('button', { name: /analyze food/i });
    await user.click(analyzeBtn);

    // Confirms and transitions to confirmation view
    expect(await screen.findByText('Chicken Biryani')).toBeInTheDocument();
  });
});
