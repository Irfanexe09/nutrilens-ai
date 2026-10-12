import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Camera,
  AlertCircle,
  FileImage,
  ArrowRight,
  Loader2,
  Sparkles,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { api, ApiError } from '../services/api';
import { FoodAnalysisResponse, DetectedFoodItem } from '../types';
import { FoodConfirmation } from './FoodConfirmation';
import { uploadFoodImageToStorage } from '../services/firebase';

interface ScanFoodProps {
  onAnalysisComplete: (
    result: FoodAnalysisResponse,
    previewUrl: string,
    file: File,
    confirmedFoods: DetectedFoodItem[]
  ) => void;
  onExploreDemo: () => void;
}

export const ScanFood: React.FC<ScanFoodProps> = ({
  onAnalysisComplete,
  onExploreDemo,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('Analyzing your meal...');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [storageNotice, setStorageNotice] = useState<{
    type: 'info' | 'warning' | 'success';
    message: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploaded, setIsUploaded] = useState(false);

  // References for cancellation and double-click prevention
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSubmittingRef = useRef(false);

  // Analysis result state
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysisResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      // Cleanup object URL on unmount to prevent memory leaks
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);
    setAnalysisResult(null);

    // Validate size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Selected file exceeds the 10MB maximum upload limit.');
      return;
    }

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMessage('Unsupported format. Please upload a JPEG, PNG, or WEBP image.');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !previewUrl) return;
    if (isSubmittingRef.current || isLoading) return;

    isSubmittingRef.current = true;
    setIsLoading(true);
    setErrorMessage(null);
    setStorageNotice(null);
    setUploadProgress(0);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // 1. Upload to Firebase Cloud Storage with bounded timeout and progress tracking
      setLoadingStep('Uploading food photo to cloud storage...');
      try {
        const cloudUrl = await uploadFoodImageToStorage(selectedFile, {
          signal: controller.signal,
          timeoutMs: 15000,
          onProgress: (progress) => {
            setUploadProgress(progress.progressPercent);
            setLoadingStep(`Uploading food photo to cloud storage (${progress.progressPercent}%)...`);
          },
        });
        setPreviewUrl(cloudUrl);
        setIsUploaded(true);
        setStorageNotice({
          type: 'success',
          message: 'Photo securely stored in Firebase Cloud Storage.',
        });
      } catch (storageErr: any) {
        // Safe diagnostic logging: error code and name only, never credentials
        console.warn('[ScanFood] Cloud storage notice:', {
          code: storageErr?.code || 'unknown',
          name: storageErr?.name || 'Error',
        });

        // If the user aborted the operation, stop immediately
        if (controller.signal.aborted || storageErr?.code === 'storage/canceled') {
          setIsLoading(false);
          isSubmittingRef.current = false;
          setUploadProgress(null);
          setLoadingStep('');
          return;
        }

        // Non-blocking fallback: Inform the user while continuing to AI analysis
        setIsUploaded(false);
        if (storageErr?.code === 'storage/unauthenticated') {
          setStorageNotice({
            type: 'info',
            message: 'Cloud backup skipped (sign in to sync photos across devices). Continuing with direct AI analysis.',
          });
        } else if (storageErr?.code === 'storage/timeout') {
          setStorageNotice({
            type: 'warning',
            message: 'Cloud storage upload timed out after 15s. Continuing with direct AI analysis.',
          });
        } else {
          setStorageNotice({
            type: 'warning',
            message: 'Cloud storage unavailable. Continuing with direct AI analysis.',
          });
        }
      }

      // Check if user cancelled while cloud upload was resolving
      if (controller.signal.aborted) {
        setIsLoading(false);
        isSubmittingRef.current = false;
        return;
      }

      // 2. Multimodal Vision AI Evaluation
      setUploadProgress(null);
      setLoadingStep('Multimodal vision evaluating food items and portions...');
      const response = await api.analyzeImage(selectedFile, controller.signal);
      setAnalysisResult(response);
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        setErrorMessage('Meal analysis was canceled.');
      } else if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Food analysis timed out or failed. Please try again in a few moments.');
      }
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
      abortControllerRef.current = null;
      setUploadProgress(null);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    isSubmittingRef.current = false;
    setUploadProgress(null);
    setLoadingStep('');
    setErrorMessage('Meal analysis was canceled by user.');
  };

  const handleReset = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    setStorageNotice(null);
    setUploadProgress(null);
    setIsUploaded(false);
    setAnalysisResult(null);
    setIsLoading(false);
    isSubmittingRef.current = false;
  };

  const handleConfirmedFoods = (confirmedFoods: DetectedFoodItem[]) => {
    if (analysisResult && previewUrl && selectedFile) {
      onAnalysisComplete(analysisResult, previewUrl, selectedFile, confirmedFoods);
    }
  };

  // Helper to load synthetic food samples for rapid testing
  const handleLoadSample = async (sampleName: string, category: string) => {
    setErrorMessage(null);
    setAnalysisResult(null);
    setIsLoading(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 600, 400);
        grad.addColorStop(0, '#161D24');
        grad.addColorStop(1, '#0A0E11');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 600, 400);

        ctx.beginPath();
        ctx.arc(300, 200, 160, 0, Math.PI * 2);
        ctx.fillStyle = '#1D2630';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 20;
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(sampleName, 300, 190);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#B4F038';
        ctx.fillText(`NutriLens Sample • ${category}`, 300, 220);
      }

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `${sampleName.toLowerCase().replace(/\s+/g, '_')}.jpg`, {
            type: 'image/jpeg',
          });
          validateAndSetFile(file);
          setIsLoading(false);
        }
      }, 'image/jpeg');
    } catch {
      setIsLoading(false);
      setErrorMessage('Could not generate sample image.');
    }
  };

  // If analysis result is available, render Food Confirmation flow
  if (analysisResult) {
    const foodsList = analysisResult.analysis?.foods || analysisResult.foods || [];
    const overallConf = analysisResult.analysis?.overall_confidence ?? analysisResult.overall_confidence ?? 0.8;
    const uncertaintiesList = analysisResult.analysis?.uncertainties || analysisResult.uncertainties || [];

    return (
      <FoodConfirmation
        initialFoods={foodsList}
        overallConfidence={overallConf}
        uncertainties={uncertaintiesList}
        imageUrl={previewUrl || undefined}
        onConfirm={handleConfirmedFoods}
        onScanAnother={handleReset}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Title */}
      <div className="text-center space-y-2">
        <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-lime-dim text-lime-primary border border-lime-primary/30">
          Multimodal Vision Pipeline
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Food Image Analysis
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
          Photograph your meal. Multimodal AI identifies dishes, estimates portion volume, and surfaces honest visual uncertainty margins.
        </p>
      </div>

      {/* Upload Box */}
      <div className="bg-dark-card rounded-2xl border border-dark-border p-6 sm:p-8 shadow-xl space-y-6">
        {!previewUrl ? (
          <div>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all ${
                isDragging
                  ? 'border-lime-primary bg-lime-dim/20'
                  : 'border-dark-border hover:border-lime-primary/40 bg-dark-inner/60'
              }`}
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-dark-card border border-dark-border shadow-md flex items-center justify-center text-lime-primary mb-4">
                <Upload className="w-6 h-6" />
              </div>

              <h3 className="text-base font-bold text-white mb-1">
                Upload your meal photograph
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
                Drag & drop your food photo here, or select from device. Supports JPEG, PNG, and WEBP up to 10MB.
              </p>

              {/* Upload & Camera Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-lime-primary text-lime-dark font-extrabold text-sm hover:bg-lime-hover transition-all shadow-lg shadow-lime-primary/10"
                >
                  Browse Files
                </button>

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-dark-inner text-slate-200 font-semibold text-sm border border-dark-border hover:bg-dark-cardHover transition-colors"
                >
                  <Camera className="w-4 h-4 text-lime-primary" />
                  <span>Take Photo</span>
                </button>
              </div>

              {/* Hidden file inputs */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Quick Test Samples */}
            <div className="mt-6 pt-6 border-t border-dark-border">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                Or test with sample Indian dishes:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleLoadSample('Chicken Biryani', 'Rice Dish')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-dark-inner hover:bg-dark-cardHover text-slate-300 hover:text-white border border-dark-border transition-all"
                >
                  Chicken Biryani
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample('Masala Dosa', 'South Indian')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-dark-inner hover:bg-dark-cardHover text-slate-300 hover:text-white border border-dark-border transition-all"
                >
                  Masala Dosa
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample('Roti and Dal', 'Homestyle')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-dark-inner hover:bg-dark-cardHover text-slate-300 hover:text-white border border-dark-border transition-all"
                >
                  Chapati & Dal
                </button>
                <button
                  type="button"
                  onClick={onExploreDemo}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-lime-dim text-lime-primary hover:bg-lime-dim/80 border border-lime-primary/30 inline-flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Explore Biryani Demo</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Preview state */
          <div className="space-y-6">
            <div className="relative rounded-2xl overflow-hidden border border-dark-border bg-dark-inner max-h-[380px] flex items-center justify-center p-2">
              <img
                src={previewUrl}
                alt="Meal Preview"
                className="max-h-[360px] w-auto object-contain mx-auto rounded-xl shadow-md"
              />
            </div>

            {/* Metadata bar */}
            {selectedFile && (
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 bg-dark-inner rounded-xl px-4 py-2.5 border border-dark-border font-mono">
                <div className="flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-lime-primary" />
                  <span className="font-medium text-white">{selectedFile.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  {isUploaded && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-lime-dim text-lime-primary border border-lime-primary/30">
                      Cloud Stored
                    </span>
                  )}
                  <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            )}

            {/* Storage notice (cloud upload info/warning/success) */}
            {storageNotice && (
              <div
                className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-xs animate-fadeIn ${
                  storageNotice.type === 'success'
                    ? 'bg-lime-dim border-lime-primary/30 text-lime-primary'
                    : storageNotice.type === 'warning'
                    ? 'bg-amber-400/10 border-amber-400/30 text-amber-300'
                    : 'bg-dark-inner border-dark-border text-slate-300'
                }`}
              >
                {storageNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-lime-primary" />
                ) : storageNotice.type === 'warning' ? (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                ) : (
                  <Info className="w-4 h-4 shrink-0 mt-0.5 text-lime-primary" />
                )}
                <div className="space-y-0.5 min-w-0">
                  <span className="font-semibold block">
                    {storageNotice.type === 'success'
                      ? 'Cloud Storage Connected'
                      : storageNotice.type === 'warning'
                      ? 'Storage Notice'
                      : 'Storage Notice'}
                  </span>
                  <span className="leading-relaxed">{storageNotice.message}</span>
                </div>
              </div>
            )}

            {/* Loading Indicator with progress & cancel button */}
            {isLoading && (
              <div className="p-4 rounded-xl bg-lime-dim border border-lime-primary/30 space-y-2.5 animate-fadeIn">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Loader2 className="w-5 h-5 text-lime-primary animate-spin shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {loadingStep}
                      </div>
                      <div className="text-[11px] text-lime-primary/90">
                        Multimodal vision AI is identifying visible dishes and calculating grams...
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-2.5 py-1 text-xs font-semibold text-coral-primary hover:text-white bg-dark-inner hover:bg-coral-primary/20 border border-coral-primary/30 rounded-lg transition-colors shrink-0"
                  >
                    Cancel
                  </button>
                </div>

                {uploadProgress !== null && (
                  <div className="space-y-1">
                    <div className="w-full bg-dark-inner h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-lime-primary h-full rounded-full transition-all duration-200"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>Cloud storage upload</span>
                      <span>{uploadProgress}%</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error message */}
            {errorMessage && (
              <div className="flex items-start gap-2.5 p-4 rounded-xl bg-coral-dim border border-coral-primary/30 text-coral-primary text-xs animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold block">Analysis Notice</span>
                  <span className="leading-relaxed">{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={isLoading}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-400 text-sm font-semibold hover:text-white hover:bg-dark-inner transition-colors disabled:opacity-50"
              >
                Choose Different Photo
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                {isLoading && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2.5 rounded-xl text-coral-primary hover:text-white bg-dark-inner hover:bg-coral-primary/20 border border-coral-primary/30 text-sm font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isLoading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-lime-primary text-lime-dark font-extrabold text-sm hover:bg-lime-hover active:scale-[0.99] disabled:opacity-50 transition-all shadow-lg shadow-lime-primary/10"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>{errorMessage ? 'Retry Analysis' : 'Analyze Food'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
