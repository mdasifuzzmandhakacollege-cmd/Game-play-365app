import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Crown,
  Zap,
  Globe,
  Coins,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';
import { referralService } from '../../services/referralService';

interface Play369AuthCardProps {
  initialMode?: 'login' | 'register';
  onSuccess?: () => void;
  onClose?: () => void;
  className?: string;
  isModal?: boolean;
}

export const Play369AuthCard: React.FC<Play369AuthCardProps> = ({
  initialMode = 'login',
  onSuccess,
  onClose,
  className = '',
  isModal = false
}) => {
  const { loginWithEmail, registerWithEmail, signInWithGoogle, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [preferredCurrency, setPreferredCurrency] = useState<'BDT' | 'USD'>('BDT');
  const [referralCode, setReferralCode] = useState<string>('');
  const [agreeTerms, setAgreeTerms] = useState<boolean>(true);

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [legalModalContent, setLegalModalContent] = useState<'terms' | 'responsible' | 'privacy' | null>(null);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [showReferralInput, setShowReferralInput] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form Validations
  const validateForm = (): boolean => {
    setErrorMessage(null);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setErrorMessage('Please provide a valid email address.');
      return false;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return false;
    }

    if (mode === 'register') {
      if (!displayName.trim()) {
        setErrorMessage('Please enter your full name or player username.');
        return false;
      }

      if (password.length < 8) {
        setErrorMessage('For maximum account security, registration password must be at least 8 characters.');
        return false;
      }

      if (password !== confirmPassword) {
        setErrorMessage('Password and Confirm Password do not match.');
        return false;
      }

      if (!agreeTerms) {
        setErrorMessage('You must be 18+ and accept the Terms & Fair Play Agreement.');
        return false;
      }
    }

    return true;
  };

  // Handle Standard Email/Password Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (mode === 'login') {
        const user = await loginWithEmail(email.trim(), password);
        if (user) {
          setSuccessMessage('Welcome back to PLAY369! Vault unlocked.');
          setTimeout(() => {
            if (onSuccess) onSuccess();
            if (onClose) onClose();
          }, 600);
        }
      } else {
        const user = await registerWithEmail(
          email.trim(),
          password,
          displayName.trim(),
          preferredCurrency
        );
        if (user) {
          const effectiveReferralCode = referralCode.trim() || referralService.getStoredReferralCode();
          if (effectiveReferralCode) {
            try {
              const token = await user.getIdToken();
              await referralService.bindReferralOnServer(effectiveReferralCode, token);
            } catch (refErr) {
              console.warn('[Play369AuthCard] Authoritative referral bind notification:', refErr);
            }
          }
          setSuccessMessage('Registration completed! High-roller credentials activated.');
          setTimeout(() => {
            if (onSuccess) onSuccess();
            if (onClose) onClose();
          }, 700);
        }
      }
    } catch (err: any) {
      console.error('PLAY369 Auth Error:', err);
      let friendlyError = 'Authentication failed. Please verify credentials.';
      const msg = (err?.message || '').toLowerCase();
      const code = (err?.code || '').toLowerCase();

      if (code.includes('user-not-found') || msg.includes('user not found') || msg.includes('user-not-found')) {
        friendlyError = 'No PLAY369 account found with this email. Please click "Register" to create an account.';
      } else if (code.includes('wrong-password') || code.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('invalid-credential') || msg.includes('wrong password') || msg.includes('invalid credential')) {
        friendlyError = 'Incorrect password or email credentials. Please check and try again.';
      } else if (code.includes('email-already-in-use') || msg.includes('email already in use') || msg.includes('email-already-in-use')) {
        friendlyError = 'An account already exists with this email. Please switch to "Sign In".';
      } else if (code.includes('weak-password') || msg.includes('weak password') || msg.includes('weak-password')) {
        friendlyError = 'Password is too weak. Please use at least 8 characters with numbers & symbols.';
      } else if (code.includes('invalid-email') || msg.includes('invalid-email') || msg.includes('invalid email')) {
        friendlyError = 'Invalid email address format. Please enter a valid email address.';
      } else if (code.includes('too-many-requests') || msg.includes('too-many-requests') || msg.includes('too many requests')) {
        friendlyError = 'Too many failed login attempts. Access temporarily locked for security. Please try again in 5 minutes.';
      } else if (code.includes('network-request-failed') || msg.includes('network')) {
        friendlyError = 'Network connection issue. Please check your connectivity and try again.';
      } else if (err?.message) {
        friendlyError = err.message;
      }

      setErrorMessage(friendlyError);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle One-Tap Google Sign-In
  const handleGoogleSignIn = async () => {
    setIsGoogleSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const user = await signInWithGoogle();
      if (user) {
        setSuccessMessage('Authenticated with Google. Welcome to PLAY369!');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          if (onClose) onClose();
        }, 600);
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(err?.message || 'Google authentication was cancelled or encountered an error.');
      }
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <div
      id="play369-auth-card"
      className={`relative w-full overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#063120] via-[#021b10] to-[#01120a] p-6 sm:p-8 shadow-2xl backdrop-blur-xl ${className}`}
      style={{
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 35px rgba(245, 158, 11, 0.12)'
      }}
    >
      {/* Ambient Gold Glow Orbs (Subtle Golden Ratio) */}
      <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald-500/15 blur-3xl" />

      {/* Brand Header */}
      <div className="relative z-10 text-center mb-6">
        <div className="inline-flex items-center justify-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 mb-3">
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] font-black tracking-widest text-amber-300 uppercase">
            PLAY369 CASINO
          </span>
          <Sparkles className="w-3 h-3 text-amber-400" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
          <span>{mode === 'login' ? 'Player Sign In' : 'Create Account'}</span>
        </h2>
        <p className="text-xs sm:text-sm text-emerald-200/70 mt-1 font-medium">
          {mode === 'login'
            ? 'Access your player account and seamless gaming wallet'
            : 'Create your player account with dual BDT/USD currency support'}
        </p>
      </div>

      {/* Mode Switcher Tabs (Minimum 48px Touch Target) */}
      <div
        id="play369-mode-toggle"
        className="relative z-10 grid grid-cols-2 p-1.5 mb-6 rounded-2xl bg-[#02140c]/90 border border-emerald-800/40"
      >
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setErrorMessage(null);
          }}
          className={`min-h-[48px] rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 flex items-center justify-center space-x-2 cursor-pointer ${
            mode === 'login'
              ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
              : 'text-emerald-300/70 hover:text-white hover:bg-emerald-950/40'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Sign In</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setMode('register');
            setErrorMessage(null);
          }}
          className={`min-h-[48px] rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 flex items-center justify-center space-x-2 cursor-pointer ${
            mode === 'register'
              ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black shadow-lg shadow-amber-500/20'
              : 'text-emerald-300/70 hover:text-white hover:bg-emerald-950/40'
          }`}
        >
          <UserIcon className="w-4 h-4" />
          <span>Register</span>
        </button>
      </div>

      {/* Error & Success Feedback Banners */}
      <AnimatePresence mode="wait">
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="relative z-10 mb-4 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs flex items-start space-x-2.5 shadow-lg"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
          </motion.div>
        )}

        {successMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="relative z-10 mb-4 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs flex items-start space-x-2.5 shadow-lg"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{successMessage}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Authentication Form */}
      <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
        {/* Registration-only: Full Name / Display Name */}
        {mode === 'register' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1.5"
          >
            <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
              Player Username / Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/80">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                id="play369-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Asif Chowdhury or HighRoller369"
                required={mode === 'register'}
                className="w-full min-h-[48px] pl-10 pr-4 rounded-xl bg-[#02180e] border border-emerald-800/60 text-white placeholder-emerald-700/60 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-all font-sans"
              />
            </div>
          </motion.div>
        )}

        {/* Email Address */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
            Email Address
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/80">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="play369-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@play369.com"
              required
              autoComplete="email"
              className="w-full min-h-[48px] pl-10 pr-4 rounded-xl bg-[#02180e] border border-emerald-800/60 text-white placeholder-emerald-700/60 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-all font-sans"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
              {mode === 'login' ? 'Password' : 'Create Secure Password'}
            </label>
            {mode === 'login' && (
              <span className="text-[11px] text-amber-400/90 hover:text-amber-300 font-medium cursor-pointer">
                Forgot password?
              </span>
            )}
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/80">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="play369-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full min-h-[48px] pl-10 pr-12 rounded-xl bg-[#02180e] border border-emerald-800/60 text-white placeholder-emerald-700/60 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-all font-sans"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-emerald-400/70 hover:text-amber-300 transition-colors min-h-[48px] px-2 cursor-pointer"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Registration Password Strength & Confirm Password */}
        {mode === 'register' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 pt-1"
          >
            {/* Real-time security score */}
            <PasswordStrengthIndicator
              password={password}
              confirmPassword={confirmPassword}
              showConfirmCheck={confirmPassword.length > 0}
            />

            {/* Confirm Password Field */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400/80">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <input
                  id="play369-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required={mode === 'register'}
                  className="w-full min-h-[48px] pl-10 pr-12 rounded-xl bg-[#02180e] border border-emerald-800/60 text-white placeholder-emerald-700/60 text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 transition-all font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-emerald-400/70 hover:text-amber-300 transition-colors min-h-[48px] px-2 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Currency Choice */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                Preferred Vault Currency
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setPreferredCurrency('BDT')}
                  className={`min-h-[48px] p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    preferredCurrency === 'BDT'
                      ? 'bg-emerald-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10'
                      : 'bg-[#02180e] border-emerald-800/60 text-emerald-300/70 hover:border-emerald-700'
                  }`}
                >
                  <Coins className="w-4 h-4 text-emerald-400" />
                  <span>BDT (৳ Bangladeshi Taka)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreferredCurrency('USD')}
                  className={`min-h-[48px] p-2.5 rounded-xl border font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                    preferredCurrency === 'USD'
                      ? 'bg-emerald-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10'
                      : 'bg-[#02180e] border-emerald-800/60 text-emerald-300/70 hover:border-emerald-700'
                  }`}
                >
                  <Globe className="w-4 h-4 text-amber-400" />
                  <span>USD ($ US Dollar)</span>
                </button>
              </div>
            </div>

            {/* Optional Referral Code Toggle */}
            <div className="pt-0.5">
              {!showReferralInput ? (
                <button
                  type="button"
                  onClick={() => setShowReferralInput(true)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <span>+ Have an Agent / Referral code?</span>
                </button>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                    Agent or Referral Promo Code
                  </label>
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="e.g. VIP369 or AGENT_DHAKA"
                    className="w-full min-h-[48px] px-3.5 rounded-xl bg-[#02180e] border border-emerald-800/60 text-white placeholder-emerald-700/60 text-sm focus:outline-none focus:border-amber-400 font-mono uppercase"
                  />
                </div>
              )}
            </div>

            {/* Terms and Age Agreement with Functional Modals */}
            <div className="pt-1">
              <label className="flex items-start space-x-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-emerald-800 bg-[#02180e] text-amber-500 focus:ring-amber-400 cursor-pointer shrink-0"
                />
                <span className="text-[11px] text-emerald-200/80 leading-snug">
                  I certify that I am <strong>18+ years of age</strong> and accept the{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setLegalModalContent('terms');
                    }}
                    className="text-amber-300 underline font-semibold hover:text-amber-200 inline p-0 bg-transparent border-0 cursor-pointer"
                  >
                    Terms of Service
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setLegalModalContent('responsible');
                    }}
                    className="text-amber-300 underline font-semibold hover:text-amber-200 inline p-0 bg-transparent border-0 cursor-pointer"
                  >
                    Responsible Gaming Policy
                  </button>.
                </span>
              </label>
            </div>
          </motion.div>
        )}

        {/* Primary Action Button (Min 48px Height, Golden Ratio Polish) */}
        <button
          id="play369-submit-btn"
          type="submit"
          disabled={isSubmitting || authLoading}
          className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center space-x-2 shadow-xl shadow-amber-500/25 hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
              <span>Verifying Credentials...</span>
            </>
          ) : (
            <>
              <span>{mode === 'login' ? 'Sign In to PLAY369' : 'Create PLAY369 Account'}</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-6 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-emerald-800/40" />
        </div>
        <span className="relative px-3 bg-[#031c11] text-[11px] font-bold text-emerald-400/80 uppercase tracking-widest">
          Or Continue With
        </span>
      </div>

      {/* One-Tap Google OAuth Button (Min 48px Touch Target) */}
      <button
        id="play369-google-btn"
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isGoogleSubmitting || authLoading}
        className="w-full min-h-[48px] rounded-2xl bg-[#02180e] hover:bg-[#032314] border border-emerald-700/50 hover:border-amber-400/60 text-white font-bold text-xs sm:text-sm flex items-center justify-center space-x-3 transition-all cursor-pointer disabled:opacity-50"
      >
        {isGoogleSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
        ) : (
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
            />
          </svg>
        )}
        <span>Continue with Google Account</span>
      </button>

      {/* Security Assurance Footer */}
      <div className="mt-6 text-center">
        <div className="inline-flex items-center space-x-1.5 text-[11px] text-emerald-400/80 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>Player Account Authentication · 18+ Only</span>
        </div>
      </div>

      {/* Legal & Policy Modal Viewer */}
      <AnimatePresence>
        {legalModalContent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setLegalModalContent(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg bg-[#02180e] border border-amber-500/40 rounded-2xl p-6 shadow-2xl text-left font-sans max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-emerald-800/60 mb-4">
                <h3 className="text-base font-bold text-amber-300">
                  {legalModalContent === 'terms' && 'PLAY369 Terms of Service'}
                  {legalModalContent === 'responsible' && 'Responsible Gaming Policy'}
                  {legalModalContent === 'privacy' && 'Privacy Policy'}
                </h3>
                <button
                  type="button"
                  onClick={() => setLegalModalContent(null)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-emerald-400 hover:text-white rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs text-emerald-200/90 leading-relaxed">
                {legalModalContent === 'terms' && (
                  <>
                    <p><strong>1. Age Requirement:</strong> All players must be at least 18 years old or the legal age of majority in their jurisdiction.</p>
                    <p><strong>2. Fair Play &amp; Account Integrity:</strong> Only one account per person is permitted. Collusion, automated botting, or exploiting technical defects is strictly prohibited.</p>
                    <p><strong>3. Wallet Balances:</strong> All wallet operations are logged via a double-entry ledger. Players are responsible for maintaining account confidentiality.</p>
                  </>
                )}

                {legalModalContent === 'responsible' && (
                  <>
                    <p><strong>1. Player Well-being:</strong> Gambling should remain entertaining and never be used as a financial source of income.</p>
                    <p><strong>2. Self-Exclusion:</strong> Players can set daily deposit limits or request cooling-off periods from account preferences.</p>
                    <p><strong>3. Protection of Minors:</strong> We employ strict age verification to prevent underage participation.</p>
                  </>
                )}

                {legalModalContent === 'privacy' && (
                  <>
                    <p><strong>1. Data Handling:</strong> Your email and account preferences are securely stored for authentication and balance tracking.</p>
                    <p><strong>2. Security:</strong> All communications with the server use encrypted transport protocols.</p>
                  </>
                )}
              </div>

              <div className="mt-5 pt-3 border-t border-emerald-800/60 flex justify-end">
                <button
                  type="button"
                  onClick={() => setLegalModalContent(null)}
                  className="min-h-[44px] px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  I Understand
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
