import React from 'react';
import { Camera, Sparkles, ShieldCheck, Cpu, ArrowRight, CheckCircle2 } from 'lucide-react';

interface HeroProps {
  onScanClick: () => void;
  onDemoClick: () => void;
  onCatalogClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onScanClick, onDemoClick, onCatalogClick }) => {
  return (
    <div className="space-y-16 py-8 animate-fadeIn">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto px-4 space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-lime-dim border border-lime-primary/30 text-lime-primary text-xs font-bold tracking-wide">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Scientific Nutrition Intelligence • Deterministic Calculations</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.12]">
          See your food. <br />
          <span className="text-lime-primary">
            Understand your nutrition.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal max-w-2xl mx-auto">
          Snap a meal and receive an AI-powered multimodal nutrition estimate with deterministic macro calculations and actionable goal improvements.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={onScanClick}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-lime-primary text-lime-dark font-extrabold text-sm shadow-xl shadow-lime-primary/10 hover:bg-lime-hover active:scale-[0.99] transition-all"
          >
            <Camera className="w-4 h-4" />
            Scan My Food
          </button>
          <button
            onClick={onDemoClick}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-dark-card text-slate-200 font-semibold text-sm border border-dark-border hover:border-lime-primary/40 hover:text-white active:scale-[0.99] transition-all"
          >
            <Sparkles className="w-4 h-4 text-lime-primary" />
            Explore Live Demo
          </button>
        </div>

        {/* Scientific credibility note */}
        <p className="text-xs text-slate-500 pt-2 max-w-xl mx-auto">
          NutriLens never hallucinates calorie metrics. Visual detection is decoupled from our mathematical nutrition engine with transparent uncertainty intervals.
        </p>
      </section>

      {/* Visual System Architecture Diagram Card */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="bg-dark-card rounded-2xl border border-dark-border p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-lime-primary/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 border-b border-dark-border gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-lime-primary" />
                Decoupled 4-Stage Intelligence Pipeline
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                Strict architectural separation protects macro accuracy and user trust.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-lime-primary bg-lime-dim px-3 py-1 rounded-full border border-lime-primary/20 self-start md:self-auto">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Zero Hallucinated Calories
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Step 1 */}
            <div className="p-4 rounded-xl bg-dark-inner border border-dark-border space-y-2 hover:border-lime-primary/30 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-lime-dim text-lime-primary font-mono font-bold text-xs flex items-center justify-center border border-lime-primary/20">
                01
              </div>
              <h3 className="text-sm font-bold text-white">Food Recognition</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Multimodal vision provider identifies dishes and ingredients without inventing nutrition.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-4 rounded-xl bg-dark-inner border border-dark-border space-y-2 hover:border-lime-primary/30 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 font-mono font-bold text-xs flex items-center justify-center border border-sky-500/20">
                02
              </div>
              <h3 className="text-sm font-bold text-white">Portion Estimation</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Estimates serving sizes with transparent volume-to-gram density calibration.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-4 rounded-xl bg-dark-inner border border-dark-border space-y-2 hover:border-lime-primary/30 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 font-mono font-bold text-xs flex items-center justify-center border border-amber-500/20">
                03
              </div>
              <h3 className="text-sm font-bold text-white">Deterministic Engine</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Computes calories and macros from verified biochemical records with honest variance margins.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-4 rounded-xl bg-dark-inner border border-dark-border space-y-2 hover:border-lime-primary/30 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-coral-dim text-coral-primary font-mono font-bold text-xs flex items-center justify-center border border-coral-primary/20">
                04
              </div>
              <h3 className="text-sm font-bold text-white">Goal Optimizer</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Generates practical meal adjustments for weight loss, hypertrophy, or glycemic balance.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Regional Specialization Callout */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="rounded-2xl bg-gradient-to-r from-dark-card to-dark-elevated border border-dark-border p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 max-w-xl">
            <span className="text-[11px] font-bold uppercase tracking-widest text-lime-primary">
              Regional Domain Specialization
            </span>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Specialized for Complex Indian Dishes
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              From layered Biryani and fermented Dosas to homestyle Dal Tadka and Roti, NutriLens accurately models cooking oil variations, ghee densities, and complex multi-item thalis.
            </p>
          </div>
          <button
            onClick={onCatalogClick}
            className="whitespace-nowrap inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-lime-primary hover:bg-lime-hover text-lime-dark font-bold text-xs sm:text-sm transition-all shadow-lg shadow-lime-primary/10"
          >
            <span>Explore 26+ Verified Dishes</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </div>
  );
};
