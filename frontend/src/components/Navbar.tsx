import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Database,
  LayoutDashboard,
  UserCheck,
  Home,
  MoreVertical,
} from 'lucide-react';
import { HealthStatus } from '../types';

export type ActiveTab = 'home' | 'scan' | 'demo' | 'catalog' | 'dashboard' | 'profile';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  health: HealthStatus | null;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { id: 'home', label: 'Overview', icon: Home },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'scan', label: 'Scan Food', icon: Camera },
  { id: 'profile', label: 'Profile & Goals', icon: UserCheck },
  { id: 'catalog', label: 'Indian Foods', icon: Database },
];

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, health }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const isHealthy = health?.status === 'healthy';

  // Close menu on click outside or Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (tab: ActiveTab) => {
    setActiveTab(tab);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <header className="sticky top-0 z-50 bg-dark-bg/90 backdrop-blur-md border-b border-dark-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <button
            type="button"
            className="flex items-center gap-3 cursor-pointer group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-primary/40 rounded-xl p-1 -ml-1 transition"
            onClick={() => setActiveTab('home')}
            aria-label="NutriLens home overview"
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
          </button>

          {/* Right Controls: API Connection Indicator & Three-Dot Menu */}
          <div className="flex items-center gap-3">
            {/* Live API status (visible on sm and larger viewports) */}
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-inner border border-dark-border text-xs"
              title={isHealthy ? 'Backend API operational' : 'Waiting for backend response'}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isHealthy
                    ? 'bg-lime-primary shadow-xs shadow-lime-primary/50 animate-pulse'
                    : 'bg-amber-400'
                }`}
              />
              <span className="text-slate-400 font-medium font-mono text-[11px]">
                {isHealthy ? 'Live API Connected' : 'Connecting to API...'}
              </span>
            </div>

            {/* Three-Dot Menu Button and Dropdown */}
            <div className="relative">
              <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={isOpen}
                aria-haspopup="true"
                aria-controls="nav-dropdown-menu"
                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-lime-primary/40 border ${
                  isOpen
                    ? 'bg-dark-inner text-lime-primary border-lime-primary/40 shadow-sm'
                    : 'bg-dark-card text-slate-300 hover:text-white border-dark-border hover:border-lime-primary/40'
                }`}
              >
                <MoreVertical className="w-5 h-5" />
              </button>

              {/* Dropdown Menu */}
              {isOpen && (
                <div
                  ref={menuRef}
                  id="nav-dropdown-menu"
                  role="menu"
                  aria-label="Navigation options"
                  className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl bg-dark-card border border-dark-border shadow-2xl p-1.5 z-50 overflow-hidden max-h-[calc(100vh-5rem)] overflow-y-auto transition-all duration-150 motion-reduce:transition-none"
                >
                  <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold border-b border-dark-border/40">
                    Navigation
                  </div>

                  <div className="py-1 space-y-0.5">
                    {navItems.map((item) => {
                      const isActive = activeTab === item.id;
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.id}
                          role="menuitem"
                          type="button"
                          onClick={() => handleSelect(item.id)}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-left text-xs sm:text-sm transition-colors min-h-[44px] group ${
                            isActive
                              ? 'bg-lime-dim text-lime-primary font-semibold border border-lime-primary/20'
                              : 'text-slate-300 hover:text-white hover:bg-dark-inner'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon
                              className={`w-4 h-4 shrink-0 transition-colors ${
                                isActive
                                  ? 'text-lime-primary'
                                  : 'text-slate-400 group-hover:text-lime-primary'
                              }`}
                            />
                            <span>{item.label}</span>
                          </div>
                          {isActive && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-lime-primary shrink-0"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Mobile API Status Footer in Dropdown */}
                  <div className="sm:hidden mt-1 pt-2 pb-1 px-3 border-t border-dark-border/40 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                      Backend
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          isHealthy
                            ? 'bg-lime-primary shadow-xs shadow-lime-primary/50 animate-pulse'
                            : 'bg-amber-400'
                        }`}
                      />
                      <span className={isHealthy ? 'text-slate-300' : 'text-amber-400'}>
                        {isHealthy ? 'Live Connected' : 'Connecting...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
