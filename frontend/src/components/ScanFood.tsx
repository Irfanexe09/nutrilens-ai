import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Camera,
  AlertCircle,
  FileImage,
  ArrowRight,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { api, ApiError } from '../services/api';
import { FoodAnalysisResponse, DetectedFoodItem } from '../types';
import { FoodConfirmation } from './FoodConfirmation';

interface ScanFoodProps {
  onAnalysisComplete: (
    result: FoodAnalysisResponse,
    previewUrl: string,
    file: File,
    confirmedFoods: DetectedFoodItem[]
  ) => void;
  onExploreDemo: () => void;
  onSignInClick?: () => void;
}

export type ScanPipelineStage =
  | 'idle'
  | 'validating'
  | 'analyzing'
  | 'results';

export const ScanFood: React.FC<ScanFoodProps> = ({
  onAnalysisComplete,
  onExploreDemo,
  onSignInClick,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<ScanPipelineStage>('idle');
  const [loadingStep, setLoadingStep] = useState<string>('Analyzing your meal...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // References for cancellation and double-click prevention
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSubmittingRef = useRef(false);

  // Analysis result state
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysisResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const isLoading = pipelineStage === 'validating' || pipelineStage === 'analyzing';

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
  }, [previewUrl]);

  const validateAndSetFile = (file: File) => {
    setErrorMessage(null);
    setAnalysisResult(null);

    // Validate size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage('Selected file exceeds the 10MB maximum upload limit.');
      setPipelineStage('idle');
      return;
    }

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMessage('Unsupported format. Please upload a JPEG, PNG, or WEBP image.');
      setPipelineStage('idle');
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setPipelineStage('idle');
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

    // Authentication Guard: Prompt user to sign in or register before proceeding
    const token = api.getToken();
    if (!token) {
      setErrorMessage('Please sign in or register to analyze your meal photos.');
      setPipelineStage('idle');
      return;
    }

    isSubmittingRef.current = true;
    setErrorMessage(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Direct AI Vision Analysis (bypassing Firebase Cloud Storage)
      setPipelineStage('analyzing');
      setLoadingStep('Direct AI vision evaluating food items and estimating portion sizes...');

      const response = await api.analyzeImage(selectedFile, controller.signal);
      setAnalysisResult(response);
      setPipelineStage('results');
    } catch (err: unknown) {

      setPipelineStage('idle');

      if (controller.signal.aborted) {
        setErrorMessage('Meal analysis was canceled by user.');
      } else if (err instanceof ApiError) {
        if (err.status === 401) {
          setErrorMessage('Your session has expired or authentication is required. Please sign in to analyze your meal.');
        } else if (err.status === 429) {
          const detail = (err.message || '').toLowerCase();
          if (detail.includes('daily') || detail.includes('tomorrow') || detail.includes('quota')) {
            setErrorMessage(err.message || 'Daily AI vision quota exhausted. Free-tier quota has been reached for today. Please try again tomorrow.');
          } else {
            setErrorMessage(err.message || 'The AI vision service is receiving requests too quickly. Please wait a moment and try again.');
          }
        } else if (err.status === 503) {
          const detail = (err.message || '').toLowerCase();
          if (detail.includes('config') || detail.includes('deprecated') || detail.includes('unavailable or deprecated') || detail.includes('key')) {
            setErrorMessage(err.message || 'AI vision service is temporarily unavailable due to a provider configuration issue.');
          } else {
            setErrorMessage(err.message || 'The AI vision service is currently experiencing high demand. Please try again in a few moments.');
          }
        } else if (err.status === 504) {
          setErrorMessage('Food analysis timed out. The vision model took too long to respond. Please try again in a few moments.');
        } else if (err.status === 413) {
          setErrorMessage('Image size exceeds maximum allowable limit (10MB).');
        } else if (err.status === 415) {
          setErrorMessage('Unsupported image format. Allowed formats: JPEG, PNG, WEBP.');
        } else {
          setErrorMessage(err.message || 'Food analysis failed. Please try again in a few moments.');
        }
      } else {
        setErrorMessage('Food analysis timed out or failed. Please try again in a few moments.');
      }
    } finally {
      isSubmittingRef.current = false;
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setPipelineStage('idle');
    isSubmittingRef.current = false;
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
    setAnalysisResult(null);
    setPipelineStage('idle');
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
    setPipelineStage('validating');

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
          setPipelineStage('idle');
        }
      }, 'image/jpeg');
    } catch {
      setPipelineStage('idle');
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
          Photograph your meal. Multimodal AI directly identifies dishes, estimates portion volume, and surfaces honest visual uncertainty margins.
        </p>
      </div>

      {/* Upload Box */}
      <div className="bg-dark-card rounded-2xl border border-dark-border p-6 sm:p-8 shadow-xl space-y-6">
        {/* Error / Notice message */}
        {errorMessage && (
          <div className="flex items-start justify-between gap-3 p-4 rounded-xl bg-coral-dim border border-coral-primary/30 text-coral-primary text-xs animate-fadeIn">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">
                  {errorMessage.includes('sign in') || errorMessage.includes('register')
                    ? 'Authentication Required'
                    : errorMessage.toLowerCase().includes('quota')
                    ? 'Daily Quota Notice'
                    : errorMessage.toLowerCase().includes('rate') || errorMessage.toLowerCase().includes('quickly')
                    ? 'Rate Limit Notice'
                    : 'Analysis Notice'}
                </span>
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            </div>
            {(errorMessage.includes('sign in') || errorMessage.includes('register')) && onSignInClick && (
              <button
                type="button"
                onClick={onSignInClick}
                className="px-3 py-1.5 rounded-lg bg-coral-primary text-white font-bold hover:bg-coral-primary/90 transition-colors shrink-0"
              >
                Sign In / Register
              </button>
            )}
          </div>
        )}

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
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-dark-card text-lime-primary border border-lime-primary/30">
                    Direct AI Vision
                  </span>
                  <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            )}

            {/* Loading Indicator with cancel button & 3-stage breadcrumb */}
            {isLoading && (
              <div className="p-4 rounded-xl bg-lime-dim border border-lime-primary/30 space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Loader2 className="w-5 h-5 text-lime-primary animate-spin shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate">
                        {loadingStep}
                      </div>
                      <div className="text-[11px] text-lime-primary/90">
                        {pipelineStage === 'validating' && 'Verifying food image resolution and MIME format...'}
                        {pipelineStage === 'analyzing' && 'Direct multimodal AI is evaluating food items and estimating portion volume...'}
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

                {/* 3-Stage Pipeline Stepper */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-lime-primary/20 text-[10px] font-mono">
                  <div className="flex items-center gap-1.5 text-lime-primary font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-primary" />
                    <span>1. Validating Image</span>
                  </div>

                  <div className={`flex items-center gap-1.5 ${pipelineStage === 'analyzing' ? 'text-lime-primary font-bold' : 'text-slate-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${pipelineStage === 'analyzing' ? 'bg-lime-primary animate-pulse' : 'bg-slate-500'}`} />
                    <span>2. Direct AI Vision Analysis</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    <span>3. Nutrition Breakdown</span>
                  </div>
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
