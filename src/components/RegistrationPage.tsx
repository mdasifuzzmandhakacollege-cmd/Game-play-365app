/**
 * @file RegistrationPage.tsx
 * @description Premium Authentication & User Onboarding Hub for Playall 365.
 * Designed with elegant proportions, harmonious luxury color palette, responsive mobile layout,
 * real-time URL referral parameter capture (?ref=username), automatic referral validation,
 * and direct Firebase Auth & Firestore synchronization.
 */

import React, { useState, useEffect } from 'react';
import {
  Crown,
  Sparkles,
  ShieldCheck,
  Zap,
  Flame,
  ArrowRight,
  User,
  Mail,
  Phone,
  Lock,
  Coins,
  Gift,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  Play,
  TrendingUp,
  CreditCard,
  Copy,
  Check,
  Globe,
  Award,
  CircleDollarSign,
  ChevronRight,
  ShieldAlert,
  Sliders,
  DollarSign,
  Share2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { seamlessEngine } from '../services/simulatedWalletEngine';
import { firebaseFirestore } from '../services/firebaseFirestoreService';
import { soundEngine } from '../services/soundEngine';
import { referralService } from '../services/referralService';

interface RegistrationPageProps {
  onLoginSuccess: (user: UserEntity, wallet: WalletEntity) => void;
  allUsers: UserEntity[];
}

export const RegistrationPage: React.FC<RegistrationPageProps> = ({
  onLoginSuccess,
  allUsers
}) => {
  const { signInWithGoogle, registerWithEmail, loginWithEmail } = useAuth();

  // Mode: 'REGISTER' | 'LOGIN'
  const [authMode, setAuthMode] = useState<'REGISTER' | 'LOGIN'>('REGISTER');

  // Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currency, setCurrency] = useState<'BDT' | 'USD'>('BDT');
  const [promoCode, setPromoCode] = useState('WELCOME365');
  const [detectedReferral, setDetectedReferral] = useState<string | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [successAnimation, setSuccessAnimation] = useState(false);

  // Live Jackpot & Recent Activity Ticker
  const [liveJackpot, setLiveJackpot] = useState(15842900);
  const [recentWin, setRecentWin] = useState({
    name: 'Tanvir_Pro',
    amount: '৳48,500',
    game: 'Aviator 12.8x'
  });

  // Capture Real-time Referral Code on Mount
  useEffect(() => {
    const capturedRef = referralService.captureReferralFromUrl();
    if (capturedRef) {
      setPromoCode(capturedRef);
      setDetectedReferral(capturedRef);
      soundEngine.playWalletCredit();
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveJackpot((prev) => prev + Math.floor(Math.random() * 25) + 15);
    }, 1800);

    const winUpdates = [
      { name: 'Tanvir_Pro', amount: '৳48,500', game: 'Aviator 12.8x 🚀' },
      { name: 'Sakib_Gamer', amount: '৳125,000', game: 'Sweet Bonanza 🍬' },
      { name: 'Rahim_Elite', amount: '৳35,200', game: 'Lightning Roulette ⚡' },
      { name: 'Nafis_777', amount: '৳89,000', game: 'Gates of Olympus ⚡' },
      { name: 'Fahim_Win', amount: '৳62,400', game: 'Crazy Time 🎡' }
    ];

    let winIdx = 0;
    const winInterval = setInterval(() => {
      winIdx = (winIdx + 1) % winUpdates.length;
      setRecentWin(winUpdates[winIdx]);
    }, 4000);

    return () => {
      clearInterval(interval);
      clearInterval(winInterval);
    };
  }, []);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setDomainError(null);

    if (!username.trim() || username.length < 3) {
      setErrorMessage('ইউজারনেম অন্তত ৩ অক্ষরের হতে হবে (Username must be at least 3 characters)');
      return;
    }

    const effectiveEmail =
      email.trim() ||
      `${username.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@playall365.com`;

    if (authMode === 'REGISTER' && (!effectiveEmail || !effectiveEmail.includes('@'))) {
      setErrorMessage('একটি সঠিক ইমেইল এড্রেস প্রদান করুন (Please enter a valid email)');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে (Password must be at least 6 characters)');
      return;
    }

    if (authMode === 'REGISTER' && password !== confirmPassword) {
      setErrorMessage('পাসওয়ার্ড দুটি মেলেনি (Passwords do not match)');
      return;
    }

    setLoading(true);

    try {
      if (authMode === 'REGISTER') {
        let authUid = '';
        let authEmail = effectiveEmail;

        // 1. Firebase Authentication with Local Persistence
        try {
          const authResult = await registerWithEmail(
            effectiveEmail,
            password,
            username.trim(),
            currency
          );
          if (authResult) {
            authUid = authResult.uid;
            authEmail = authResult.email || effectiveEmail;
          }
        } catch (firebaseAuthErr: any) {
          console.warn('Firebase Auth Registration notice:', firebaseAuthErr);
          const errCode = firebaseAuthErr?.code || '';
          if (errCode === 'auth/email-already-in-use') {
            setErrorMessage(
              'এই ইমেইলটি ইতিমধ্যে নিবন্ধিত! অনুগ্রহ করে লগইন করুন (Email already in use, please sign in)'
            );
            setLoading(false);
            return;
          } else if (errCode === 'auth/unauthorized-domain') {
            setDomainError(window.location.hostname);
            setErrorMessage(
              `ডোমেইনটি ফায়ারবেসে অনুমোদিত নয় (auth/unauthorized-domain)। ফায়ারবেস কনসোলে Authorized Domains-এ ${window.location.hostname} যুক্ত করুন।`
            );
          } else if (errCode === 'auth/weak-password') {
            setErrorMessage(
              'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে (Password must be at least 6 characters)'
            );
            setLoading(false);
            return;
          } else if (errCode === 'auth/invalid-email') {
            setErrorMessage('ইমেইল ফরম্যাট সঠিক নয় (Invalid email format)');
            setLoading(false);
            return;
          }
        }

        // 2. Register & Allocate Initial Vault in Engine
        const engineResult = seamlessEngine.registerUser({
          username: username.trim(),
          email: authEmail,
          phone: phone.trim(),
          currency: currency,
          promoCode: promoCode.trim()
        });

        const targetUserId = authUid || engineResult.user.id;

        // 3. Process Real-Time Referral Registration
        try {
          await referralService.processReferralRegistration({
            newUserId: targetUserId,
            newUsername: username.trim(),
            newUserEmail: authEmail,
            referralCode: promoCode.trim(),
            currency: currency
          });
        } catch (refErr) {
          console.warn('Referral processing note:', refErr);
        }

        // 4. Sync to Real Firestore Enterprise Database
        try {
          await firebaseFirestore.syncUserProfile(
            {
              uid: targetUserId,
              email: authEmail,
              displayName: username.trim(),
              phoneNumber: phone.trim()
            },
            currency
          );
          await firebaseFirestore.ensureUserWallet(targetUserId, currency, 5000);
        } catch (firestoreErr) {
          console.warn('Firestore sync notice:', firestoreErr);
        }

        soundEngine.playWinChime();
        setSuccessAnimation(true);
        setTimeout(() => {
          onLoginSuccess(engineResult.user, engineResult.wallet);
        }, 400);
      } else {
        // Sign In Flow
        let authUid = '';
        try {
          const loginResult = await loginWithEmail(effectiveEmail, password);
          if (loginResult) {
            authUid = loginResult.uid;
          }
        } catch (firebaseLoginErr: any) {
          console.warn('Firebase Login notice:', firebaseLoginErr);
          const errCode = firebaseLoginErr?.code || '';
          if (errCode === 'auth/unauthorized-domain') {
            setDomainError(window.location.hostname);
          }
        }

        const existingUsers = seamlessEngine.getUsers();
        let found = existingUsers.find(
          (u) =>
            u.username.toLowerCase() === username.trim().toLowerCase() ||
            (u.email && u.email.toLowerCase() === effectiveEmail.toLowerCase()) ||
            (authUid && u.id === authUid) ||
            u.id === username.trim()
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
              console.warn('Firestore profile sync error on login:', e);
            }
          }

          soundEngine.playWinChime();
          setSuccessAnimation(true);
          setTimeout(() => {
            onLoginSuccess(found!, userWallet);
          }, 400);
        } else {
          // Register automatically if new
          const result = seamlessEngine.registerUser({
            username: username.trim(),
            email: effectiveEmail,
            phone: phone.trim(),
            currency: currency,
            promoCode: promoCode.trim()
          });

          const targetUid = authUid || result.user.id;

          try {
            await referralService.processReferralRegistration({
              newUserId: targetUid,
              newUsername: username.trim(),
              newUserEmail: effectiveEmail,
              referralCode: promoCode.trim(),
              currency: currency
            });
          } catch (refErr) {
            console.warn('Referral auto processing notice:', refErr);
          }

          try {
            await firebaseFirestore.syncUserProfile(
              {
                uid: targetUid,
                email: effectiveEmail,
                displayName: username.trim(),
                phoneNumber: phone.trim()
              },
              currency
            );
          } catch (e) {
            console.warn('Firestore initial registration sync notice:', e);
          }

          soundEngine.playWinChime();
          setSuccessAnimation(true);
          setTimeout(() => {
            onLoginSuccess(result.user, result.wallet);
          }, 400);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'অ্যাক্সেস ব্যর্থ হয়েছে (Login / Registration failed)');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      setDomainError(null);
      const googleUser = await signInWithGoogle();

      if (!googleUser) {
        throw new Error('Google Sign-In was cancelled or failed.');
      }

      const displayName = googleUser?.displayName || 'GooglePlayer';
      const emailAddress =
        googleUser?.email ||
        `${displayName.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;

      // 1. Sync to Firebase Firestore Database
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
      } catch (firestoreErr) {
        console.warn('Firestore Google User sync notice:', firestoreErr);
      }

      // 2. Sync to Seamless Engine
      const existingUsers = seamlessEngine.getUsers();
      let foundUser = existingUsers.find(
        (u) =>
          u.id === googleUser.uid ||
          (u.email && u.email.toLowerCase() === emailAddress.toLowerCase()) ||
          u.username.toLowerCase() === displayName.toLowerCase()
      );

      if (!foundUser) {
        const result = seamlessEngine.registerUser({
          username: displayName,
          email: emailAddress,
          phone: googleUser?.phoneNumber || '',
          currency: 'BDT',
          promoCode: promoCode || 'GOOGLE_OFFICIAL'
        });
        foundUser = result.user;

        // Process referral reward
        try {
          await referralService.processReferralRegistration({
            newUserId: foundUser.id,
            newUsername: displayName,
            newUserEmail: emailAddress,
            referralCode: promoCode.trim(),
            currency: 'BDT'
          });
        } catch (refErr) {
          console.warn('Google Auth referral processing notice:', refErr);
        }
      }

      const wallets = seamlessEngine.getWallets();
      const userWallet = wallets.find((w) => w.user_id === foundUser.id) || wallets[0];

      soundEngine.playWinChime();
      onLoginSuccess(foundUser, userWallet);
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      const code = err?.code || '';
      if (code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        setDomainError(currentDomain);
        setErrorMessage(
          `Firebase Error: (auth/unauthorized-domain) - এই ডোমেইনটি (${currentDomain}) ফায়ারবেসে অনুমোদিত নয়।`
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setErrorMessage('Google সাইন-ইন পপআপ বন্ধ করা হয়েছে (Popup closed by user)');
      } else if (code === 'auth/popup-blocked') {
        setErrorMessage('ব্রাউজার পপআপ ব্লক করেছে, অনুগ্রহ করে পপআপ অনুমোদন করুন (Popup blocked)');
      } else {
        setErrorMessage(err.message || 'Google Sign-In failed');
      }
    } finally {
      setLoading(false);
    }
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
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-amber-400 selection:text-slate-950">
      {/* Visual Ambient Lighting Background */}
      <div className="absolute top-[-10%] left-[-5%] w-[60vw] max-w-[800px] h-[60vw] max-h-[800px] bg-gradient-to-br from-amber-500/15 via-yellow-600/5 to-transparent rounded-full blur-[140px] pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-[-15%] right-[-5%] w-[40vw] max-w-[600px] h-[40vw] max-h-[600px] bg-gradient-to-tl from-emerald-500/10 via-cyan-500/5 to-transparent rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px] opacity-15 pointer-events-none" />

      {/* Top Header */}
      <header className="relative z-20 border-b border-amber-500/20 bg-[#070b14]/90 backdrop-blur-2xl px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3.5">
          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-700 p-[1.5px] shadow-lg shadow-amber-500/25">
            <div className="w-full h-full bg-[#080d1a] rounded-[14px] flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-[#080d1a] flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
            </div>
          </div>
          
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-white font-sans">
                GamePlay<span className="text-transparent bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text">365</span>
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/40 text-[10px] font-mono font-bold text-amber-300 tracking-wider">
                OFFICIAL CASINO
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono tracking-wider">
              PREMIER SEAMLESS GAMING &amp; INSTANT CASHOUT
            </div>
          </div>
        </div>

        {/* Currency Switcher & Toggle */}
        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center bg-slate-950/90 border border-amber-500/30 rounded-xl p-1 font-mono text-xs">
            <button
              onClick={() => setCurrency('BDT')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                currency === 'BDT'
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ৳ BDT
            </button>
            <button
              onClick={() => setCurrency('USD')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                currency === 'USD'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              $ USD
            </button>
          </div>

          <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl font-mono text-xs text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span className="hidden sm:inline">256-Bit SSL Enforced</span>
            <span className="sm:hidden">SSL SECURE</span>
          </div>
        </div>
      </header>

      {/* Main Showcase Hero & Registration Container */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
          
          {/* Left Column: Casino Presentation, Progressive Jackpot & Value Props */}
          <div className="lg:col-span-7 space-y-6 text-left">
            
            {/* Live Indicator Pill */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs font-mono font-bold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>বাংলাদেশ ও আন্তর্জাতিক গেমিং প্ল্যাটফর্ম</span>
            </div>

            {/* Main Headline */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-5xl lg:text-[44px] font-black text-white leading-[1.18] font-sans tracking-tight">
                প্রিমিয়াম অনলাইন ক্যাসিনো ও <br />
                <span className="text-transparent bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-500 bg-clip-text">
                  ইনস্ট্যান্ট ক্যাশ-আউট সুবিধা
                </span>
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl font-sans">
                জনপ্রিয় <strong>Aviator (1000x)</strong>, <strong>Sweet Bonanza</strong>, এবং <strong>Live Roulette</strong> সহ হাজারো সার্টিফাইড গেম। বিকাশ, নগদ ও রকেটে সম্পূর্ণ সুরক্ষিত ও নিরবচ্ছিন্ন লেনদেন।
              </p>
            </div>

            {/* Jackpot & Live Metric Banner */}
            <div className="golden-ratio-card rounded-[24px] p-5 relative overflow-hidden border border-amber-500/30">
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] text-amber-400/90 font-mono uppercase tracking-wider font-bold flex items-center space-x-1.5">
                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                    <span>লাইভ প্রগ্রেসিভ জ্যাকপট</span>
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-transparent bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-400 bg-clip-text font-mono tracking-tight mt-1">
                    ৳ {liveJackpot.toLocaleString('en-US')}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    প্রতি সেকেন্ডে বৃদ্ধি পাচ্ছে • অটোমেটিক ড্রয়িং
                  </div>
                </div>

                <div className="bg-slate-950/80 border border-slate-800/90 p-3 rounded-xl font-mono text-xs sm:w-56 shrink-0">
                  <div className="text-[10px] text-slate-400 uppercase font-semibold flex items-center justify-between">
                    <span>সর্বশেষ বিজয়ী</span>
                    <span className="text-emerald-400 font-bold">LIVE</span>
                  </div>
                  <div className="text-white font-bold mt-1 truncate">{recentWin.name}</div>
                  <div className="flex items-center justify-between text-amber-400 font-black text-[13px] mt-0.5">
                    <span>{recentWin.amount}</span>
                    <span className="text-[10px] text-slate-400 font-normal">{recentWin.game}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
              <div className="bg-slate-950/70 border border-slate-800/90 hover:border-amber-500/40 p-3.5 rounded-2xl transition-all">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="font-bold text-white text-xs">দ্রুততম পে-আউট</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  বিকাশ ও নগদ অটোমেটিক গেটওয়ে
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/90 hover:border-amber-500/40 p-3.5 rounded-2xl transition-all">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="font-bold text-white text-xs">১০০% নিরাপদ লেজার</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  এনক্রিপ্টেড ডাটাবেজ সিকিউরিটি
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800/90 hover:border-amber-500/40 p-3.5 rounded-2xl transition-all">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2">
                  <Share2 className="w-4 h-4" />
                </div>
                <div className="font-bold text-white text-xs">রেফারেল বোনাস</div>
                <div className="text-[11px] text-slate-400 mt-1">
                  প্রতি রেফারে ৳৫০০ + আজীবন কমিশন
                </div>
              </div>
            </div>

          </div>

          {/* Right Column: Authentication & Referral Registration Form */}
          <div className="lg:col-span-5">
            <div className="relative golden-ratio-card rounded-[32px] p-6 sm:p-8 backdrop-blur-2xl border-2 border-amber-500/40 shadow-2xl">
              
              {/* Shimmer Accent Line */}
              <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

              {/* Form Navigation Tabs */}
              <div className="flex items-center bg-slate-950 p-1.5 rounded-2xl border border-slate-800 mb-5 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick(900);
                    setAuthMode('REGISTER');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    authMode === 'REGISTER'
                      ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>রেজিস্ট্রেশন (Register)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick(900);
                    setAuthMode('LOGIN');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    authMode === 'LOGIN'
                      ? 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>লগইন (Sign In)</span>
                </button>
              </div>

              {/* Detected Real-Time Referral Badge */}
              {detectedReferral && authMode === 'REGISTER' && (
                <div className="mb-4 p-3 bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border border-amber-400/50 rounded-2xl flex items-center space-x-2.5 text-amber-300 text-xs font-mono shadow-md">
                  <Gift className="w-4 h-4 text-amber-400 shrink-0 animate-bounce" />
                  <div className="text-left">
                    <span className="font-black text-white">🎉 রেফারেল সক্রিয়:</span> আপনি <strong className="text-amber-400">@{detectedReferral}</strong> এর ইনভাইটে বিশেষ ৳৫০০ বোনাস পাচ্ছেন!
                  </div>
                </div>
              )}

              {/* Error Notification */}
              {errorMessage && (
                <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-mono flex items-start space-x-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1 text-left">
                    <div>{errorMessage}</div>
                    {domainError && (
                      <div className="mt-2.5 p-2.5 bg-slate-950/80 border border-red-500/40 rounded-xl space-y-2 text-[11px]">
                        <div className="text-amber-300 font-bold flex items-center space-x-1.5">
                          <Globe className="w-3.5 h-3.5" />
                          <span>ফায়ারবেসে ডোমেইন অনুমোদন করুন:</span>
                        </div>
                        <p className="text-slate-300">
                          Firebase Console &gt; Authentication &gt; Authorized domains-এ এই ডোমেইনটি যোগ করুন:
                        </p>
                        <div className="flex items-center space-x-2 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-700">
                          <span className="font-mono text-cyan-300 select-all flex-1">{domainError}</span>
                          <button
                            type="button"
                            onClick={copyDomainToClipboard}
                            className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded font-bold text-[10px] flex items-center space-x-1 transition-all"
                          >
                            {copiedDomain ? <Check className="w-3 h-3 text-slate-950" /> : <Copy className="w-3 h-3 text-slate-950" />}
                            <span>{copiedDomain ? 'কপি হয়েছে!' : 'কপি করুন'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Success Notification */}
              {successAnimation && (
                <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-mono flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 animate-spin" />
                  <span>
                    {authMode === 'LOGIN'
                      ? 'লগইন সফল! ক্যাসিনো লবিতে প্রবেশ করা হচ্ছে...'
                      : 'রেজিস্ট্রেশন সম্পন্ন! ক্যাসিনো ভল্ট লোড হচ্ছে...'}
                  </span>
                </div>
              )}

              {/* Google 1-Click Fast Auth Button */}
              <div className="mb-5">
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-2xl bg-slate-950 hover:bg-slate-900 border border-amber-500/30 hover:border-amber-400/70 text-slate-100 text-xs font-mono font-bold flex items-center justify-center space-x-3 transition-all shadow-md group cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
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
                  <span>Google দিয়ে সরাসরি ১-ক্লিকে প্রবেশ করুন</span>
                </button>

                <div className="flex items-center my-4">
                  <div className="flex-1 h-[1px] bg-slate-800" />
                  <span className="px-3 text-[10px] font-mono text-slate-500 uppercase">অথবা ইমেইল/ইউজারনেম</span>
                  <div className="flex-1 h-[1px] bg-slate-800" />
                </div>
              </div>

              {/* Main Credentials Form */}
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5 font-mono text-xs">
                
                {/* Username Input */}
                <div>
                  <label className="block text-slate-300 mb-1 font-bold text-left">
                    ইউজারনেম (Username) *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-amber-500/70" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Shakib_777"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-3 py-3 text-white placeholder-slate-600 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Email Input */}
                {authMode === 'REGISTER' && (
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold text-left">
                      ইমেইল এড্রেস (Email Address) *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                      <input
                        type="email"
                        required
                        placeholder="yourname@gmail.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-3 py-3 text-white placeholder-slate-600 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* Mobile & Currency Row */}
                {authMode === 'REGISTER' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold text-left">
                        মোবাইল (বিকাশ / নগদ)
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                        <input
                          type="text"
                          placeholder="01XXXXXXXXX"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-3 py-3 text-white placeholder-slate-600 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1 font-bold text-left">
                        মুদ্রা (Currency)
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setCurrency('BDT')}
                          className={`py-2 rounded-lg font-bold transition-all ${
                            currency === 'BDT'
                              ? 'bg-amber-500 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          🇧🇩 BDT (৳)
                        </button>
                        <button
                          type="button"
                          onClick={() => setCurrency('USD')}
                          className={`py-2 rounded-lg font-bold transition-all ${
                            currency === 'USD'
                              ? 'bg-cyan-500 text-slate-950'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          🇺🇸 USD ($)
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Password Input */}
                <div>
                  <label className="block text-slate-300 mb-1 font-bold text-left">
                    পাসওয়ার্ড (Password) *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-10 py-3 text-white placeholder-slate-600 focus:outline-none transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                {authMode === 'REGISTER' && (
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold text-left">
                      পাসওয়ার্ড নিশ্চিত করুন (Confirm Password) *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-slate-950/90 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-3 py-3 text-white placeholder-slate-600 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* Referral Code / Promo Code Pill */}
                {authMode === 'REGISTER' && (
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold text-left flex items-center justify-between">
                      <span>রেফারেল বা প্রোমো কোড (Referral Code)</span>
                      <span className="text-amber-400 text-[10px]">বোনাস যুক্ত হবে</span>
                    </label>
                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center space-x-2">
                      <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                      <input
                        type="text"
                        placeholder="রেফারেল কোড লিখুন"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className="bg-transparent text-xs font-mono text-white uppercase focus:outline-none flex-1 placeholder-slate-600 font-bold"
                      />
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        +৳৫০০ বোনাস
                      </span>
                    </div>
                  </div>
                )}

                {/* 18+ Agreement */}
                {authMode === 'REGISTER' && (
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400 text-left pt-1">
                    <input
                      type="checkbox"
                      checked={termsAgreed}
                      onChange={(e) => setTermsAgreed(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <span>আমার বয়স ১৮+ বছর এবং আমি টার্মস ও কন্ডিশনসে সম্মত।</span>
                  </div>
                )}

                {/* Big Action Button */}
                <button
                  type="submit"
                  disabled={loading || (authMode === 'REGISTER' && !termsAgreed)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer mt-4"
                >
                  <span>
                    {loading
                      ? 'অ্যাকাউন্ট ভেরিফাই হচ্ছে...'
                      : authMode === 'REGISTER'
                      ? 'রেজিস্ট্রেশন করুন ও ১০,০০০ ৳ বোনাস নিন'
                      : 'লগইন করুন ও খেলুন'}
                  </span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </button>
              </form>

              {/* Supported Payment Gateways Footer inside Card */}
              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-center space-x-3 text-[11px] text-slate-400 font-mono">
                <span className="text-emerald-400 font-bold">bKash</span>
                <span>•</span>
                <span className="text-orange-400 font-bold">Nagad</span>
                <span>•</span>
                <span className="text-purple-400 font-bold">Rocket</span>
                <span>•</span>
                <span className="text-cyan-400 font-bold">USDT</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 bg-[#06080d] border-t border-amber-500/20 py-4 px-4 text-center text-xs text-slate-400 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-300 font-bold">Playall 365 Official Platform</span>
          </div>
          <div>bKash • Nagad • Rocket • Upay • USDT • 256-bit SSL Encrypted</div>
        </div>
      </footer>
    </div>
  );
};
