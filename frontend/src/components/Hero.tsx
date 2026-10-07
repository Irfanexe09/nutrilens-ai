import React from 'react';
import { Camera, Sparkles, ShieldCheck, Cpu, ArrowRight } from 'lucide-react';

interface HeroProps {
  onScanClick: () => void;
  onDemoClick: () => void;
  onCatalogClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onScanClick, onDemoClick, onCatalogClick }) => {
  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto px-4 space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Scientific Nutrition Intelligence • Deterministic Calculations</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
          See your food. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">
            Understand your nutrition.
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
          Snap a meal and get an AI-powered nutrition estimate with practical ways to improve it.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={onScanClick}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 text-white font-semibold shadow-sm hover:bg-emerald-700 active:scale-[0.99] transition-all"
          >
            <Camera className="w-5 h-5" />
            Scan My Food
          </button>
          <button
            onClick={onDemoClick}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-slate-700 font-semibold border border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.99] transition-all"
          >
            <Sparkles className="w-5 h-5 text-emerald-600" />
            Explore Demo
          </button>
        </div>

        {/* Scientific credibility note */}
        <p className="text-xs text-slate-500 pt-2">
          NutriLens does not invent calorie numbers. Calculations are driven by an isolated, deterministic nutrition engine with transparent uncertainty intervals.
        </p>
      </section>

      {/* Visual System Architecture Diagram Card */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 border-b border-slate-100 gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-600" />
                Decoupled 4-Stage Intelligence Pipeline
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Clean architectural separation prevents AI hallucination of macronutrient values.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-md self-start md:self-auto border border-emerald-100">
              Zero Hallucinated Calories
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Step 1 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                01
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Food Identification</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Multimodal vision provider classifies food items and candidates without inventing calories.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 font-bold text-xs flex items-center justify-center">
                02
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Portion Estimation</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Detects serving sizes and empowers user confirmation with transparent density factors.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                03
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Deterministic Engine</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Calculates macros mathematically from verified nutrition records with honest variance margins.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center">
                04
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Goal-Based Optimizer</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Generates personalized meal adjustments for weight loss, muscle gain, or metabolic balance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Indian Food Intelligence Callout */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
          <div className="space-y-2 max-w-xl">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
              Regional Domain Specialization
            </span>
            <h2 className="text-2xl font-bold tracking-tight">
              Specialized for Complex Indian Meals
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              From layered Biryani and fermented Dosas to homestyle Dal Tadka and Roti, NutriLens is built to handle the complex cooking methods, ghee variations, and macro profiles of Indian cuisine.
            </p>
          </div>
          <button
            onClick={onCatalogClick}
            className="whitespace-nowrap inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm transition-colors"
          >
            Explore 27+ Seeded Dishes
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
};
