import React, { useState, useRef } from 'react';
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Analysis result state
  const [analysisResult, setAnalysisResult] = useState<FoodAnalysisResponse | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

    setIsLoading(true);
    setErrorMessage(null);
    setLoadingStep('Analyzing your meal...');

    try {
      const response = await api.analyzeImage(selectedFile);
      setAnalysisResult(response);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Food analysis failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    setAnalysisResult(null);
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
        grad.addColorStop(0, '#fef3c7');
        grad.addColorStop(1, '#fed7aa');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 600, 400);

        ctx.beginPath();
        ctx.arc(300, 200, 160, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 15;
        ctx.fill();

        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(sampleName, 300, 190);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#059669';
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
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Food Image Analysis
        </h2>
        <p className="text-sm text-slate-600">
          Upload or take a meal photograph. Multimodal AI will identify foods, approximate portions, and document visual uncertainties.
        </p>
      </div>

      {/* Upload Box */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        {!previewUrl ? (
          <div>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/50'
                  : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
              }`}
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-slate-600 mb-4">
                <Upload className="w-7 h-7 text-emerald-600" />
              </div>

              <h3 className="text-base font-semibold text-slate-900 mb-1">
                Upload your meal photograph
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                Drag and drop your food photo here, or browse files. Supports JPEG, PNG, and WEBP up to 10MB.
              </p>

              {/* Upload & Camera Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 transition-colors shadow-xs"
                >
                  Browse Files
                </button>

                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-700 font-medium text-sm border border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <Camera className="w-4 h-4 text-slate-600" />
                  Take Photo
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
            <div className="mt-6 pt-6 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-3">
                Or test with sample Indian dishes:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleLoadSample('Chicken Biryani', 'Rice Dish')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-transparent transition-all"
                >
                  🥘 Chicken Biryani
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample('Masala Dosa', 'South Indian')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-transparent transition-all"
                >
                  🥞 Masala Dosa
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample('Roti and Dal', 'Homestyle')}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-transparent transition-all"
                >
                  🫓 Chapati & Dal
                </button>
                <button
                  type="button"
                  onClick={onExploreDemo}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 inline-flex items-center gap-1 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Explore Nutrition Demo
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Preview state */
          <div className="space-y-6">
            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900/5 max-h-[360px] flex items-center justify-center">
              <img
                src={previewUrl}
                alt="Meal Preview"
                className="max-h-[360px] w-auto object-contain mx-auto rounded-lg"
              />
            </div>

            {/* Metadata bar */}
            {selectedFile && (
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50 rounded-xl px-4 py-2.5 border border-slate-100">
                <div className="flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-emerald-600" />
                  <span className="font-medium text-slate-800">{selectedFile.name}</span>
                </div>
                <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
              </div>
            )}

            {/* Loading Indicator with Feedback */}
            {isLoading && (
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-emerald-600 animate-spin shrink-0" />
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-emerald-950">
                    {loadingStep}
                  </div>
                  <div className="text-[11px] text-emerald-800">
                    Multimodal vision AI is evaluating visible dishes and portion volume...
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {errorMessage && (
              <div className="flex items-start gap-2.5 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold block">Food analysis failed. Please try again.</span>
                  <span className="text-rose-700">{errorMessage}</span>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={isLoading}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-600 text-sm font-medium hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Choose Different Image
              </button>

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 transition-all shadow-xs"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing your meal...
                  </>
                ) : (
                  <>
                    Analyze Food
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
