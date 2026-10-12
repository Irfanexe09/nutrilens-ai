import React from 'react';
import { Camera, Shield, GitBranch, Terminal } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-20 border-t border-dark-border bg-dark-bg py-12 text-dark-muted text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Camera className="w-4 h-4 text-lime-primary" />
              <span>NutriLens Platform</span>
            </div>
            <p className="text-dark-muted max-w-md">
              Portfolio-grade multimodal food analysis & deterministic nutrition intelligence platform.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Shield className="w-3.5 h-3.5 text-lime-primary" />
              Deterministic Calculation Engine
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <GitBranch className="w-3.5 h-3.5 text-slate-500" />
              Decoupled AIProvider Architecture
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              FastAPI + PostgreSQL + Vite React
            </span>
          </div>
        </div>

        <div className="pt-6 border-t border-dark-border/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
          <div>
            © {new Date().getFullYear()} NutriLens. Built as a serious software engineering project.
          </div>
          <div className="font-mono">
            Phase 1 Foundation • Phase 2 Multimodal Vision Pipeline
          </div>
        </div>
      </div>
    </footer>
  );
};
