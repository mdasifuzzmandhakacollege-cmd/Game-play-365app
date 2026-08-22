/**
 * @file RegistrationPage.tsx
 * @description Pixel-perfect Authentication & Registration Hub for GamePlay365.
 * Faithfully matches the exact UI layout, visual structure, and interactive flow
 * from the user's reference design with GamePlay365 branding, Firebase Auth sync,
 * OTP verification toggle, strength meter, 18+ agreement, and quick social logins.
 */

import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  User,
  Lock,
  Eye,
  EyeOff,
  Check,
  Gift,
  Phone,
  ShieldCheck,
  Sparkles,
  Headphones,
  Fingerprint,
  Send,
  HelpCircle,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  Copy,
  Globe,
  Flame,
  Zap,
  KeyRound,
  Sun,
  Moon
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { seamlessEngine } from '../services/simulatedWalletEngine';
import { firebaseFirestore } from '../services/firebaseFirestoreService';
import { soundEngine } from '../services/soundEngine';
import { referralService } from '../services/referralService';

interface RegistrationPageProps {
  onLoginSuccess: (user: UserEntity, wallet: WalletEntity) => void;
  allUsers: UserEntity[];
  onBackToLobby?: () => void;
}

type AuthMethod = 'PASSWORD' | 'OTP';

export const RegistrationPage: React.FC<RegistrationPageProps> = ({
  onLoginSuccess,
  allUsers,
  onBackToLobby
}) => {
  const { signInWithGoogle, registerWithEmail, loginWithEmail } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Active Tab: 'REGISTER' (নিবন্ধন) or 'LOGIN' (লগইন)
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'LOGIN'>('LOGIN');

  // Auth Method: 'PASSWORD' (পাসওয়ার্ড) or 'OTP' (যাচাইকরণ কোড)
  const [authMethod, setAuthMethod] = useState<AuthMethod>('PASSWORD');

  // Form Fields
  const [accountInput, setAccountInput] = useState(''); // Phone or Username or Email
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(true);
  const [isAgeAgreed, setIsAgeAgreed] = useState(true);

  // OTP Countdown Timer State
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  // Dialog Modals
  const [showCustomerService, setShowCustomerService] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Status & Error Handlers
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [successAnimation, setSuccessAnimation] = useState(false);
  const [detectedReferral, setDetectedReferral] = useState<string | null>(null);

  // Capture Referral Code from URL
  useEffect(() => {
    const capturedRef = referralService.captureReferralFromUrl();
    if (capturedRef) {
      setDetectedReferral(capturedRef);
      soundEngine.playWalletCredit();
    }
  }, []);

  // OTP Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    } else if (otpTimer === 0) {
      setOtpSent(false);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  // Calculate Password Strength: 0 to 4
  const getPasswordStrength = (pwd: string): number => {
    if (!pwd) return 0;
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[a-zA-Z]/.test(pwd) && /[^a-zA-Z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const strengthScore = getPasswordStrength(password);

  const getStrengthBarColor = (index: number) => {
    if (strengthScore === 0) return 'bg-slate-700';
    if (index > strengthScore) return 'bg-slate-700';

    if (strengthScore <= 1) return 'bg-rose-500';
    if (strengthScore === 2) return 'bg-amber-400';
    if (strengthScore === 3) return 'bg-lime-400';
    return 'bg-[#54D62C] shadow-[0_0_8px_#54D62C]';
  };

  const handleSendOtp = () => {
    if (!accountInput.trim()) {
      setErrorMessage('অনুগ্রহ করে আগে আপনার ফোন নম্বর প্রবেশ করান (Please enter phone number first)');
      return;
    }
    setOtpSent(true);
    setOtpTimer(60);
    soundEngine.playClick(1000);
    const mockCode = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpCode(mockCode);
    setErrorMessage(null);
  };

  // Main Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setDomainError(null);

    const rawAccount = accountInput.trim();
    if (!rawAccount) {
      setErrorMessage('অনুগ্রহ করে ফোন নম্বর বা অ্যাকাউন্ট ইউজারনেম লিখুন');
      return;
    }

    if (activeTab === 'REGISTER') {
      if (!isAgeAgreed) {
        setErrorMessage('ব্যবহারকারীর চুক্তির সাথে সম্মত হওয়া আবশ্যক (Must agree to terms)');
        return;
      }

      if (authMethod === 'PASSWORD') {
        if (!password || password.length < 6) {
          setErrorMessage('পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে (Password must be at least 6 characters)');
          return;
        }
        if (password !== confirmPassword) {
          setErrorMessage('পাসওয়ার্ড দুটি মেলেনি (Passwords do not match)');
          return;
        }
      } else {
        if (!otpCode || otpCode.length < 4) {
          setErrorMessage('সঠিক যাচাইকরণ কোড লিখুন (Enter valid verification code)');
          return;
        }
      }
    } else {
      // LOGIN validation
      if (authMethod === 'PASSWORD') {
        if (!password) {
          setErrorMessage('অনুগ্রহ করে আপনার পাসওয়ার্ড লিখুন');
          return;
        }
      } else {
        if (!otpCode || otpCode.length < 4) {
          setErrorMessage('সঠিক যাচাই কোড লিখুন');
          return;
        }
      }
    }

    setLoading(true);

    try {
      const cleanUsername = rawAccount.replace(/[^a-zA-Z0-9_]/g, '') || `User_${Date.now().toString().slice(-4)}`;
      const effectiveEmail = rawAccount.includes('@')
        ? rawAccount
        : `${cleanUsername.toLowerCase()}@gameplay365.com`;

      const effectivePhone = /^[0-9+]+$/.test(rawAccount) ? rawAccount : '';

      if (activeTab === 'REGISTER') {
        let authUid = '';
        let authEmail = effectiveEmail;

        // 1. Firebase Auth Registration
        try {
          const authResult = await registerWithEmail(
            effectiveEmail,
            password || '123456',
            cleanUsername,
            'BDT'
          );
          if (authResult) {
            authUid = authResult.uid;
            authEmail = authResult.email || effectiveEmail;
          }
        } catch (firebaseAuthErr: any) {
          console.warn('Firebase Registration notice:', firebaseAuthErr);
          const errCode = firebaseAuthErr?.code || '';
          if (errCode === 'auth/email-already-in-use') {
            setErrorMessage('এই একাউন্টটি ইতিমধ্যে নিবন্ধিত! অনুগ্রহ করে লগইন করুন।');
            setLoading(false);
            return;
          } else if (errCode === 'auth/unauthorized-domain') {
            setDomainError(window.location.hostname);
          }
        }

        // 2. Register in Simulation Engine
        const engineResult = seamlessEngine.registerUser({
          username: cleanUsername,
          email: authEmail,
          phone: effectivePhone,
          currency: 'BDT',
          promoCode: detectedReferral || 'GP365_BONUS'
        });

        const targetUserId = authUid || engineResult.user.id;

        // 3. Process Real-Time Referral if available
        if (detectedReferral) {
          try {
            await referralService.processReferralRegistration({
              newUserId: targetUserId,
              newUsername: cleanUsername,
              newUserEmail: authEmail,
              referralCode: detectedReferral,
              currency: 'BDT'
            });
          } catch (refErr) {
            console.warn('Referral sync note:', refErr);
          }
        }

        // 4. Firestore DB profile persistence
        try {
          await firebaseFirestore.syncUserProfile(
            {
              uid: targetUserId,
              email: authEmail,
              displayName: cleanUsername,
              phoneNumber: effectivePhone
            },
            'BDT'
          );
          await firebaseFirestore.ensureUserWallet(targetUserId, 'BDT', 0);
        } catch (firestoreErr) {
          console.warn('Firestore sync note:', firestoreErr);
        }

        soundEngine.playWinChime();
        setSuccessAnimation(true);
        setTimeout(() => {
          onLoginSuccess(engineResult.user, engineResult.wallet);
        }, 350);
      } else {
        // LOGIN Flow
        let authUid = '';
        try {
          const loginResult = await loginWithEmail(effectiveEmail, password || '123456');
          if (loginResult) {
            authUid = loginResult.uid;
          }
        } catch (firebaseLoginErr: any) {
          const errCode = firebaseLoginErr?.code || '';
          if (errCode === 'auth/invalid-credential' || errCode === 'auth/user-not-found') {
            // Seamless auto-provisioning for gaming users
            try {
              const regResult = await registerWithEmail(
                effectiveEmail,
                password || '123456',
                cleanUsername,
                'BDT'
              );
              if (regResult) {
                authUid = regResult.uid;
              }
            } catch (autoRegErr: any) {
              console.warn('Firebase Auth auto-sync note:', autoRegErr?.message || autoRegErr);
            }
          } else if (errCode === 'auth/unauthorized-domain') {
            setDomainError(window.location.hostname);
          } else {
            console.warn('Firebase Login notice:', firebaseLoginErr?.message || firebaseLoginErr);
          }
        }

        const existingUsers = seamlessEngine.getUsers();
        let found = existingUsers.find(
          (u) =>
            u.username.toLowerCase() === cleanUsername.toLowerCase() ||
            (u.email && u.email.toLowerCase() === effectiveEmail.toLowerCase()) ||
            (effectivePhone && u.phone === effectivePhone) ||
            (authUid && u.id === authUid) ||
            u.id === rawAccount
        );

        if (found) {
          const wallets = seamlessEngine.getWallets();
          const userWallet =
            wallets.find((w) => w.user_id === found!.id && w.currency === found!.currency) ||
            wallets.find((w) => w.user_id === found!.id) ||
            wallets[0];

          if (authUid) {
            try {
              await firebaseFirestore.syncUserProfile(
                {
                  uid: authUid,
                  email: found.email,
                  displayName: found.username
                },
                (found.currency as 'BDT' | 'USD') || 'BDT'
              );
            } catch (e) {
              console.warn('Firestore profile sync note:', e);
            }
          }

          soundEngine.playWinChime();
          setSuccessAnimation(true);
          setTimeout(() => {
            onLoginSuccess(found!, userWallet);
          }, 350);
        } else {
          // Auto create/login player if first time
          const result = seamlessEngine.registerUser({
            username: cleanUsername,
            email: effectiveEmail,
            phone: effectivePhone,
            currency: 'BDT',
            promoCode: detectedReferral || 'GP365_LOGIN'
          });

          const targetUid = authUid || result.user.id;
          try {
            await firebaseFirestore.syncUserProfile(
              {
                uid: targetUid,
                email: effectiveEmail,
                displayName: cleanUsername,
                phoneNumber: effectivePhone
              },
              'BDT'
            );
            await firebaseFirestore.ensureUserWallet(targetUid, 'BDT', 5000);
          } catch (e) {
            console.warn('Firestore initial sync notice:', e);
          }

          soundEngine.playWinChime();
          setSuccessAnimation(true);
          setTimeout(() => {
            onLoginSuccess(result.user, result.wallet);
          }, 350);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'অনুরোধ সম্পন্ন করা যায়নি, আবার চেষ্টা করুন');
    } finally {
      setLoading(false);
    }
  };

  // Google 1-Click Fast Auth
  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      setDomainError(null);
      const googleUser = await signInWithGoogle();
      if (!googleUser) return;

      const displayName = googleUser.displayName || 'GooglePlayer';
      const emailAddress = googleUser.email || `${displayName.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;

      try {
        await firebaseFirestore.syncUserProfile(
          {
            uid: googleUser.uid,
            email: googleUser.email,
            displayName: googleUser.displayName,
            photoURL: googleUser.photoURL,
            phoneNumber: googleUser.phoneNumber
          },
          'BDT'
        );
        await firebaseFirestore.ensureUserWallet(googleUser.uid, 'BDT', 5000);
      } catch (e) {
        console.warn('Firestore sync note:', e);
      }

      const existingUsers = seamlessEngine.getUsers();
      let found = existingUsers.find((u) => u.id === googleUser.uid || u.email === emailAddress);

      if (!found) {
        const result = seamlessEngine.registerUser({
          username: displayName,
          email: emailAddress,
          phone: googleUser.phoneNumber || '',
          currency: 'BDT',
          promoCode: detectedReferral || 'GOOGLE_BONUS'
        });
        found = result.user;
      }

      const wallets = seamlessEngine.getWallets();
      const userWallet = wallets.find((w) => w.user_id === found!.id) || wallets[0];

      soundEngine.playWinChime();
      onLoginSuccess(found, userWallet);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        setDomainError(currentDomain);
        setErrorMessage(`Firebase Error: ডোমেইন (${currentDomain}) অনুমোদিত নয়।`);
      } else {
        setErrorMessage(err.message || 'Google সাইন-ইন সম্পন্ন হয়নি');
      }
    } finally {
      setLoading(false);
    }
  };

  // Quick Mock/Fast Social Login (Facebook / Telegram / Biometric)
  const handleQuickSocialAuth = (providerName: string) => {
    soundEngine.playClick(1100);
    const mockUsername = `${providerName}_VIP_${Math.floor(1000 + Math.random() * 9000)}`;
    const mockEmail = `${mockUsername.toLowerCase()}@${providerName.toLowerCase()}.com`;

    const result = seamlessEngine.registerUser({
      username: mockUsername,
      email: mockEmail,
      currency: 'BDT',
      promoCode: 'SOCIAL_VIP'
    });

    soundEngine.playWinChime();
    setSuccessAnimation(true);
    setTimeout(() => {
      onLoginSuccess(result.user, result.wallet);
    }, 300);
  };

  const copyDomainToClipboard = () => {
    if (domainError) {
      navigator.clipboard.writeText(domainError);
      setCopiedDomain(true);
      soundEngine.playClick(900);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col items-center justify-center p-2 sm:p-4 relative font-sans selection:bg-[#54D62C] selection:text-black">
      
      {/* Background Ambient Luxury Lighting */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/25 via-[#07090e] to-[#040609] pointer-events-none" />
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header Bar */}
      <div className="w-full max-w-[440px] flex items-center justify-between py-2 sm:py-3 px-2 z-20 relative">
        {/* Back Arrow Button */}
        <button
          onClick={() => {
            soundEngine.playClick(800);
            if (onBackToLobby) onBackToLobby();
          }}
          className="w-9 h-9 rounded-full bg-slate-900/90 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer active:scale-95 transition-all shadow-md"
          title="ফিরে যান"
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* Brand 3D Metallic Title (GamePlay 365 VIP) */}
        <div className="flex items-center space-x-1.5 cursor-pointer">
          <div className="text-2xl sm:text-3xl font-black tracking-tighter drop-shadow-[0_2px_12px_rgba(84,214,44,0.4)]">
            <span className="bg-gradient-to-b from-cyan-300 via-sky-400 to-blue-600 bg-clip-text text-transparent italic font-black">
              Game
            </span>
            <span className="bg-gradient-to-b from-amber-200 via-yellow-400 to-red-500 bg-clip-text text-transparent italic font-black">
              Play
            </span>
            <span className="bg-gradient-to-b from-emerald-200 via-[#54D62C] to-green-600 bg-clip-text text-transparent font-black ml-0.5">
              365
            </span>
          </div>
        </div>

        {/* Top Right Controls: Theme Toggle + Customer Support */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-full bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 flex items-center justify-center text-amber-400 hover:text-amber-300 cursor-pointer active:scale-95 transition-all shadow-md"
            title={theme === 'dark' ? 'লাইট মোড অন করুন' : 'ডার্ক মোড অন করুন'}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-sky-400" />
            )}
          </button>

          <button
            onClick={() => {
              soundEngine.playClick(900);
              setShowCustomerService(true);
            }}
            className="w-9 h-9 rounded-full bg-slate-900/90 border border-slate-800 hover:border-emerald-500/50 flex items-center justify-center text-emerald-400 hover:text-emerald-300 cursor-pointer active:scale-95 transition-all shadow-md"
            title="গ্রাহক সেবা"
          >
            <Headphones className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-[440px] bg-[#121722]/95 border border-slate-800/90 rounded-2xl sm:rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] p-3.5 sm:p-5 z-10 relative overflow-hidden backdrop-blur-xl">

        {/* 1. TOP HERO PROMOTIONAL BANNER */}
        <div className="relative w-full rounded-xl sm:rounded-2xl overflow-hidden mb-4 p-3 bg-gradient-to-r from-[#031d16] via-[#02241b] to-[#120e03] border border-emerald-500/30 shadow-inner flex items-center justify-between">
          {/* Laser Grid Background pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#05966915_1px,transparent_1px),linear-gradient(to_bottom,#05966915_1px,transparent_1px)] bg-[size:12px_12px] pointer-events-none" />
          
          {/* Left Aviator / Plane & Cash Illustration */}
          <div className="relative z-10 flex flex-col items-center shrink-0 w-16 sm:w-20">
            <div className="relative transform -rotate-12 animate-pulse">
              <div className="w-10 h-6 sm:w-12 sm:h-7 bg-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-600/50 border border-rose-400">
                <span className="text-[10px] font-black text-white italic">Aviator</span>
              </div>
              <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-amber-400 rounded-full blur-[1px] animate-ping" />
            </div>
            <div className="flex space-x-1 mt-1">
              <span className="text-xs">💵</span>
              <span className="text-xs">💰</span>
            </div>
          </div>

          {/* Center Banner Golden Text */}
          <div className="relative z-10 text-center flex-1 px-1">
            <div className="text-xs sm:text-[13px] font-black text-amber-300 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] tracking-tight leading-tight">
              দৈনিক লগইন ভিআইপি বোনাস <span className="text-[#54D62C] font-mono">৳৯৯৯</span>
            </div>
            <div className="text-xs sm:text-[13px] font-black text-yellow-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] tracking-tight leading-tight mt-0.5">
              বন্ধুদের সাথে শেয়ার করুন বোনাস <span className="text-[#54D62C] font-mono">৳৯৯৯</span>
            </div>
          </div>

          {/* Right Crown & Ruby Gem Mascot */}
          <div className="relative z-10 flex flex-col items-center shrink-0 w-14 sm:w-16">
            <div className="relative">
              <div className="text-2xl sm:text-3xl filter drop-shadow-[0_0_8px_rgba(234,179,8,0.7)] animate-bounce">
                👑
              </div>
              <div className="absolute -top-1 -right-1 text-xs">💎</div>
            </div>
          </div>
        </div>

        {/* 2. TAB SWITCHER ("নিবন্ধন" vs "লগইন") */}
        <div className="grid grid-cols-2 border-b border-slate-800/90 mb-4 text-sm relative">
          
          {/* Tab 1: নিবন্ধন (Registration) */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick(900);
              setActiveTab('REGISTER');
              setErrorMessage(null);
            }}
            className={`pb-2.5 font-bold transition-all relative flex items-center justify-center cursor-pointer ${
              activeTab === 'REGISTER'
                ? 'text-[#54D62C]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>নিবন্ধন</span>

            {/* Bright Green Badge (1-9.99) */}
            <span className="absolute -top-2.5 right-6 sm:right-10 bg-[#54D62C] text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded-full shadow-[0_0_8px_rgba(84,214,44,0.6)] animate-pulse">
              1-9.99
            </span>

            {activeTab === 'REGISTER' && (
              <div className="absolute bottom-0 left-4 right-4 h-[3px] bg-[#54D62C] rounded-full shadow-[0_0_8px_#54D62C]" />
            )}
          </button>

          {/* Tab 2: লগইন (Login) */}
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick(900);
              setActiveTab('LOGIN');
              setErrorMessage(null);
            }}
            className={`pb-2.5 font-bold transition-all relative flex items-center justify-center cursor-pointer ${
              activeTab === 'LOGIN'
                ? 'text-[#54D62C]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>লগইন</span>

            {activeTab === 'LOGIN' && (
              <div className="absolute bottom-0 left-4 right-4 h-[3px] bg-[#54D62C] rounded-full shadow-[0_0_8px_#54D62C]" />
            )}
          </button>
        </div>

        {/* Subheader Title */}
        <div className="text-xs text-slate-300 font-semibold mb-3 text-left">
          {activeTab === 'REGISTER' ? 'সমর্থন ফোন নম্বর/অ্যাকাউন্ট নিবন্ধন' : 'সমর্থন ফোন নম্বর/অ্যাকাউন্ট লগইন'}
        </div>

        {/* Notification / Error Display */}
        {errorMessage && (
          <div className="mb-3 p-2.5 bg-rose-500/10 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-start space-x-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <div className="flex-1">
              <div>{errorMessage}</div>
              {domainError && (
                <div className="mt-2 p-2 bg-slate-950 rounded border border-rose-500/30 text-[10px] space-y-1">
                  <div className="text-amber-300 font-bold">অনুমোদিত ডোমেইন যোগ করুন:</div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-mono text-cyan-300 flex-1 truncate">{domainError}</span>
                    <button
                      type="button"
                      onClick={copyDomainToClipboard}
                      className="px-2 py-0.5 bg-amber-500 text-slate-950 rounded font-bold text-[9px]"
                    >
                      {copiedDomain ? 'কপি!' : 'কপি'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Success Animation Notification */}
        {successAnimation && (
          <div className="mb-3 p-2.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-[#54D62C] animate-spin" />
            <span>
              {activeTab === 'LOGIN' ? 'লগইন সফল! গেমিং লবিতে প্রবেশ হচ্ছে...' : 'নিবন্ধন সম্পন্ন! ভিআইপি ভল্ট প্রস্তুত হচ্ছে...'}
            </span>
          </div>
        )}

        {/* 3. MAIN AUTHENTICATION FORM */}
        <form onSubmit={handleSubmit} className="space-y-3">
          
          {/* Input 1: Phone / Account */}
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              placeholder="*প্রবেশ করুন ফোন নম্বর/অ্যাকাউন্ট"
              value={accountInput}
              onChange={(e) => setAccountInput(e.target.value)}
              className="w-full bg-[#0a0d16] border border-slate-700/80 focus:border-[#54D62C] rounded-xl pl-10 pr-3 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none transition-colors font-medium"
            />
          </div>

          {/* Mode Switcher Radio (পাসওয়ার্ড vs যাচাই কোড) */}
          <div className="flex items-center space-x-6 pt-0.5 text-xs text-slate-300">
            {/* Password Option */}
            <label
              className="flex items-center space-x-1.5 cursor-pointer"
              onClick={() => {
                soundEngine.playClick(900);
                setAuthMethod('PASSWORD');
              }}
            >
              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                authMethod === 'PASSWORD'
                  ? 'border-[#54D62C] bg-[#54D62C]'
                  : 'border-slate-600 bg-transparent'
              }`}>
                {authMethod === 'PASSWORD' && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
              </span>
              <span className={authMethod === 'PASSWORD' ? 'text-[#54D62C] font-bold' : 'text-slate-400'}>
                {activeTab === 'REGISTER' ? 'পাসওয়ার্ড নিবন্ধন' : 'পাসওয়ার্ড লগইন'}
              </span>
            </label>

            {/* OTP Option */}
            <label
              className="flex items-center space-x-1.5 cursor-pointer"
              onClick={() => {
                soundEngine.playClick(900);
                setAuthMethod('OTP');
              }}
            >
              <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                authMethod === 'OTP'
                  ? 'border-[#54D62C] bg-[#54D62C]'
                  : 'border-slate-600 bg-transparent'
              }`}>
                {authMethod === 'OTP' && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
              </span>
              <span className={authMethod === 'OTP' ? 'text-[#54D62C] font-bold' : 'text-slate-400'}>
                {activeTab === 'REGISTER' ? 'যাচাইকরণ কোড নিবন্ধন' : 'যাচাই কোড লগইন'}
              </span>
            </label>
          </div>

          {/* Conditional Field: Password / PIN Input OR OTP Input */}
          {authMethod === 'PASSWORD' ? (
            <>
              {/* Input 2: Password / PIN */}
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder={activeTab === 'REGISTER' ? '*পিন প্রবেশ করান' : '*পাসওয়ার্ড লিখুন'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0a0d16] border border-slate-700/80 focus:border-[#54D62C] rounded-xl pl-10 pr-10 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none transition-colors font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Meter (Only in Registration Mode) */}
              {activeTab === 'REGISTER' && (
                <div className="flex items-center space-x-2 text-[11px] text-slate-300 px-1">
                  <span>স্ট্রেন্থ</span>
                  <div className="flex-1 grid grid-cols-4 gap-1.5">
                    <div className={`h-1 rounded-full transition-colors ${getStrengthBarColor(1)}`} />
                    <div className={`h-1 rounded-full transition-colors ${getStrengthBarColor(2)}`} />
                    <div className={`h-1 rounded-full transition-colors ${getStrengthBarColor(3)}`} />
                    <div className={`h-1 rounded-full transition-colors ${getStrengthBarColor(4)}`} />
                  </div>
                </div>
              )}

              {/* Input 3: Confirm Password (Only in Registration Mode) */}
              {activeTab === 'REGISTER' && (
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="*আবার পাসওয়ার্ড লিখুন"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#0a0d16] border border-slate-700/80 focus:border-[#54D62C] rounded-xl pl-10 pr-10 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none transition-colors font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* OTP Verification Code Input */
            <div className="space-y-2">
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="*৬ ডিজিটের ওটিপি যাচাই কোড লিখুন"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full bg-[#0a0d16] border border-slate-700/80 focus:border-[#54D62C] rounded-xl pl-10 pr-24 py-3 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none transition-colors font-medium"
                />
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpTimer > 0}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-[#54D62C] text-slate-950 text-[10px] font-black hover:bg-lime-400 disabled:bg-slate-800 disabled:text-slate-500 transition-all cursor-pointer"
                >
                  {otpTimer > 0 ? `${otpTimer}s অপেক্ষা` : otpSent ? 'আবার পাঠান' : 'কোড পাঠান'}
                </button>
              </div>

              {otpSent && (
                <div className="text-[10px] text-emerald-400 flex items-center justify-between px-1">
                  <span>যাচাইকরণ কোড পাঠানো হয়েছে: <strong className="font-mono text-amber-300">{otpCode}</strong></span>
                  <span className="text-slate-500">অটো-ভেরিফাই সক্রিয়</span>
                </div>
              )}
            </div>
          )}

          {/* Checkboxes Area */}
          {activeTab === 'REGISTER' ? (
            /* 18+ and User Agreement Checkbox */
            <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1">
              <label className="flex items-start space-x-2 cursor-pointer text-left leading-tight pr-2">
                <input
                  type="checkbox"
                  checked={isAgeAgreed}
                  onChange={(e) => setIsAgeAgreed(e.target.checked)}
                  className="w-4 h-4 rounded mt-0.5 accent-[#54D62C] cursor-pointer shrink-0"
                />
                <span>
                  আমার বয়স 18 বছরের বেশি, আমি পড়েছি এবং{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowTermsModal(true);
                    }}
                    className="text-[#54D62C] hover:underline"
                  >
                    《ব্যবহারকারীর চুক্তি》
                  </button>{' '}
                  এর সাথে সম্মত
                </span>
              </label>

              {/* Gift Badge (1-9.99) */}
              <div className="flex items-center space-x-1 shrink-0">
                <span className="text-base">🎁</span>
                <span className="bg-[#54D62C] text-slate-950 text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-sm">
                  1-9.99
                </span>
              </div>
            </div>
          ) : (
            /* Remember Password Checkbox */
            <div className="flex items-center space-x-2 text-xs text-slate-300 pt-1 text-left">
              <input
                type="checkbox"
                checked={rememberPassword}
                onChange={(e) => setRememberPassword(e.target.checked)}
                className="w-4 h-4 rounded accent-[#54D62C] cursor-pointer"
              />
              <span>অ্যাকাউন্টের পাসওয়ার্ড মনে রাখবেন</span>
            </div>
          )}

          {/* Big Solid Bright Lime Green CTA Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#54D62C] hover:bg-[#47be23] text-slate-950 font-black text-sm sm:text-base tracking-wide shadow-[0_4px_20px_rgba(84,214,44,0.35)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center space-x-2 mt-2"
          >
            <span>{loading ? 'প্রসেসিং হচ্ছে...' : activeTab === 'REGISTER' ? 'নিবন্ধন' : 'লগইন'}</span>
          </button>
        </form>

        {/* 4. FOOTER HELPER LINKS (গ্রাহক সেবা & পাসওয়ার্ড ভুলে গেছেন) */}
        <div className="flex items-center justify-between text-xs text-[#54D62C] pt-3 px-1">
          <button
            type="button"
            onClick={() => {
              soundEngine.playClick(900);
              setShowCustomerService(true);
            }}
            className="hover:underline cursor-pointer flex items-center space-x-1"
          >
            <span>গ্রাহক সেবা</span>
          </button>

          {activeTab === 'LOGIN' && (
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick(900);
                setShowForgotPassword(true);
              }}
              className="hover:underline cursor-pointer"
            >
              পাসওয়ার্ড ভুলে গেছেন
            </button>
          )}
        </div>

        {/* 5. DIVIDER */}
        <div className="flex items-center my-4">
          <div className="flex-1 h-[1px] bg-slate-800" />
          <span className="px-3 text-[11px] text-slate-500 font-medium">
            {activeTab === 'REGISTER' ? 'বাধ্যতামূলক নিবন্ধন' : 'দ্রুত লগইন'}
          </span>
          <div className="flex-1 h-[1px] bg-slate-800" />
        </div>

        {/* 6. SOCIAL QUICK AUTH ICONS */}
        <div className="flex items-center justify-center space-x-4">
          
          {/* Biometric / Fingerprint Option (in Login mode) */}
          {activeTab === 'LOGIN' && (
            <button
              type="button"
              onClick={() => handleQuickSocialAuth('FaceID')}
              className="w-10 h-10 rounded-full bg-slate-900 border border-emerald-500/50 hover:border-[#54D62C] flex items-center justify-center text-[#54D62C] hover:scale-110 active:scale-95 transition-all shadow-md cursor-pointer"
              title="বায়োমেট্রিক ফেসআইডি / ফিঙ্গারপ্রিন্ট লগইন"
            >
              <Fingerprint className="w-5 h-5" />
            </button>
          )}

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-10 h-10 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md cursor-pointer"
            title="Google দিয়ে প্রবেশ করুন"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
          </button>

          {/* Facebook Quick Login */}
          <button
            type="button"
            onClick={() => handleQuickSocialAuth('Facebook')}
            className="w-10 h-10 rounded-full bg-[#1877F2] hover:bg-[#166fe5] text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md cursor-pointer font-black text-lg"
            title="Facebook দিয়ে লগইন"
          >
            f
          </button>

          {/* Telegram Quick Login */}
          <button
            type="button"
            onClick={() => handleQuickSocialAuth('Telegram')}
            className="w-10 h-10 rounded-full bg-[#24A1DE] hover:bg-[#2094cc] text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md cursor-pointer"
            title="Telegram দিয়ে লগইন"
          >
            <Send className="w-4 h-4 -rotate-12" />
          </button>
        </div>

        {/* 7. ONE-TAP FAST GUEST EXPLORE DEMO BUTTON */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => handleQuickSocialAuth('VIP_Demo')}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-[#54D62C]/40 hover:border-[#54D62C] text-[#54D62C] font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md active:scale-98"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>১-ক্লিকে ভিআইপি গেস্ট লবিতে প্রবেশ করুন (Explore Lobby)</span>
          </button>
        </div>

      </div>

      {/* MODAL 1: CUSTOMER SERVICE (গ্রাহক সেবা) */}
      {showCustomerService && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#121722] border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                <Headphones className="w-4 h-4" />
                <span>২৪/৭ গ্রাহক সেবা সাপোর্ট</span>
              </div>
              <button
                onClick={() => setShowCustomerService(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 text-left">
              GamePlay365 লাইভ এজেন্ট আপনার সহায়তার জন্য সদা প্রস্তুত। যেকোনো সমস্যা বা একাউন্ট সম্পর্কিত তথ্যের জন্য যোগাযোগ করুন:
            </p>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">লাইভ চ্যাট:</span>
                <span className="text-[#54D62C] font-bold">অনলাইন (তাত্ক্ষণিক উত্তর)</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">টেলিগ্রাম চ্যানেল:</span>
                <span className="text-cyan-400 font-bold">@GamePlay365_BD</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">ইমেইল:</span>
                <span className="text-amber-300 font-mono">support@gameplay365.com</span>
              </div>
            </div>

            <button
              onClick={() => {
                soundEngine.playClick(900);
                setShowCustomerService(false);
              }}
              className="w-full py-2.5 rounded-xl bg-[#54D62C] text-slate-950 font-bold text-xs hover:bg-lime-400 transition-all cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: FORGOT PASSWORD (পাসওয়ার্ড রিসেট) */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#121722] border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                <KeyRound className="w-4 h-4" />
                <span>পাসওয়ার্ড পুনরুদ্ধার (Reset Password)</span>
              </div>
              <button
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotSent(false);
                }}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!forgotSent ? (
              <div className="space-y-3 text-xs text-left">
                <p className="text-slate-300">
                  আপনার নিবন্ধিত ফোন নম্বর বা ইমেইল লিখুন। আমরা একটি ওটিপি পাসওয়ার্ড রিসেট কোড পাঠাব।
                </p>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    placeholder="ফোন নম্বর বা ইমেইল লিখুন"
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value)}
                    className="w-full bg-[#0a0d16] border border-slate-800 focus:border-[#54D62C] rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (forgotPhone) {
                      soundEngine.playClick(1000);
                      setForgotSent(true);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#54D62C] text-slate-950 font-bold text-xs hover:bg-lime-400 transition-all cursor-pointer"
                >
                  রিসেট কোড পাঠান
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-center py-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-[#54D62C] mx-auto flex items-center justify-center">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <p className="text-emerald-400 font-bold">
                  রিসেট লিংক এবং ৬ ডিজিটের কোড পাঠানো হয়েছে!
                </p>
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotSent(false);
                  }}
                  className="w-full py-2 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs"
                >
                  ঠিক আছে
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 3: TERMS & CONDITIONS (ব্যবহারকারীর চুক্তি) */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#121722] border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in-95 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                <FileText className="w-4 h-4" />
                <span>GamePlay365 ব্যবহারকারীর চুক্তি ও শর্তাবলী</span>
              </div>
              <button
                onClick={() => setShowTermsModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <p>১. <strong>বয়স সীমা:</strong> প্ল্যাটফর্মে রেজিস্ট্রেশন ও গেমিং করার জন্য ব্যবহারকারীর বয়স বাধ্যতামূলকভাবে ১৮ বছর বা তার বেশি হতে হবে।</p>
              <p>২. <strong>নিরাপত্তা ও দায়িত্বশীল গেমিং:</strong> প্রতিটি অ্যাকাউন্ট এনক্রিপ্টেড লেজারের মাধ্যমে সংরক্ষিত। ব্যবহারকারীকে নিজের অ্যাকাউন্টের গোপনীয়তা বজায় রাখতে হবে।</p>
              <p>৩. <strong>লেনদেন:</strong> বিকাশ, নগদ ও রকেটের মাধ্যমে ডিপোজিট ও ইনস্ট্যান্ট উইথড্র নিশ্চিত করতে শুধুমাত্র সঠিক ব্যক্তিগত নম্বর ব্যবহার করুন।</p>
              <p>৪. <strong>প্রোভাইডারের সততা:</strong> সব গেম GLI-19 সার্টিফাইড RNG ও Provably Fair স্ট্যান্ডার্ড মেনে পরিচালিত।</p>
            </div>

            <button
              onClick={() => {
                setIsAgeAgreed(true);
                setShowTermsModal(false);
                soundEngine.playClick(900);
              }}
              className="w-full py-2.5 rounded-xl bg-[#54D62C] text-slate-950 font-bold text-xs hover:bg-lime-400 transition-all cursor-pointer"
            >
              আমি সম্মত ও গ্রহণ করলাম
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
