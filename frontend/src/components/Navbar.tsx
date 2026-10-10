import React from 'react';
import { Camera, Database, LayoutDashboard, UserCheck } from 'lucide-react';
import { HealthStatus } from '../types';

export type ActiveTab = 'home' | 'scan' | 'demo' | 'catalog' | 'dashboard' | 'profile';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  health: HealthStatus | null;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, health }) => {
  const isHealthy = health?.status === 'healthy';

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setActiveTab('home')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-200 group-hover:scale-105 transition-transform">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">NutriLens</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Phase 6
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                See your food. Understand your nutrition.
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={() => setActiveTab('home')}
              className={`px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'home'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
              <span>Dashboard & Analytics</span>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
              <span>Profile & Goals</span>
            </button>
            <button
              onClick={() => setActiveTab('scan')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'scan'
                  ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
              <span>Scan Food</span>
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                activeTab === 'catalog'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">Indian Food DB</span>
              <span className="md:hidden">DB</span>
            </button>
          </nav>

          {/* Backend Status indicator */}
          <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-slate-200 text-xs">
            <div
              className={`w-2 h-2 rounded-full ${
                isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="text-slate-600 font-medium">
              {isHealthy ? 'API & Personalization Ready' : 'Connecting to API...'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
