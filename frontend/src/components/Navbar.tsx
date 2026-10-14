import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  History,
  User,
  Home,
  MoreVertical,
} from 'lucide-react';
import { HealthStatus } from '../types';

export type ActiveTab = 'home' | 'scan' | 'history' | 'profile' | 'demo';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  health?: HealthStatus | null;
}

interface NavItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const navItems: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'scan', label: 'Scan Food', icon: Camera },
  { id: 'history', label: 'History', icon: History },
  { id: 'profile', label: 'Profile', icon: User },
];

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    <header className="sticky top-0 z-50 bg-dark-bg/95 backdrop-blur-md border-b border-dark-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <button
            type="button"
            className="flex items-center gap-2.5 cursor-pointer group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-primary/40 rounded-xl p-1 -ml-1 transition"
            onClick={() => setActiveTab('home')}
            aria-label="NutriLens home overview"
          >
            <div className="w-8 h-8 rounded-lg bg-lime-primary text-lime-dark flex items-center justify-center font-bold text-sm shadow-sm transition-transform group-hover:scale-105">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                NutriLens
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links (Clean & Direct) */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main Navigation">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-dark-inner text-lime-primary border border-lime-primary/20'
                      : 'text-slate-300 hover:text-white hover:bg-dark-card'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-lime-primary' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Mobile Menu Button and Dropdown */}
          <div className="relative">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={isOpen}
              aria-haspopup="true"
              aria-controls="nav-dropdown-menu"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-lime-primary/40 border ${
                isOpen
                  ? 'bg-dark-inner text-lime-primary border-lime-primary/40 shadow-sm'
                  : 'bg-dark-card text-slate-300 hover:text-white border-dark-border hover:border-lime-primary/40'
              }`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
              <div
                ref={menuRef}
                id="nav-dropdown-menu"
                role="menu"
                aria-label="Navigation options"
                className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-xl bg-dark-card border border-dark-border shadow-xl p-1 z-50 overflow-hidden"
              >
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
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors min-h-[40px] group ${
                          isActive
                            ? 'bg-dark-inner text-lime-primary font-semibold border border-lime-primary/20'
                            : 'text-slate-300 hover:text-white hover:bg-dark-inner/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
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
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
