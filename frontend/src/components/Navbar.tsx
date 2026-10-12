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
    <header className="sticky top-0 z-50 bg-dark-bg/90 backdrop-blur-md border-b border-dark-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setActiveTab('home')}
          >
            <div className="w-9 h-9 rounded-xl bg-lime-primary text-lime-dark flex items-center justify-center shadow-lg shadow-lime-primary/10 group-hover:scale-105 transition-transform">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">NutriLens</span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-lime-dim text-lime-primary border border-lime-primary/30">
                  AI Vision
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Multimodal Food Intelligence
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={() => setActiveTab('home')}
              className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'home'
                  ? 'bg-dark-card text-white font-semibold border border-dark-border shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-dark-card/50'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-dark-card text-lime-primary font-semibold border border-lime-primary/30 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-dark-card/50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-lime-primary" />
              <span>Dashboard</span>
            </button>
            <button
              onClick={() => setActiveTab('scan')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'scan'
                  ? 'bg-dark-card text-lime-primary font-semibold border border-lime-primary/30 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-dark-card/50'
              }`}
            >
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-lime-primary" />
              <span>Scan Food</span>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'profile'
                  ? 'bg-dark-card text-lime-primary font-semibold border border-lime-primary/30 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-dark-card/50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-lime-primary" />
              <span>Profile & Goals</span>
            </button>
            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                activeTab === 'catalog'
                  ? 'bg-dark-card text-white font-semibold border border-dark-border shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-dark-card/50'
              }`}
            >
              <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden md:inline">Indian Foods</span>
              <span className="md:hidden">DB</span>
            </button>
          </nav>

          {/* Backend Status indicator */}
          <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-dark-border text-xs">
            <div
              className={`w-2 h-2 rounded-full ${
                isHealthy ? 'bg-lime-primary shadow-sm shadow-lime-primary/50 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-slate-400 font-medium font-mono text-[11px]">
              {isHealthy ? 'Live API Connected' : 'Connecting to API...'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
