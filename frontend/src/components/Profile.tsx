import React, { useState, useEffect } from 'react';
import {
  User,
  ShieldAlert,
  Info,
  Dumbbell,
  Scale,
  CheckCircle2,
  LogIn,
} from 'lucide-react';
import { api } from '../services/api';
import {
  UserProfile,
  DailyNutritionTarget,
  Sex,
  ActivityLevel,
  UserGoal,
  User as UserType,
} from '../types';

interface ProfileProps {
  onProfileUpdated?: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ onProfileUpdated }) => {
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [profile, setProfile] = useState<UserProfile>({
    age: 26,
    sex: 'MALE',
    height_cm: 175,
    weight_kg: 70,
    activity_level: 'MODERATELY_ACTIVE',
    goal: 'WEIGHT_LOSS',
  });
  const [targets, setTargets] = useState<DailyNutritionTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      if (api.getToken()) {
        const user = await api.getMe();
        setCurrentUser(user);
        try {
          const profData = await api.getProfile();
          setProfile(profData.profile);
          setTargets(profData.targets);
        } catch {
          // Profile not yet created for this user; calculate preview
          calculateLocalPreview(profile);
        }
      } else {
        calculateLocalPreview(profile);
      }
    } catch {
      calculateLocalPreview(profile);
    }
  };

  const calculateLocalPreview = (p: UserProfile) => {
    // Deterministic Mifflin-St Jeor calculation
    const base = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age;
    const bmr = p.sex === 'MALE' ? base + 5 : base - 161;

    const multMap: Record<ActivityLevel, number> = {
      SEDENTARY: 1.2,
      LIGHTLY_ACTIVE: 1.375,
      MODERATELY_ACTIVE: 1.55,
      VERY_ACTIVE: 1.725,
      EXTRA_ACTIVE: 1.9,
    };
    const tdee = bmr * (multMap[p.activity_level] || 1.2);

    const goalAdj: Record<UserGoal, { cal: number; pro: number }> = {
      WEIGHT_LOSS: { cal: -400, pro: 1.4 },
      MAINTENANCE: { cal: 0, pro: 1.2 },
      WEIGHT_GAIN: { cal: 350, pro: 1.4 },
      MUSCLE_GAIN: { cal: 250, pro: 1.8 },
      GENERAL_HEALTH: { cal: 0, pro: 1.1 },
    };
    const adj = goalAdj[p.goal] || { cal: 0, pro: 1.2 };
    const calTarget = Math.max(500, tdee + adj.cal);
    const proTarget = Number((p.weight_kg * adj.pro).toFixed(1));
    const fatTarget = Number(((calTarget * 0.25) / 9).toFixed(1));
    const carbsTarget = Number(
      Math.max(0, (calTarget - proTarget * 4 - fatTarget * 9) / 4).toFixed(1)
    );
    const fiberTarget = Number(Math.max(25, (calTarget / 1000) * 14).toFixed(1));

    let warning: string | null = null;
    if (p.sex === 'MALE' && calTarget < 1500) {
      warning = `Your calculated target of ${Math.round(
        calTarget
      )} kcal is unusually low. For safety, adult males should generally not consume below 1,500 kcal without clinical supervision. Please consult a qualified healthcare professional.`;
    } else if (p.sex === 'FEMALE' && calTarget < 1200) {
      warning = `Your calculated target of ${Math.round(
        calTarget
      )} kcal is unusually low. For safety, adult females should generally not consume below 1,200 kcal without clinical supervision. Please consult a qualified healthcare professional.`;
    }

    setTargets({
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      calorie_target: Math.round(calTarget),
      protein_target_g: proTarget,
      carbohydrates_target_g: carbsTarget,
      fat_target_g: fatTarget,
      fiber_target_g: fiberTarget,
      safety_warning: warning,
      disclaimer:
        'Estimated daily target for informational and educational purposes only. Not a medical diagnosis or nutritional prescription.',
    });
  };

  const handleFieldChange = (field: keyof UserProfile, value: any) => {
    const updated = { ...profile, [field]: value };
    setProfile(updated);
    calculateLocalPreview(updated);
    setSaveSuccess(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // If not logged in, prompt user to log in or create a demo session
    if (!api.getToken()) {
      setShowAuthModal(true);
      return;
    }

    setLoading(true);
    try {
      const res = await api.updateProfile(profile);
      setProfile(res.profile);
      setTargets(res.targets);
      setSaveSuccess(true);
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      if (authMode === 'register') {
        const res = await api.register(email, password, name || undefined);
        setCurrentUser(res.user);
      } else {
        const res = await api.login(email, password);
        setCurrentUser(res.user);
      }
      setShowAuthModal(false);
      // Now save profile with the new token
      const profRes = await api.updateProfile(profile);
      setProfile(profRes.profile);
      setTargets(profRes.targets);
      setSaveSuccess(true);
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDemoUser = async () => {
    setLoading(true);
    try {
      const demoEmail = `demo_${Date.now()}@nutrilens.ai`;
      const res = await api.register(demoEmail, 'DemoPass123!', 'NutriLens Demo User');
      setCurrentUser(res.user);
      setShowAuthModal(false);
      const profRes = await api.updateProfile(profile);
      setProfile(profRes.profile);
      setTargets(profRes.targets);
      setSaveSuccess(true);
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to launch demo account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Phase 4: Personalization Engine
            </span>
            {currentUser && (
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                Logged in as {currentUser.email}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Personal Profile & Daily Nutrition Targets
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Deterministic energy and macronutrient targets calculated from body metrics and activity.
          </p>
        </div>

        <div>
          {!currentUser ? (
            <button
              onClick={() => setShowAuthModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              Sign In / Sync Data
            </button>
          ) : (
            <button
              onClick={() => {
                api.clearToken();
                setCurrentUser(null);
                setSaveSuccess(false);
              }}
              className="text-xs text-slate-500 hover:text-rose-600 font-medium"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Form on Left, Target Insights on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        {/* Profile Input Form (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-emerald-600" />
            Body Metrics & Goal
          </h2>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Age (years)
                </label>
                <input
                  type="number"
                  min="12"
                  max="120"
                  value={profile.age}
                  onChange={(e) => handleFieldChange('age', parseInt(e.target.value) || 25)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Biological Sex
                </label>
                <select
                  value={profile.sex}
                  onChange={(e) => handleFieldChange('sex', e.target.value as Sex)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  min="80"
                  max="250"
                  value={profile.height_cm}
                  onChange={(e) => handleFieldChange('height_cm', parseFloat(e.target.value) || 170)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="300"
                  value={profile.weight_kg}
                  onChange={(e) => handleFieldChange('weight_kg', parseFloat(e.target.value) || 70)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Activity Level
              </label>
              <select
                value={profile.activity_level}
                onChange={(e) => handleFieldChange('activity_level', e.target.value as ActivityLevel)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
              >
                <option value="SEDENTARY">Sedentary (Little or no structured exercise)</option>
                <option value="LIGHTLY_ACTIVE">Lightly Active (Light exercise 1–3 days/wk)</option>
                <option value="MODERATELY_ACTIVE">Moderately Active (Moderate exercise 3–5 days/wk)</option>
                <option value="VERY_ACTIVE">Very Active (Hard exercise 6–7 days/wk)</option>
                <option value="EXTRA_ACTIVE">Extra Active (Very demanding physical labor/training)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Nutrition Goal
              </label>
              <select
                value={profile.goal}
                onChange={(e) => handleFieldChange('goal', e.target.value as UserGoal)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-medium"
              >
                <option value="WEIGHT_LOSS">Weight Loss (-400 kcal deficit, 1.4g/kg protein)</option>
                <option value="MAINTENANCE">Weight Maintenance (Balanced energy, 1.2g/kg protein)</option>
                <option value="WEIGHT_GAIN">Weight Gain (+350 kcal surplus, 1.4g/kg protein)</option>
                <option value="MUSCLE_GAIN">Muscle Gain (+250 kcal surplus, 1.8g/kg protein)</option>
                <option value="GENERAL_HEALTH">General Health (Balanced maintenance, 1.1g/kg protein)</option>
              </select>
            </div>

            {errorMessage && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                {errorMessage}
              </p>
            )}

            {saveSuccess && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Profile and personalized daily targets updated successfully!</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? 'Saving...' : currentUser ? 'Save & Update Targets' : 'Save Profile (Sign in or Demo)'}
            </button>
          </form>
        </div>

        {/* Target Cards & Formulas (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Target Energy Summary Card */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-md border border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">
                Mifflin-St Jeor Energy Balance
              </span>
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                Deterministic Engine
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-700">
              <div>
                <p className="text-xs text-slate-400">Estimated BMR</p>
                <p className="text-xl font-bold text-white mt-0.5">
                  ~{targets?.bmr ?? '—'} <span className="text-xs font-normal text-slate-400">kcal</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Basal metabolic rate</p>
              </div>

              <div>
                <p className="text-xs text-slate-400">Maintenance (TDEE)</p>
                <p className="text-xl font-bold text-white mt-0.5">
                  ~{targets?.tdee ?? '—'} <span className="text-xs font-normal text-slate-400">kcal</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Energy expenditure</p>
              </div>

              <div className="bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-500/30">
                <p className="text-xs text-emerald-300 font-semibold">Estimated Daily Target</p>
                <p className="text-2xl font-black text-emerald-400 mt-0.5">
                  ~{targets?.calorie_target ?? '—'}{' '}
                  <span className="text-xs font-normal text-emerald-300">kcal</span>
                </p>
                <p className="text-[10px] text-emerald-200 mt-0.5">Goal-adjusted target</p>
              </div>
            </div>
          </div>

          {/* Macro Targets Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
              <Dumbbell className="w-4 h-4 text-emerald-600" />
              Target Macronutrient Distribution
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
                <span className="text-xs text-emerald-800 font-semibold">Protein</span>
                <p className="text-lg font-bold text-emerald-900 mt-1">
                  {targets?.protein_target_g ?? '—'} g
                </p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  {profile.goal === 'MUSCLE_GAIN'
                    ? '1.8 g/kg bodyweight'
                    : profile.goal === 'GENERAL_HEALTH'
                    ? '1.1 g/kg bodyweight'
                    : '1.2–1.4 g/kg bodyweight'}
                </p>
              </div>

              <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-100">
                <span className="text-xs text-amber-800 font-semibold">Carbohydrates</span>
                <p className="text-lg font-bold text-amber-900 mt-1">
                  {targets?.carbohydrates_target_g ?? '—'} g
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5">Primary energy source</p>
              </div>

              <div className="bg-rose-50/70 p-3 rounded-xl border border-rose-100">
                <span className="text-xs text-rose-800 font-semibold">Healthy Fat</span>
                <p className="text-lg font-bold text-rose-900 mt-1">
                  {targets?.fat_target_g ?? '—'} g
                </p>
                <p className="text-[11px] text-rose-700 mt-0.5">25% of target energy</p>
              </div>

              <div className="bg-teal-50/70 p-3 rounded-xl border border-teal-100">
                <span className="text-xs text-teal-800 font-semibold">Dietary Fiber</span>
                <p className="text-lg font-bold text-teal-900 mt-1">
                  {targets?.fiber_target_g ?? '—'} g
                </p>
                <p className="text-[11px] text-teal-700 mt-0.5">≥14g per 1000 kcal</p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span>
                Internal caloric consistency enforced:{' '}
                <strong className="text-slate-700">
                  (Protein × 4) + (Carbs × 4) + (Fat × 9) ≈ Daily Target Calories
                </strong>
              </span>
            </div>
          </div>

          {/* Safety Warning (if triggered) */}
          {targets?.safety_warning && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">Safety Guardrail Notice</h4>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  {targets.safety_warning}
                </p>
              </div>
            </div>
          )}

          {/* Transparent Medical Disclaimer Banner */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-slate-800">
                Information & Educational Target Disclaimer
              </h4>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                {targets?.disclaimer ||
                  'Estimated daily target for informational and educational purposes only. Not a medical diagnosis or nutritional prescription.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">
                {authMode === 'login' ? 'Sign In to NutriLens' : 'Create NutriLens Account'}
              </h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4 mt-4">
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              {authError && (
                <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm transition shadow-sm"
              >
                {loading
                  ? 'Please wait...'
                  : authMode === 'login'
                  ? 'Sign In & Save Profile'
                  : 'Register Account & Save Profile'}
              </button>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="text-emerald-600 hover:underline font-medium"
                >
                  {authMode === 'login'
                    ? "Don't have an account? Register"
                    : 'Already registered? Sign In'}
                </button>

                <button
                  type="button"
                  onClick={handleCreateDemoUser}
                  className="text-slate-600 hover:text-slate-900 font-semibold underline"
                >
                  Quick Demo User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
