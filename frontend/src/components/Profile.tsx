import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  ShieldAlert,
  Info,
  CheckCircle2,
  LogIn,
  AlertCircle,
  Loader2,
  Sparkles,
  Flame,
  X,
  KeyRound,
  Link2,
  ArrowLeft,
  Mail,
  Lock,
} from 'lucide-react';
import { api, ApiError } from '../services/api';
import {
  UserProfile,
  DailyNutritionTarget,
  Sex,
  ActivityLevel,
  UserGoal,
  User as UserType,
} from '../types';
import {
  signInWithGoogle,
  signInWithFirebaseEmail,
  registerWithFirebaseEmail,
  logOutFirebase,
} from '../services/firebase';

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

  // Controlled raw string states for reliable editing without keystroke resetting
  const [ageStr, setAgeStr] = useState<string>('26');
  const [heightStr, setHeightStr] = useState<string>('175');
  const [weightStr, setWeightStr] = useState<string>('70');
  const [sex, setSex] = useState<Sex>('MALE');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('MODERATELY_ACTIVE');
  const [goal, setGoal] = useState<UserGoal>('WEIGHT_LOSS');

  // Track if user is actively modifying fields so background fetch doesn't clobber edits
  const isDirtyRef = useRef(false);

  // Field validation errors
  const [fieldErrors, setFieldErrors] = useState<{
    age?: string;
    height_cm?: string;
    weight_kg?: string;
  }>({});

  // Auth Modal State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<
    'login' | 'register' | 'forgot-password' | 'reset-password' | 'link-account'
  >('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Password Recovery & Linking State (in-memory only)
  const [pendingFirebaseIdToken, setPendingFirebaseIdToken] = useState<string | null>(null);
  const [linkingEmail, setLinkingEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  useEffect(() => {
    loadUserData();

    // Check URL parameters for password reset token
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('reset_token');
      if (token) {
        setResetToken(token);
        setAuthMode('reset-password');
        setShowAuthModal(true);
        // Clean query parameter from browser address bar without reloading
        const url = new URL(window.location.href);
        url.searchParams.delete('reset_token');
        const cleanPath = url.pathname + (url.search ? url.search : '');
        window.history.replaceState({}, document.title, cleanPath);
      }
    } catch {
      // In case window or URL is not available in mock environments
    }
  }, []);

  const loadUserData = async () => {
    try {
      if (api.getToken()) {
        const user = await api.getMe();
        setCurrentUser(user);
        try {
          const profData = await api.getProfile();
          // Only sync from server if user hasn't started modifying fields locally
          if (!isDirtyRef.current) {
            setProfile(profData.profile);
            setAgeStr(String(profData.profile.age));
            setHeightStr(String(profData.profile.height_cm));
            setWeightStr(String(profData.profile.weight_kg));
            setSex(profData.profile.sex);
            setActivityLevel(profData.profile.activity_level);
            setGoal(profData.profile.goal);
            setTargets(profData.targets);
          }
        } catch {
          // Profile not yet created for this user; calculate preview
          if (!isDirtyRef.current) {
            calculateLocalPreview({
              age: 26,
              sex: 'MALE',
              height_cm: 175,
              weight_kg: 70,
              activity_level: 'MODERATELY_ACTIVE',
              goal: 'WEIGHT_LOSS',
            });
          }
        }
      } else {
        if (!isDirtyRef.current) {
          calculateLocalPreview({
            age: 26,
            sex: 'MALE',
            height_cm: 175,
            weight_kg: 70,
            activity_level: 'MODERATELY_ACTIVE',
            goal: 'WEIGHT_LOSS',
          });
        }
      }
    } catch {
      if (!isDirtyRef.current) {
        calculateLocalPreview({
          age: 26,
          sex: 'MALE',
          height_cm: 175,
          weight_kg: 70,
          activity_level: 'MODERATELY_ACTIVE',
          goal: 'WEIGHT_LOSS',
        });
      }
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

  const validateNumericValues = (a: string, h: string, w: string) => {
    const errors: { age?: string; height_cm?: string; weight_kg?: string } = {};

    if (!a.trim()) {
      errors.age = 'Age is required (10–120 years).';
    } else {
      const parsedAge = Number(a);
      if (isNaN(parsedAge) || !Number.isInteger(parsedAge) || parsedAge < 10 || parsedAge > 120) {
        errors.age = 'Age must be a whole number between 10 and 120.';
      }
    }

    if (!h.trim()) {
      errors.height_cm = 'Height is required (50–280 cm).';
    } else {
      const parsedHeight = Number(h);
      if (isNaN(parsedHeight) || parsedHeight < 50 || parsedHeight > 280) {
        errors.height_cm = 'Height must be between 50 and 280 cm.';
      }
    }

    if (!w.trim()) {
      errors.weight_kg = 'Weight is required (20–400 kg).';
    } else {
      const parsedWeight = Number(w);
      if (isNaN(parsedWeight) || parsedWeight < 20 || parsedWeight > 400) {
        errors.weight_kg = 'Weight must be between 20 and 400 kg.';
      }
    }

    return errors;
  };

  const handleAgeChange = (val: string) => {
    isDirtyRef.current = true;
    setAgeStr(val);
    setSaveSuccess(false);

    // Validate and update preview if inputs are valid
    const parsedAge = Number(val);
    const parsedHeight = Number(heightStr);
    const parsedWeight = Number(weightStr);

    if (
      !isNaN(parsedAge) &&
      Number.isInteger(parsedAge) &&
      parsedAge >= 10 &&
      parsedAge <= 120 &&
      !isNaN(parsedHeight) &&
      parsedHeight >= 50 &&
      !isNaN(parsedWeight) &&
      parsedWeight >= 20
    ) {
      setFieldErrors((prev) => ({ ...prev, age: undefined }));
      calculateLocalPreview({
        age: parsedAge,
        sex,
        height_cm: parsedHeight,
        weight_kg: parsedWeight,
        activity_level: activityLevel,
        goal,
      });
    } else if (val.trim() && (isNaN(parsedAge) || parsedAge < 10 || parsedAge > 120)) {
      setFieldErrors((prev) => ({
        ...prev,
        age: 'Age must be a whole number between 10 and 120.',
      }));
    } else {
      setFieldErrors((prev) => ({ ...prev, age: undefined }));
    }
  };

  const handleHeightChange = (val: string) => {
    isDirtyRef.current = true;
    setHeightStr(val);
    setSaveSuccess(false);

    const parsedAge = Number(ageStr);
    const parsedHeight = Number(val);
    const parsedWeight = Number(weightStr);

    if (
      !isNaN(parsedHeight) &&
      parsedHeight >= 50 &&
      parsedHeight <= 280 &&
      !isNaN(parsedAge) &&
      parsedAge >= 10 &&
      !isNaN(parsedWeight) &&
      parsedWeight >= 20
    ) {
      setFieldErrors((prev) => ({ ...prev, height_cm: undefined }));
      calculateLocalPreview({
        age: parsedAge,
        sex,
        height_cm: parsedHeight,
        weight_kg: parsedWeight,
        activity_level: activityLevel,
        goal,
      });
    } else if (val.trim() && (isNaN(parsedHeight) || parsedHeight < 50 || parsedHeight > 280)) {
      setFieldErrors((prev) => ({
        ...prev,
        height_cm: 'Height must be between 50 and 280 cm.',
      }));
    } else {
      setFieldErrors((prev) => ({ ...prev, height_cm: undefined }));
    }
  };

  const handleWeightChange = (val: string) => {
    isDirtyRef.current = true;
    setWeightStr(val);
    setSaveSuccess(false);

    const parsedAge = Number(ageStr);
    const parsedHeight = Number(heightStr);
    const parsedWeight = Number(val);

    if (
      !isNaN(parsedWeight) &&
      parsedWeight >= 20 &&
      parsedWeight <= 400 &&
      !isNaN(parsedAge) &&
      parsedAge >= 10 &&
      !isNaN(parsedHeight) &&
      parsedHeight >= 50
    ) {
      setFieldErrors((prev) => ({ ...prev, weight_kg: undefined }));
      calculateLocalPreview({
        age: parsedAge,
        sex,
        height_cm: parsedHeight,
        weight_kg: parsedWeight,
        activity_level: activityLevel,
        goal,
      });
    } else if (val.trim() && (isNaN(parsedWeight) || parsedWeight < 20 || parsedWeight > 400)) {
      setFieldErrors((prev) => ({
        ...prev,
        weight_kg: 'Weight must be between 20 and 400 kg.',
      }));
    } else {
      setFieldErrors((prev) => ({ ...prev, weight_kg: undefined }));
    }
  };

  const handleSexChange = (newSex: Sex) => {
    isDirtyRef.current = true;
    setSex(newSex);
    setSaveSuccess(false);
    const parsedAge = Number(ageStr);
    const parsedHeight = Number(heightStr);
    const parsedWeight = Number(weightStr);
    if (!isNaN(parsedAge) && !isNaN(parsedHeight) && !isNaN(parsedWeight)) {
      calculateLocalPreview({
        age: parsedAge,
        sex: newSex,
        height_cm: parsedHeight,
        weight_kg: parsedWeight,
        activity_level: activityLevel,
        goal,
      });
    }
  };

  const handleActivityChange = (newAct: ActivityLevel) => {
    isDirtyRef.current = true;
    setActivityLevel(newAct);
    setSaveSuccess(false);
    const parsedAge = Number(ageStr);
    const parsedHeight = Number(heightStr);
    const parsedWeight = Number(weightStr);
    if (!isNaN(parsedAge) && !isNaN(parsedHeight) && !isNaN(parsedWeight)) {
      calculateLocalPreview({
        age: parsedAge,
        sex,
        height_cm: parsedHeight,
        weight_kg: parsedWeight,
        activity_level: newAct,
        goal,
      });
    }
  };

  const handleGoalChange = (newGoal: UserGoal) => {
    isDirtyRef.current = true;
    setGoal(newGoal);
    setSaveSuccess(false);
    const parsedAge = Number(ageStr);
    const parsedHeight = Number(heightStr);
    const parsedWeight = Number(weightStr);
    if (!isNaN(parsedAge) && !isNaN(parsedHeight) && !isNaN(parsedWeight)) {
      calculateLocalPreview({
        age: parsedAge,
        sex,
        height_cm: parsedHeight,
        weight_kg: parsedWeight,
        activity_level: activityLevel,
        goal: newGoal,
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validate inputs
    const errors = validateNumericValues(ageStr, heightStr, weightStr);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage('Please correct the highlighted biometric inputs before saving.');
      return;
    }

    // If not logged in, prompt user to log in or create a demo session
    if (!api.getToken()) {
      setShowAuthModal(true);
      return;
    }

    const payload: UserProfile = {
      ...profile,
      age: parseInt(ageStr, 10),
      height_cm: parseFloat(heightStr),
      weight_kg: parseFloat(weightStr),
      sex,
      activity_level: activityLevel,
      goal,
    };

    setLoading(true);
    try {
      const res = await api.updateProfile(payload);
      setProfile(res.profile);
      setAgeStr(String(res.profile.age));
      setHeightStr(String(res.profile.height_cm));
      setWeightStr(String(res.profile.weight_kg));
      setSex(res.profile.sex);
      setActivityLevel(res.profile.activity_level);
      setGoal(res.profile.goal);
      setTargets(res.targets);
      setSaveSuccess(true);
      isDirtyRef.current = false;
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      // Preserve user-entered values in state while displaying error
      setErrorMessage(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);

    const errors = validateNumericValues(ageStr, heightStr, weightStr);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setAuthError('Please correct biometric inputs first.');
      setLoading(false);
      return;
    }

    const payload: UserProfile = {
      ...profile,
      age: parseInt(ageStr, 10),
      height_cm: parseFloat(heightStr),
      weight_kg: parseFloat(weightStr),
      sex,
      activity_level: activityLevel,
      goal,
    };

    try {
      if (authMode === 'register') {
        try {
          await registerWithFirebaseEmail(email, password);
        } catch (fbErr) {
          console.warn('Firebase auth registration notice:', fbErr);
        }
        const res = await api.register(email, password, name || undefined);
        setCurrentUser(res.user);
      } else {
        try {
          await signInWithFirebaseEmail(email, password);
        } catch (fbErr) {
          console.warn('Firebase auth sign-in notice:', fbErr);
        }
        const res = await api.login(email, password);
        setCurrentUser(res.user);
      }
      setShowAuthModal(false);

      // Save profile with newly authenticated token
      const profRes = await api.updateProfile(payload);
      setProfile(profRes.profile);
      setAgeStr(String(profRes.profile.age));
      setHeightStr(String(profRes.profile.height_cm));
      setWeightStr(String(profRes.profile.weight_kg));
      setSex(profRes.profile.sex);
      setActivityLevel(profRes.profile.activity_level);
      setGoal(profRes.profile.goal);
      setTargets(profRes.targets);
      setSaveSuccess(true);
      isDirtyRef.current = false;
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setLoading(true);

    const errors = validateNumericValues(ageStr, heightStr, weightStr);
    const hasValidMetrics = Object.keys(errors).length === 0;

    const payload: UserProfile = {
      ...profile,
      age: parseInt(ageStr, 10),
      height_cm: parseFloat(heightStr),
      weight_kg: parseFloat(weightStr),
      sex,
      activity_level: activityLevel,
      goal,
    };

    try {
      const fbUser = await signInWithGoogle();

      // Obtain the Firebase ID token for server-side verification.
      // The backend verifies this token cryptographically via Firebase Admin SDK —
      // identity is never derived from a client-supplied UID or synthetic password.
      const idToken = await fbUser.getIdToken(true);

      try {
        // Authenticate via the secure server-side Firebase endpoint
        const res = await api.firebaseAuth(idToken);
        setCurrentUser(res.user);
        setShowAuthModal(false);

        if (hasValidMetrics) {
          const profRes = await api.updateProfile(payload);
          setProfile(profRes.profile);
          setTargets(profRes.targets);
          setSaveSuccess(true);
          isDirtyRef.current = false;
          if (onProfileUpdated) onProfileUpdated();
        }
      } catch (err: any) {
        if (
          err instanceof ApiError &&
          err.status === 409 &&
          err.data?.detail?.error_code === 'ACCOUNT_LINKING_REQUIRED'
        ) {
          // Account linking required: existing password account exists with this email.
          // Store token strictly in memory for the linking step.
          setPendingFirebaseIdToken(idToken);
          setLinkingEmail(err.data.detail.email || fbUser.email || '');
          setLinkPassword('');
          setAuthMode('link-account');
          setAuthError(null);
          return;
        }
        throw err;
      }
    } catch (err: any) {
      setAuthError(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndLinkGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingFirebaseIdToken) {
      setAuthError('Google sign-in session expired. Please sign in with Google again.');
      setAuthMode('login');
      return;
    }
    setAuthError(null);
    setLoading(true);

    const errors = validateNumericValues(ageStr, heightStr, weightStr);
    const hasValidMetrics = Object.keys(errors).length === 0;

    const payload: UserProfile = {
      ...profile,
      age: parseInt(ageStr, 10),
      height_cm: parseFloat(heightStr),
      weight_kg: parseFloat(weightStr),
      sex,
      activity_level: activityLevel,
      goal,
    };

    try {
      // 1. Authenticate with local email & password to establish JWT
      await api.login(linkingEmail, linkPassword);
      // 2. Securely link the verified Firebase ID token to the authenticated account
      const linkedUser = await api.linkFirebase(pendingFirebaseIdToken);
      setCurrentUser(linkedUser);
      // Clear sensitive temporary values from memory
      setPendingFirebaseIdToken(null);
      setLinkPassword('');
      setShowAuthModal(false);

      if (hasValidMetrics) {
        const profRes = await api.updateProfile(payload);
        setProfile(profRes.profile);
        setTargets(profRes.targets);
        setSaveSuccess(true);
        isDirtyRef.current = false;
        if (onProfileUpdated) onProfileUpdated();
      }
    } catch (err: any) {
      setAuthError(err.message || 'Failed to verify password and link account.');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkCurrentAccountWithGoogle = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const fbUser = await signInWithGoogle();
      const idToken = await fbUser.getIdToken(true);
      const linkedUser = await api.linkFirebase(idToken);
      setCurrentUser(linkedUser);
      setSaveSuccess(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to link Google account.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      const res = await api.forgotPassword(email);
      setForgotSubmitted(true);
      setForgotMessage(res.message);
    } catch (err: any) {
      setAuthError(err.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (newPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.resetPassword(resetToken, newPassword);
      setResetSuccess(true);
      setResetMessage(res.message);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Failed to reset password. The link may have expired or is invalid.');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
    setAuthMode('login');
    setPendingFirebaseIdToken(null);
    setLinkPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotSubmitted(false);
    setResetSuccess(false);
    setAuthError(null);
  };

  const handleSignOut = async () => {
    try {
      await logOutFirebase();
    } catch (err) {
      console.warn('Firebase logout notice:', err);
    }
    api.clearToken();
    setCurrentUser(null);
    setSaveSuccess(false);
  };

  const handleCreateDemoUser = async () => {
    setLoading(true);
    setErrorMessage(null);

    const errors = validateNumericValues(ageStr, heightStr, weightStr);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setErrorMessage('Please correct biometric inputs first.');
      setLoading(false);
      return;
    }

    const payload: UserProfile = {
      ...profile,
      age: parseInt(ageStr, 10),
      height_cm: parseFloat(heightStr),
      weight_kg: parseFloat(weightStr),
      sex,
      activity_level: activityLevel,
      goal,
    };

    try {
      const demoEmail = `demo_${Date.now()}@nutrilens.ai`;
      const res = await api.register(demoEmail, 'DemoPass123!', 'NutriLens Demo User');
      setCurrentUser(res.user);
      setShowAuthModal(false);

      const profRes = await api.updateProfile(payload);
      setProfile(profRes.profile);
      setAgeStr(String(profRes.profile.age));
      setHeightStr(String(profRes.profile.height_cm));
      setWeightStr(String(profRes.profile.weight_kg));
      setSex(profRes.profile.sex);
      setActivityLevel(profRes.profile.activity_level);
      setGoal(profRes.profile.goal);
      setTargets(profRes.targets);
      setSaveSuccess(true);
      isDirtyRef.current = false;
      if (onProfileUpdated) onProfileUpdated();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to launch demo account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-dark-border gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-lime-dim text-lime-primary border border-lime-primary/30">
              Personalization Engine
            </span>
            {currentUser && (
              <>
                <span className="text-[11px] bg-dark-card text-slate-300 px-2.5 py-0.5 rounded-full border border-dark-border font-mono">
                  {currentUser.email}
                </span>
                {currentUser.firebase_uid ? (
                  <span className="text-[11px] bg-dark-card text-lime-primary px-2.5 py-0.5 rounded-full border border-lime-primary/30 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    Google Linked
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleLinkCurrentAccountWithGoogle}
                    disabled={loading}
                    className="text-[11px] bg-dark-card hover:bg-dark-cardHover text-slate-300 hover:text-white px-2.5 py-0.5 rounded-full border border-dark-border flex items-center gap-1 transition-colors"
                    title="Link Google account for one-click login"
                  >
                    <Link2 className="w-3 h-3 text-lime-primary" />
                    Link Google
                  </button>
                )}
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Personal Profile & Daily Nutrition Targets
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Deterministic energy and macronutrient targets computed via Mifflin-St Jeor equation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {!currentUser ? (
            <button
              onClick={() => {
                setAuthMode('login');
                setAuthError(null);
                setShowAuthModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-lime-primary hover:bg-lime-hover text-lime-dark rounded-xl text-xs sm:text-sm font-bold transition shadow-lg shadow-lime-primary/10"
            >
              <LogIn className="w-4 h-4" />
              Sign In / Sync Data
            </button>
          ) : (
            <button
              onClick={handleSignOut}
              className="text-xs text-slate-400 hover:text-coral-primary font-medium transition-colors"
            >
              Sign Out
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Form on Left (5 cols), Target Insights on Right (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Profile Input Form (5 cols) */}
        <div className="lg:col-span-5 bg-dark-card rounded-2xl border border-dark-border p-6 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-lime-primary" />
              Biometric Metrics & Goal
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">Metric Units</span>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4" noValidate>
            {/* Age & Sex */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-age" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Age <span className="text-slate-400 font-normal">(years)</span>
                </label>
                <input
                  id="profile-age"
                  type="text"
                  inputMode="numeric"
                  value={ageStr}
                  onChange={(e) => handleAgeChange(e.target.value)}
                  placeholder="25"
                  className={`w-full px-3 py-2.5 bg-dark-inner border rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none transition-colors ${
                    fieldErrors.age
                      ? 'border-coral-primary focus:border-coral-primary focus:ring-1 focus:ring-coral-primary'
                      : 'border-dark-border focus:border-lime-primary focus:ring-1 focus:ring-lime-primary'
                  }`}
                  aria-invalid={!!fieldErrors.age}
                  aria-describedby={fieldErrors.age ? 'age-error' : undefined}
                />
                {fieldErrors.age && (
                  <p id="age-error" className="text-xs text-coral-primary mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {fieldErrors.age}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="profile-sex" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Biological Sex
                </label>
                <select
                  id="profile-sex"
                  value={sex}
                  onChange={(e) => handleSexChange(e.target.value as Sex)}
                  className="w-full px-3 py-2.5 bg-dark-inner border border-dark-border rounded-xl text-sm text-white focus:outline-none focus:border-lime-primary focus:ring-1 focus:ring-lime-primary transition-colors"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
            </div>

            {/* Height & Weight */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="profile-height" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Height <span className="text-slate-400 font-normal">(cm)</span>
                </label>
                <input
                  id="profile-height"
                  type="text"
                  inputMode="decimal"
                  value={heightStr}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  placeholder="175"
                  className={`w-full px-3 py-2.5 bg-dark-inner border rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none transition-colors ${
                    fieldErrors.height_cm
                      ? 'border-coral-primary focus:border-coral-primary focus:ring-1 focus:ring-coral-primary'
                      : 'border-dark-border focus:border-lime-primary focus:ring-1 focus:ring-lime-primary'
                  }`}
                  aria-invalid={!!fieldErrors.height_cm}
                  aria-describedby={fieldErrors.height_cm ? 'height-error' : undefined}
                />
                {fieldErrors.height_cm && (
                  <p id="height-error" className="text-xs text-coral-primary mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {fieldErrors.height_cm}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="profile-weight" className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Weight <span className="text-slate-400 font-normal">(kg)</span>
                </label>
                <input
                  id="profile-weight"
                  type="text"
                  inputMode="decimal"
                  value={weightStr}
                  onChange={(e) => handleWeightChange(e.target.value)}
                  placeholder="70"
                  className={`w-full px-3 py-2.5 bg-dark-inner border rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none transition-colors ${
                    fieldErrors.weight_kg
                      ? 'border-coral-primary focus:border-coral-primary focus:ring-1 focus:ring-coral-primary'
                      : 'border-dark-border focus:border-lime-primary focus:ring-1 focus:ring-lime-primary'
                  }`}
                  aria-invalid={!!fieldErrors.weight_kg}
                  aria-describedby={fieldErrors.weight_kg ? 'weight-error' : undefined}
                />
                {fieldErrors.weight_kg && (
                  <p id="weight-error" className="text-xs text-coral-primary mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {fieldErrors.weight_kg}
                  </p>
                )}
              </div>
            </div>

            {/* Activity Level */}
            <div>
              <label htmlFor="profile-activity" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Activity Level
              </label>
              <select
                id="profile-activity"
                value={activityLevel}
                onChange={(e) => handleActivityChange(e.target.value as ActivityLevel)}
                className="w-full px-3 py-2.5 bg-dark-inner border border-dark-border rounded-xl text-sm text-white focus:outline-none focus:border-lime-primary focus:ring-1 focus:ring-lime-primary transition-colors"
              >
                <option value="SEDENTARY">Sedentary (Little or no exercise • 1.2x)</option>
                <option value="LIGHTLY_ACTIVE">Lightly Active (Exercise 1–3 days/wk • 1.375x)</option>
                <option value="MODERATELY_ACTIVE">Moderately Active (Exercise 3–5 days/wk • 1.55x)</option>
                <option value="VERY_ACTIVE">Very Active (Hard exercise 6–7 days/wk • 1.725x)</option>
                <option value="EXTRA_ACTIVE">Extra Active (Very heavy physical training • 1.9x)</option>
              </select>
            </div>

            {/* Nutrition Goal */}
            <div>
              <label htmlFor="profile-goal" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Primary Nutrition Goal
              </label>
              <select
                id="profile-goal"
                value={goal}
                onChange={(e) => handleGoalChange(e.target.value as UserGoal)}
                className="w-full px-3 py-2.5 bg-dark-inner border border-dark-border rounded-xl text-sm text-white font-medium focus:outline-none focus:border-lime-primary focus:ring-1 focus:ring-lime-primary transition-colors"
              >
                <option value="WEIGHT_LOSS">Weight Loss (-400 kcal deficit, 1.4g/kg protein)</option>
                <option value="MAINTENANCE">Maintenance (Caloric balance, 1.2g/kg protein)</option>
                <option value="WEIGHT_GAIN">Weight Gain (+350 kcal surplus, 1.4g/kg protein)</option>
                <option value="MUSCLE_GAIN">Muscle Hypertrophy (+250 kcal surplus, 1.8g/kg protein)</option>
                <option value="GENERAL_HEALTH">General Health (Equilibrium, 1.1g/kg protein)</option>
              </select>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 bg-coral-dim border border-coral-primary/30 rounded-xl flex items-start gap-2.5 text-xs text-coral-primary">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Success Message */}
            {saveSuccess && (
              <div className="p-3 bg-lime-dim border border-lime-primary/30 rounded-xl flex items-center gap-2.5 text-xs text-lime-primary font-medium animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Profile and daily nutrition targets saved successfully!</span>
              </div>
            )}

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-lime-primary hover:bg-lime-hover disabled:opacity-50 text-lime-dark font-bold rounded-xl text-sm transition-all shadow-lg shadow-lime-primary/10 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Recalculating & Saving...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Profile & Update Targets</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Target Insights Column (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {targets ? (
            <>
              {/* Daily Calorie Target Hero Card */}
              <div className="bg-gradient-to-br from-dark-card to-dark-elevated rounded-2xl border border-dark-border p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-lime-primary/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-lime-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Calculated Daily Intake Budget
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-lime-primary bg-lime-dim px-2.5 py-0.5 rounded-full border border-lime-primary/20">
                    Active Target
                  </span>
                </div>

                <div className="flex items-baseline gap-3 mb-6">
                  <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                    {targets.calorie_target}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">kcal / day</span>
                </div>

                {/* Metabolic Breakdown Cards */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-dark-border">
                  <div className="bg-dark-inner/80 p-3.5 rounded-xl border border-dark-border">
                    <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">
                      BMR (Basal Metabolic Rate)
                    </span>
                    <span className="text-lg font-bold text-slate-200">
                      {targets.bmr} <span className="text-xs font-normal text-slate-400">kcal</span>
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">Energy at rest</span>
                  </div>

                  <div className="bg-dark-inner/80 p-3.5 rounded-xl border border-dark-border">
                    <span className="text-[11px] text-slate-400 block mb-0.5 font-medium">
                      TDEE (Total Daily Energy)
                    </span>
                    <span className="text-lg font-bold text-slate-200">
                      {targets.tdee} <span className="text-xs font-normal text-slate-400">kcal</span>
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">With activity level</span>
                  </div>
                </div>
              </div>

              {/* Macronutrient Distribution Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Protein */}
                <div className="bg-dark-card rounded-xl border border-dark-border p-4 shadow-sm hover:border-sky-400/30 transition-colors">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-sky-400">Protein</span>
                    <span className="text-[10px] text-slate-500 font-mono">4 kcal/g</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-2">
                    {targets.protein_target_g}
                    <span className="text-xs text-slate-400 font-normal">g</span>
                  </div>
                  <div className="w-full bg-dark-inner h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-sky-400 h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round(((targets.protein_target_g * 4) / targets.calorie_target) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1.5 block">
                    {Math.round(((targets.protein_target_g * 4) / targets.calorie_target) * 100)}% of calories
                  </span>
                </div>

                {/* Carbohydrates */}
                <div className="bg-dark-card rounded-xl border border-dark-border p-4 shadow-sm hover:border-amber-400/30 transition-colors">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-amber-400">Carbs</span>
                    <span className="text-[10px] text-slate-500 font-mono">4 kcal/g</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-2">
                    {targets.carbohydrates_target_g}
                    <span className="text-xs text-slate-400 font-normal">g</span>
                  </div>
                  <div className="w-full bg-dark-inner h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round(((targets.carbohydrates_target_g * 4) / targets.calorie_target) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1.5 block">
                    {Math.round(((targets.carbohydrates_target_g * 4) / targets.calorie_target) * 100)}% of calories
                  </span>
                </div>

                {/* Fat */}
                <div className="bg-dark-card rounded-xl border border-dark-border p-4 shadow-sm hover:border-rose-400/30 transition-colors">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-rose-400">Fat</span>
                    <span className="text-[10px] text-slate-500 font-mono">9 kcal/g</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-2">
                    {targets.fat_target_g}
                    <span className="text-xs text-slate-400 font-normal">g</span>
                  </div>
                  <div className="w-full bg-dark-inner h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-rose-400 h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.round(((targets.fat_target_g * 9) / targets.calorie_target) * 100))}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1.5 block">
                    {Math.round(((targets.fat_target_g * 9) / targets.calorie_target) * 100)}% of calories
                  </span>
                </div>

                {/* Dietary Fiber */}
                <div className="bg-dark-card rounded-xl border border-dark-border p-4 shadow-sm hover:border-lime-primary/30 transition-colors">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-lime-primary">Fiber</span>
                    <span className="text-[10px] text-slate-500 font-mono">Floor</span>
                  </div>
                  <div className="text-2xl font-bold text-white mb-2">
                    {targets.fiber_target_g}
                    <span className="text-xs text-slate-400 font-normal">g</span>
                  </div>
                  <div className="w-full bg-dark-inner h-1.5 rounded-full overflow-hidden">
                    <div className="bg-lime-primary h-full rounded-full w-full" />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1.5 block">
                    ≥14g per 1,000 kcal
                  </span>
                </div>
              </div>

              {/* Safety Warning (if triggered) */}
              {targets.safety_warning && (
                <div className="p-4 bg-coral-dim border border-coral-primary/40 rounded-xl flex items-start gap-3 text-xs text-coral-primary">
                  <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">Clinical Safety Notice</span>
                    <p className="leading-relaxed">{targets.safety_warning}</p>
                  </div>
                </div>
              )}

              {/* Educational Disclaimer */}
              <div className="p-4 bg-dark-card rounded-xl border border-dark-border flex items-start gap-3 text-xs text-slate-400">
                <Info className="w-4 h-4 flex-shrink-0 text-slate-500 mt-0.5" />
                <p className="leading-relaxed">{targets.disclaimer}</p>
              </div>
            </>
          ) : (
            <div className="bg-dark-card rounded-2xl border border-dark-border p-12 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-lime-primary animate-spin mx-auto" />
              <p className="text-sm text-slate-400">Computing energy and macro targets...</p>
            </div>
          )}
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-dark-card rounded-2xl border border-dark-border max-w-md w-full p-6 shadow-2xl relative space-y-5">
            <button
              onClick={handleCloseAuthModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Standard Login & Register Modes */}
            {(authMode === 'login' || authMode === 'register') && (
              <>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-lime-dim text-lime-primary text-xs font-bold border border-lime-primary/30 mb-2">
                    <LogIn className="w-3.5 h-3.5" />
                    Authentication
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    {authMode === 'login' ? 'Welcome Back' : 'Create an Account'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Save your personal profile and sync nutrition targets to the cloud.
                  </p>
                </div>

                {/* Mode Switch Tabs */}
                <div className="grid grid-cols-2 bg-dark-inner p-1 rounded-xl border border-dark-border text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setAuthError(null);
                    }}
                    className={`py-2 rounded-lg transition-colors ${
                      authMode === 'login' ? 'bg-dark-card text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setAuthError(null);
                    }}
                    className={`py-2 rounded-lg transition-colors ${
                      authMode === 'register' ? 'bg-dark-card text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Register
                  </button>
                </div>

                {/* Google Sign In via Firebase */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full py-2.5 bg-dark-inner hover:bg-dark-cardHover border border-dark-border text-white font-semibold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2.5 shadow-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="relative text-center my-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-dark-border" />
                  </div>
                  <span className="relative px-3 bg-dark-card text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                    or email & password
                  </span>
                </div>

                <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                  {authMode === 'register' && (
                    <div>
                      <label htmlFor="auth-name" className="block text-xs font-medium text-slate-300 mb-1">Name</label>
                      <input
                        id="auth-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className="w-full px-3 py-2 bg-dark-inner border border-dark-border rounded-xl text-sm text-white focus:outline-none focus:border-lime-primary focus:ring-1 focus:ring-lime-primary"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="auth-email" className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      className="w-full px-3 py-2 bg-dark-inner border border-dark-border rounded-xl text-sm text-white focus:outline-none focus:border-lime-primary focus:ring-1 focus:ring-lime-primary"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="auth-password" className="block text-xs font-medium text-slate-300">Password</label>
                      {authMode === 'login' && (
                        <button
                          type="button"
                          onClick={() => {
                            setAuthMode('forgot-password');
                            setAuthError(null);
                            setForgotSubmitted(false);
                            setForgotMessage(null);
                          }}
                          className="text-[11px] text-lime-primary hover:text-lime-hover font-medium transition-colors hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <input
                      id="auth-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-3 py-2 bg-dark-inner border border-dark-border rounded-xl text-sm text-white focus:outline-none focus:border-lime-primary focus:ring-1 focus:ring-lime-primary"
                    />
                  </div>

                  {authError && (
                    <div className="p-3 bg-coral-dim border border-coral-primary/30 rounded-xl text-xs text-coral-primary flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-lime-primary hover:bg-lime-hover text-lime-dark font-bold rounded-xl text-sm transition-all shadow-lg shadow-lime-primary/10 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    <span>{authMode === 'login' ? 'Sign In & Save' : 'Create Account & Save'}</span>
                  </button>
                </form>

                <div className="relative text-center my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-dark-border" />
                  </div>
                  <span className="relative px-3 bg-dark-card text-[11px] text-slate-500 uppercase tracking-wider">
                    Or
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleCreateDemoUser}
                  disabled={loading}
                  className="w-full py-2.5 bg-dark-inner hover:bg-dark-cardHover border border-dark-border text-slate-200 font-semibold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-lime-primary" />
                  <span>Continue with Instant Demo User</span>
                </button>
              </>
            )}

            {/* Forgot Password Mode */}
            {authMode === 'forgot-password' && (
              <div className="space-y-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-lime-dim text-lime-primary text-xs font-bold border border-lime-primary/30 mb-2">
                    <KeyRound className="w-3.5 h-3.5" />
                    Account Recovery
                  </div>
                  <h3 className="text-xl font-bold text-white">Reset Your Password</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Enter your registered email address and we'll send a secure password recovery link.
                  </p>
                </div>

                {forgotSubmitted ? (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="p-4 bg-lime-dim border border-lime-primary/30 rounded-xl flex items-start gap-3 text-xs text-lime-primary">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block mb-1">Check Your Inbox</span>
                        <p className="leading-relaxed text-slate-200">
                          {forgotMessage ||
                            'If an account exists with this email, a password reset link has been sent. Please check your inbox.'}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Password reset links are valid for 30 minutes. If you do not see the email shortly, please check your spam or junk folder.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setForgotSubmitted(false);
                        setForgotMessage(null);
                        setAuthError(null);
                      }}
                      className="w-full py-2.5 bg-dark-inner hover:bg-dark-cardHover border border-dark-border text-white font-semibold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4 text-lime-primary" />
                      <span>Return to Sign In</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-3.5">
                    <div>
                      <label htmlFor="forgot-email" className="block text-xs font-medium text-slate-300 mb-1">Account Email</label>
                      <input
                        id="forgot-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        required
                        className="w-full px-3 py-2 bg-dark-inner border border-dark-border rounded-xl text-sm text-white focus:outline-none focus:border-lime-primary focus:ring-1 focus:ring-lime-primary"
                      />
                    </div>

                    {authError && (
                      <div className="p-3 bg-coral-dim border border-coral-primary/30 rounded-xl text-xs text-coral-primary flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{authError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-lime-primary hover:bg-lime-hover text-lime-dark font-bold rounded-xl text-sm transition-all shadow-lg shadow-lime-primary/10 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      <span>Send Recovery Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError(null);
                      }}
                      className="w-full py-2 text-xs text-slate-400 hover:text-white font-medium transition flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back to Sign In</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Reset Password Mode (via email link) */}
            {authMode === 'reset-password' && (
              <div className="space-y-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-lime-dim text-lime-primary text-xs font-bold border border-lime-primary/30 mb-2">
                    <Lock className="w-3.5 h-3.5" />
                    Security
                  </div>
                  <h3 className="text-xl font-bold text-white">Create New Password</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Enter a new password for your account. All older sessions will be signed out.
                  </p>
                </div>

                {resetSuccess ? (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="p-4 bg-lime-dim border border-lime-primary/30 rounded-xl flex items-start gap-3 text-xs text-lime-primary">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block mb-1">Password Reset Complete</span>
                        <p className="leading-relaxed text-slate-200">
                          {resetMessage || 'Your password has been updated successfully. Older sessions have been revoked.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setResetSuccess(false);
                        setResetMessage(null);
                        setPassword('');
                        setAuthError(null);
                      }}
                      className="w-full py-2.5 bg-lime-primary hover:bg-lime-hover text-lime-dark font-bold rounded-xl text-sm transition-all shadow-lg shadow-lime-primary/10 flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Sign In with New Password</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
                    <div>
                      <label htmlFor="reset-new-password" className="block text-xs font-medium text-slate-300 mb-1">New Password</label>
                      <input
                        id="reset-new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                        minLength={6}
                        className="w-full px-3 py-2 bg-dark-inner border border-dark-border rounded-xl text-sm text-white focus:outline-none focus:border-lime-primary focus:ring-1 focus:ring-lime-primary"
                      />
                    </div>

                    <div>
                      <label htmlFor="reset-confirm-password" className="block text-xs font-medium text-slate-300 mb-1">Confirm New Password</label>
                      <input
                        id="reset-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        minLength={6}
                        className="w-full px-3 py-2 bg-dark-inner border border-dark-border rounded-xl text-sm text-white focus:outline-none focus:border-lime-primary focus:ring-1 focus:ring-lime-primary"
                      />
                    </div>

                    {authError && (
                      <div className="p-3 bg-coral-dim border border-coral-primary/30 rounded-xl text-xs text-coral-primary flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{authError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 bg-lime-primary hover:bg-lime-hover text-lime-dark font-bold rounded-xl text-sm transition-all shadow-lg shadow-lime-primary/10 flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      <span>Update Password & Continue</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError(null);
                      }}
                      className="w-full py-2 text-xs text-slate-400 hover:text-white font-medium transition flex items-center justify-center gap-1.5"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Account Linking Mode (Google linking with existing password account) */}
            {authMode === 'link-account' && (
              <div className="space-y-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-lime-dim text-lime-primary text-xs font-bold border border-lime-primary/30 mb-2">
                    <Link2 className="w-3.5 h-3.5" />
                    Account Verification
                  </div>
                  <h3 className="text-xl font-bold text-white">Link Google Account</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    An existing NutriLens account is registered with this email address.
                  </p>
                </div>

                <div className="p-3.5 bg-dark-inner border border-dark-border rounded-xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Registered Account:</span>
                    <span className="font-mono text-lime-primary font-semibold">{linkingEmail}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed pt-1 border-t border-dark-border">
                    To connect your Google account securely without losing any meals, profile data, or targets, please verify your NutriLens account password.
                  </p>
                </div>

                <form onSubmit={handleVerifyAndLinkGoogle} className="space-y-3.5">
                  <div>
                    <label htmlFor="link-password" className="block text-xs font-medium text-slate-300 mb-1">
                      NutriLens Password
                    </label>
                    <input
                      id="link-password"
                      type="password"
                      value={linkPassword}
                      onChange={(e) => setLinkPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoFocus
                      className="w-full px-3 py-2 bg-dark-inner border border-dark-border rounded-xl text-sm text-white focus:outline-none focus:border-lime-primary focus:ring-1 focus:ring-lime-primary"
                    />
                  </div>

                  {authError && (
                    <div className="p-3 bg-coral-dim border border-coral-primary/30 rounded-xl text-xs text-coral-primary flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-lime-primary hover:bg-lime-hover text-lime-dark font-bold rounded-xl text-sm transition-all shadow-lg shadow-lime-primary/10 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    <span>Verify Password & Link Google</span>
                  </button>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(linkingEmail);
                        setAuthMode('forgot-password');
                        setPendingFirebaseIdToken(null);
                        setLinkPassword('');
                        setAuthError(null);
                      }}
                      className="text-xs text-lime-primary hover:text-lime-hover font-medium transition-colors hover:underline"
                    >
                      Forgot your password?
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPendingFirebaseIdToken(null);
                        setLinkPassword('');
                        setAuthMode('login');
                        setAuthError(null);
                      }}
                      className="text-xs text-slate-400 hover:text-white font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
