import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Lock,
  Phone,
  Gift,
  Eye,
  EyeOff,
  CheckCircle2,
  ChevronDown,
  Star,
  ShieldCheck,
  Flame,
  AlertCircle,
  Globe,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { UserEntity } from '../server/types/seamless';
import { soundEngine } from '../services/soundEngine';
import { firebaseFirestore } from '../services/firebaseFirestoreService';
import { referralService } from '../services/referralService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  allUsers: UserEntity[];
  onSelectUser: (userId: string) => void;
}

const t = {
  en: {
    signIn: 'Sign In',
    register: 'Register',
    username: 'Email or Username',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    currency: 'Currency',
    mobileNumber: 'Mobile Number',
    promoCode: 'Promo Code',
    promoOptional: '(Optional)',
    promoPlaceholder: 'ENTER REFERRAL CODE',
    forgotPassword: 'Forgot Password?',
    terms1: 'I confirm that I am ',
    terms18: '18+ years old',
    terms2: ' and I accept the ',
    termsLink: 'Terms & Conditions',
    terms3: ' and Privacy Policy.',
    signInPlay: 'Sign In & Play',
    createVip: 'Create VIP Account',
    authenticating: 'Authenticating with Firebase...',
    orContinue: 'Or Continue With',
    googleSignIn: 'Sign in with Google',
    otp: 'OTP Verification',
    sendOtp: 'Send OTP',
    verifyOtp: 'Verify',
    otpSent: 'OTP Sent!',
    mobileNumberVerified: 'Verified'
  },
  bn: {
    signIn: 'লগইন',
    register: 'রেজিস্টার',
    username: 'ইমেইল বা ইউজারনেম',
    password: 'পাসওয়ার্ড',
    confirmPassword: 'পাসওয়ার্ড নিশ্চিত করুন',
    currency: 'কারেন্সি',
    mobileNumber: 'মোবাইল নম্বর',
    promoCode: 'প্রোমো কোড',
    promoOptional: '(ঐচ্ছিক)',
    promoPlaceholder: 'রেফারেল কোড দিন',
    forgotPassword: 'পাসওয়ার্ড ভুলে গেছেন?',
    terms1: 'আমি নিশ্চিত করছি যে আমার বয়স ',
    terms18: '১৮+ বছর',
    terms2: ' এবং আমি ',
    termsLink: 'শর্তাবলী',
    terms3: ' ও গোপনীয়তা নীতি মেনে নিচ্ছি।',
    signInPlay: 'লগইন করুন ও খেলুন',
    createVip: 'VIP অ্যাকাউন্ট তৈরি করুন',
    authenticating: 'ফায়ারবেজে যাচাই করা হচ্ছে...',
    orContinue: 'অথবা লগইন করুন',
    googleSignIn: 'গুগল দিয়ে লগইন করুন',
    otp: 'ওটিপি ভেরিফিকেশন',
    sendOtp: 'ওটিপি পাঠান',
    verifyOtp: 'ভেরিফাই',
    otpSent: 'ওটিপি পাঠানো হয়েছে!',
    mobileNumberVerified: 'ভেরিফাইড'
  }
};

const PlayallLogo = () => (
  <div className="flex flex-col items-center justify-center mb-6 mt-4 relative scale-110">
    <div className="relative flex items-center justify-center">
      {/* Circle Background */}
      <div className="absolute w-[120px] h-[120px] border-2 border-amber-500 rounded-full opacity-20 shadow-[0_0_15px_rgba(245,158,11,0.3)]"></div>
      
      {/* Playall 365 Text */}
      <div className="flex flex-col items-center z-10 relative mt-2">
        <div className="flex items-baseline space-x-0.5">
          <span className="text-4xl font-black text-white italic tracking-tighter drop-shadow-lg">Play</span>
          <span className="text-4xl font-black text-amber-500 italic tracking-tighter drop-shadow-lg">all</span>
        </div>
        <div className="flex items-center space-x-2 -mt-1 relative right-[-10px]">
           <div className="h-0.5 w-10 bg-green-500 rounded-full skew-x-12 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
           <span className="text-2xl font-black text-green-500 italic tracking-widest drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">365</span>
        </div>
        
        {/* Stars */}
        <div className="flex items-center space-x-1 mt-2">
           <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
           <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
           <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
        </div>
      </div>
      
      {/* Bat and Ball Element (Stylized) */}
      <div className="absolute -right-6 -top-2 flex items-center rotate-[-15deg]">
         <div className="h-1.5 w-12 bg-gradient-to-l from-amber-500 to-transparent rounded-full blur-[1px]"></div>
         <div className="w-5 h-5 bg-gradient-to-br from-red-500 to-red-800 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.9)] border border-red-300 z-20 flex items-center justify-center">
            <div className="w-full h-px bg-white/40 rotate-45"></div>
            <div className="w-full h-px bg-white/40 -rotate-45 absolute"></div>
         </div>
      </div>
    </div>
  </div>
);

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  allUsers,
  onSelectUser,
}) => {
  const { user, signInWithGoogle, loginWithEmail, registerWithEmail } = useAuth();
  const isAuthenticated = user !== null;
  const { language, toggleLanguage } = useLanguage();
  const lang = t[language];
  const [tab, setTab] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  // Form State
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [currency, setCurrency] = useState<'BDT' | 'USD'>('BDT');
  const [isLegalAccepted, setIsLegalAccepted] = useState(false);
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  
  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrencyDropdown, setShowCurrencyDropdown] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      onClose();
    }
    const code = referralService.getStoredReferralCode() || referralService.captureReferralFromUrl();
    if (code) {
      setPromoCode(code);
    }
  }, [isAuthenticated, onClose]);

  if (!isOpen) return null;

  // Validation Checkers
  const isUsernameValid = emailOrUsername.length >= 3;
  const isPasswordValid = password.length >= 6;
  const isConfirmPasswordValid = isPasswordValid && password === confirmPassword;
  const isMobileValid = mobileNumber.length >= 10;

  const copyDomain = () => {
    if (domainError) {
      navigator.clipboard.writeText(domainError);
      setCopiedDomain(true);
      soundEngine.playClick(900);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setDomainError(null);
    setLoading(true);
    soundEngine.playClick(800);

    const email = emailOrUsername.includes('@')
      ? emailOrUsername
      : `${emailOrUsername.toLowerCase().replace(/[^a-z0-9]/g, '')}@playall365.vip`;

    try {
      if (tab === 'REGISTER') {
        if (!isConfirmPasswordValid) {
          setErrorMessage('পাসওয়ার্ড দুটি মেলেনি (Passwords do not match)');
          setLoading(false);
          return;
        }

        const registeredUser = await registerWithEmail(email, password, emailOrUsername);
        if (registeredUser) {
          await firebaseFirestore.syncUserProfile({
            uid: registeredUser.uid,
            email: registeredUser.email,
            displayName: emailOrUsername,
            phoneNumber: mobileNumber
          }, currency);

          try {
            await referralService.processReferralRegistration({
              newUserId: registeredUser.uid,
              newUsername: emailOrUsername,
              newUserEmail: registeredUser.email || email,
              referralCode: promoCode.trim(),
              currency
            });
          } catch (refErr) {
            console.warn('AuthModal referral processing note:', refErr);
          }
          
          soundEngine.playWinChime();
          onSelectUser(registeredUser.uid);
          onClose();
        }
      } else {
        const loggedUser = await loginWithEmail(email, password);
        if (loggedUser) {
          await firebaseFirestore.syncUserProfile({
            uid: loggedUser.uid,
            email: loggedUser.email,
            displayName: loggedUser.displayName || emailOrUsername,
          }, currency);
          
          soundEngine.playWinChime();
          onSelectUser(loggedUser.uid);
          onClose();
        }
      }
    } catch (err: any) {
      console.warn('Firebase Auth Form Notice:', err?.message || err);
      const code = err?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setErrorMessage('ইমেইল অথবা পাসওয়ার্ড সঠিক নয় (Invalid email or password)');
      } else if (code === 'auth/email-already-in-use') {
        setErrorMessage('এই একাউন্টটি ইতিমধ্যে ব্যবহৃত হয়েছে, অনুগ্রহ করে লগইন করুন (Account already exists, please login)');
      } else if (code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        setDomainError(currentDomain);
        setErrorMessage(`ফায়ারবেস ডোমেইন ত্রুটি (auth/unauthorized-domain): এই ডোমেইনটি (${currentDomain}) অনুমোদিত নয়।`);
      } else if (code === 'auth/weak-password') {
        setErrorMessage('পাসওয়ার্ড কমপক্ষে ৬ ডিজিট হতে হবে (Password must be at least 6 characters)');
      } else {
        setErrorMessage(err?.message || 'Authentication error. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setDomainError(null);
    setLoading(true);
    soundEngine.playClick(600);
    try {
      const googleUser = await signInWithGoogle();
      if (googleUser) {
        await firebaseFirestore.syncUserProfile({
          uid: googleUser.uid,
          email: googleUser.email,
          displayName: googleUser.displayName,
          photoURL: googleUser.photoURL,
          phoneNumber: googleUser.phoneNumber
        }, currency);
        
        soundEngine.playWinChime();
        onSelectUser(googleUser.uid);
        onClose();
      }
    } catch (err: any) {
      console.warn('Google Sign-in notice:', err?.message || err);
      const code = err?.code || '';
      if (code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        setDomainError(currentDomain);
        setErrorMessage(
          `Firebase Error: (auth/unauthorized-domain) - এই ডোমেইনটি (${currentDomain}) Firebase Console-এ অনুমোদিত নয়।`
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setErrorMessage('Google সাইন-ইন পপআপ বন্ধ করা হয়েছে (Popup closed by user)');
      } else {
        setErrorMessage('Google Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-10 pb-20 overflow-y-auto">
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-md bg-gray-950 border border-gray-800 rounded-3xl shadow-2xl overflow-visible shadow-amber-500/10 my-auto mx-auto z-10">
        
        {/* Header & Close */}
        <div className="absolute -top-14 right-0 z-20 flex items-center space-x-3">
          {/* Metallic Language Toggle */}
          <button
            onClick={() => {
              toggleLanguage();
              soundEngine.playClick(800);
            }}
            className="flex items-center p-1 bg-gradient-to-b from-gray-800 to-gray-950 rounded-full border border-gray-700/50 shadow-[0_4px_10px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] transition-transform active:scale-95 touch-target"
            title="Toggle Language"
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${language === 'en' ? 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-gray-900 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-transparent text-gray-400'}`}>
              EN
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${language === 'bn' ? 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-gray-900 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-transparent text-gray-400'}`}>
              বাং
            </div>
          </button>
          
          <button 
            onClick={onClose}
            className="p-2.5 bg-gradient-to-b from-gray-800 to-gray-950 border border-gray-700/50 shadow-[0_4px_10px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.1)] rounded-full text-gray-400 hover:text-white transition-colors active:scale-95 touch-target"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 sm:p-8 relative z-10">
          
          <PlayallLogo />

          {/* Real-time Firebase Connection Indicator */}
          <div className="mb-4 flex items-center justify-center space-x-2 py-1 px-3 bg-emerald-950/40 border border-emerald-500/30 rounded-full text-[11px] font-mono text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Firebase Realtime Auth &amp; Firestore Active</span>
          </div>

          {/* Error Message Toast */}
          {errorMessage && (
            <div className="mb-4 p-3.5 bg-rose-950/80 border border-rose-500/50 rounded-xl text-rose-300 text-xs flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
              {domainError && (
                <div className="mt-1 p-2.5 bg-black/60 border border-rose-500/40 rounded-lg space-y-1.5 text-[11px]">
                  <div className="text-amber-400 font-bold flex items-center space-x-1">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Firebase Console &gt; Authorized domains-এ ডোমেইনটি যোগ করুন:</span>
                  </div>
                  <div className="flex items-center space-x-2 bg-gray-900 px-2 py-1.5 rounded border border-gray-700">
                    <span className="font-mono text-cyan-300 text-[11px] select-all flex-1">{domainError}</span>
                    <button
                      type="button"
                      onClick={copyDomain}
                      className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-black rounded font-bold text-[10px] flex items-center space-x-1 transition-all cursor-pointer"
                    >
                      {copiedDomain ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedDomain ? 'কপি হয়েছে!' : 'কপি করুন'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Animated Tab Switcher */}
          <div className="flex bg-gray-900 rounded-2xl p-1 mb-6 relative">
            <div 
              className="w-1/2 text-center py-2.5 text-sm font-bold cursor-pointer relative z-10 transition-colors touch-target"
              onClick={() => { setTab('LOGIN'); soundEngine.playClick(400); }}
              style={{ color: tab === 'LOGIN' ? '#030712' : '#9ca3af' }}
            >
              {lang.signIn}
            </div>
            <div 
              className="w-1/2 text-center py-2.5 text-sm font-bold cursor-pointer relative z-10 transition-colors touch-target"
              onClick={() => { setTab('REGISTER'); soundEngine.playClick(400); }}
              style={{ color: tab === 'REGISTER' ? '#030712' : '#9ca3af' }}
            >
              {lang.register}
            </div>
            <motion.div 
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-gradient-to-r from-amber-400 to-yellow-500 rounded-xl shadow-lg z-0"
              initial={false}
              animate={{ left: tab === 'LOGIN' ? '4px' : 'calc(50%)' }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            />
          </div>

          {/* Forms */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Username / Email Field */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">{lang.username}</label>
              <div className={`relative flex items-center border ${emailOrUsername.length > 0 ? (isUsernameValid ? 'border-green-500/50' : 'border-red-500/50') : 'border-gray-800'} bg-gray-900/50 rounded-xl overflow-hidden transition-colors`}>
                <div className="pl-4 pr-3 py-3 text-gray-500">
                  <User className="w-5 h-5" />
                </div>
                <input 
                  type="text" 
                  required
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  placeholder={tab === 'REGISTER' ? "Choose your username or email" : "Enter email or username"}
                  className="w-full bg-transparent min-h-[48px] text-white focus:outline-none placeholder-gray-600 text-sm"
                />
                {emailOrUsername.length > 0 && isUsernameValid && (
                  <CheckCircle2 className="w-5 h-5 text-green-500 mr-4" />
                )}
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">{lang.password}</label>
              <div className={`relative flex items-center border ${password.length > 0 ? (isPasswordValid ? 'border-green-500/50' : 'border-red-500/50') : 'border-gray-800'} bg-gray-900/50 rounded-xl overflow-hidden transition-colors`}>
                <div className="pl-4 pr-3 py-3 text-gray-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent min-h-[48px] text-white focus:outline-none placeholder-gray-600 text-sm tracking-widest"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-3 text-gray-500 hover:text-white transition-colors touch-target"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {tab === 'LOGIN' && (
              <div className="flex justify-end">
                <button type="button" className="text-xs text-amber-500 font-semibold hover:text-amber-400 transition-colors touch-target p-1">
                  {lang.forgotPassword}
                </button>
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {tab === 'REGISTER' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 overflow-visible"
                >
                  
                  {/* Confirm Password */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">{lang.confirmPassword}</label>
                    <div className={`relative flex items-center border ${confirmPassword.length > 0 ? (isConfirmPasswordValid ? 'border-green-500/50' : 'border-red-500/50') : 'border-gray-800'} bg-gray-900/50 rounded-xl overflow-hidden transition-colors`}>
                      <div className="pl-4 pr-3 py-3 text-gray-500">
                        <Lock className="w-5 h-5" />
                      </div>
                      <input 
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-transparent min-h-[48px] text-white focus:outline-none placeholder-gray-600 text-sm tracking-widest"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="p-3 text-gray-500 hover:text-white transition-colors touch-target"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Currency & Mobile Row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1 space-y-1 relative">
                      <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">{lang.currency}</label>
                      <div 
                        className="relative flex items-center justify-between border border-gray-800 bg-gray-900/50 rounded-xl min-h-[48px] px-3 cursor-pointer select-none"
                        onClick={() => setShowCurrencyDropdown(!showCurrencyDropdown)}
                      >
                        <div className="flex items-center space-x-2 text-sm text-white font-bold">
                          <span>{currency === 'BDT' ? '🇧🇩' : '🇺🇸'}</span>
                          <span>{currency}</span>
                        </div>
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      </div>
                      
                      {/* Currency Dropdown Menu */}
                      <AnimatePresence>
                        {showCurrencyDropdown && (
                          <motion.div 
                            initial={{ opacity: 0, y: -5 }} 
                            animate={{ opacity: 1, y: 0 }} 
                            exit={{ opacity: 0, y: -5 }}
                            className="absolute top-[70px] left-0 right-0 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden z-30 shadow-2xl"
                          >
                            <div 
                              className="px-3 py-3 flex items-center space-x-2 hover:bg-gray-700 cursor-pointer"
                              onClick={() => { setCurrency('BDT'); setShowCurrencyDropdown(false); soundEngine.playClick(200); }}
                            >
                              <span>🇧🇩</span><span className="text-white text-sm font-bold">BDT</span>
                            </div>
                            <div 
                              className="px-3 py-3 flex items-center space-x-2 hover:bg-gray-700 cursor-pointer"
                              onClick={() => { setCurrency('USD'); setShowCurrencyDropdown(false); soundEngine.playClick(200); }}
                            >
                              <span>🇺🇸</span><span className="text-white text-sm font-bold">USD</span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    
                    <div className="col-span-2 space-y-1">
                      <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">{lang.mobileNumber}</label>
                      <div className={`relative flex items-center border ${mobileNumber.length > 0 ? (isMobileValid ? 'border-green-500/50' : 'border-gray-800') : 'border-gray-800'} bg-gray-900/50 rounded-xl overflow-hidden transition-colors`}>
                        <div className="pl-3 pr-2 py-3 text-gray-500">
                          <Phone className="w-4 h-4" />
                        </div>
                        <input 
                          type="tel"
                          value={mobileNumber}
                          disabled={isOtpVerified}
                          onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                          placeholder={currency === 'BDT' ? "017XXXXXXXX" : "+1 (XXX)"}
                          className="w-full bg-transparent min-h-[48px] text-white focus:outline-none placeholder-gray-600 text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Promo Code (Optional) */}
                  <div className="space-y-1 mt-2">
                    <label className="text-xs font-semibold text-gray-400 ml-1 uppercase tracking-wider">{lang.promoCode} <span className="text-gray-600">{lang.promoOptional}</span></label>
                    <div className="relative flex items-center border border-amber-500/20 bg-amber-500/5 rounded-xl overflow-hidden focus-within:border-amber-500/50 transition-colors">
                      <div className="pl-4 pr-3 py-3 text-amber-500/70">
                        <Gift className="w-5 h-5" />
                      </div>
                      <input 
                        type="text" 
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        placeholder="ENTER REFERRAL CODE"
                        className="w-full bg-transparent min-h-[48px] text-amber-50 focus:outline-none placeholder-amber-500/30 text-sm font-bold tracking-widest uppercase"
                      />
                    </div>
                  </div>

                  {/* Legal Checkbox */}
                  <label className="flex items-start space-x-3 cursor-pointer py-2 group mt-2">
                    <div className="relative flex-shrink-0 mt-0.5">
                      <input 
                        type="checkbox" 
                        required
                        className="peer sr-only"
                        checked={isLegalAccepted}
                        onChange={(e) => setIsLegalAccepted(e.target.checked)}
                      />
                      <div className="w-5 h-5 rounded-md border border-gray-700 bg-gray-900 peer-checked:bg-amber-500 peer-checked:border-amber-500 flex items-center justify-center transition-colors">
                        <CheckCircle2 className={`w-3.5 h-3.5 text-black opacity-0 peer-checked:opacity-100 transition-opacity`} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 group-hover:text-gray-300 leading-relaxed transition-colors select-none">
                      {lang.terms1}<strong className="text-white">{lang.terms18}</strong>{lang.terms2}<a href="#" className="text-amber-500 hover:underline">{lang.termsLink}</a>{lang.terms3}
                    </span>
                  </label>

                </motion.div>
              )}
            </AnimatePresence>

            {/* Primary Action Button */}
            <button 
              type="submit"
              disabled={loading}
              className="w-full min-h-[54px] rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-[15px] uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] active:scale-[0.98] transition-all disabled:opacity-70 mt-4 flex items-center justify-center space-x-2 touch-target cursor-pointer"
            >
              <span>{loading ? lang.authenticating : tab === 'LOGIN' ? lang.signInPlay : lang.createVip}</span>
            </button>
            
            {/* Social Login */}
            <div className="pt-3 pb-1">
              <div className="relative flex items-center justify-center mb-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-800"></div></div>
                <div className="relative bg-gray-950 px-4 text-xs text-gray-500 font-semibold uppercase tracking-widest">{lang.orContinue}</div>
              </div>
              
              <button 
                type="button"
                disabled={loading}
                onClick={handleGoogleLogin}
                className="w-full min-h-[48px] rounded-xl bg-white hover:bg-gray-100 text-black font-bold text-sm transition-colors flex items-center justify-center space-x-3 touch-target cursor-pointer shadow-md"
              >
                <GoogleIcon />
                <span>{lang.googleSignIn}</span>
              </button>
            </div>
            
          </form>

        </div>

      </div>
    </div>
  );
};

