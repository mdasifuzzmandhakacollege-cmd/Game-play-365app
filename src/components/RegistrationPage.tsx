import React, { useState } from 'react';
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
  CreditCard
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { UserEntity, WalletEntity } from '../server/types/seamless';
import { seamlessEngine } from '../services/simulatedWalletEngine';

interface RegistrationPageProps {
  onLoginSuccess: (user: UserEntity, wallet: WalletEntity) => void;
  allUsers: UserEntity[];
}

export const RegistrationPage: React.FC<RegistrationPageProps> = ({
  onLoginSuccess,
  allUsers
}) => {
  const { signInWithGoogle, user: firebaseUser } = useAuth();

  // Mode: 'REGISTER' | 'LOGIN'
  const [authMode, setAuthMode] = useState<'REGISTER' | 'LOGIN'>('REGISTER');

  // Form State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currency, setCurrency] = useState<'BDT' | 'USD'>('BDT');
  const [promoCode, setPromoCode] = useState('');
  const [termsAgreed, setTermsAgreed] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successAnimation, setSuccessAnimation] = useState(false);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!username.trim() || username.length < 3) {
      setErrorMessage('ইউজারনেম অন্তত ৩ অক্ষরের হতে হবে (Username must be at least 3 characters)');
      return;
    }

    if (authMode === 'REGISTER' && (!email.trim() || !email.includes('@'))) {
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
        // Register in seamless engine
        const result = seamlessEngine.registerUser({
          username: username.trim(),
          email: email.trim(),
          phone: phone.trim(),
          currency: currency,
          promoCode: promoCode.trim()
        });

        setSuccessAnimation(true);
        setTimeout(() => {
          onLoginSuccess(result.user, result.wallet);
        }, 400);
      } else {
        // Login flow
        const existingUsers = seamlessEngine.getUsers();
        const found = existingUsers.find(
          (u) =>
            u.username.toLowerCase() === username.trim().toLowerCase() ||
            (u.email && u.email.toLowerCase() === username.trim().toLowerCase()) ||
            u.id === username.trim()
        );

        if (found) {
          const wallets = seamlessEngine.getWallets();
          const userWallet =
            wallets.find((w) => w.user_id === found.id && w.currency === found.currency) ||
            wallets.find((w) => w.user_id === found.id) ||
            wallets[0];

          setSuccessAnimation(true);
          setTimeout(() => {
            onLoginSuccess(found, userWallet);
          }, 400);
        } else {
          // If user logging in with a new handle, register automatically
          const result = seamlessEngine.registerUser({
            username: username.trim(),
            email: email.trim() || `${username.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}@playall365.vip`,
            phone: phone.trim(),
            currency: currency,
            promoCode: promoCode.trim()
          });

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
      const googleUser = await signInWithGoogle();
      const displayName = googleUser?.displayName || 'GooglePlayer';
      const emailAddress = googleUser?.email || `${displayName.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`;

      const existingUsers = seamlessEngine.getUsers();
      let foundUser = existingUsers.find(
        (u) => (u.email && u.email.toLowerCase() === emailAddress.toLowerCase()) || u.username.toLowerCase() === displayName.toLowerCase()
      );

      if (!foundUser) {
        const result = seamlessEngine.registerUser({
          username: displayName,
          email: emailAddress,
          phone: googleUser?.phoneNumber || '',
          currency: 'BDT',
          promoCode: ''
        });
        foundUser = result.user;
      }

      const wallets = seamlessEngine.getWallets();
      const userWallet = wallets.find((w) => w.user_id === foundUser.id) || wallets[0];
      onLoginSuccess(foundUser, userWallet);
    } catch (err: any) {
      setErrorMessage(err.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070c] text-white flex flex-col justify-between relative overflow-hidden font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Background Animated Atmosphere */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      {/* Top Brand Bar */}
      <header className="relative z-10 border-b border-slate-800/80 bg-[#07090e]/90 backdrop-blur-xl px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 p-[1px] shadow-lg shadow-amber-500/25">
            <div className="w-full h-full bg-[#090b10] rounded-[11px] flex items-center justify-center">
              <Crown className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="text-xl font-black tracking-tight">
              GamePlay<span className="text-transparent bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text">365</span>
            </div>
            <div className="text-[10px] text-amber-400 font-mono tracking-wider font-semibold">
              PREMIER VIP CASINO &amp; SEAMLESS LEDGER
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs font-mono">
          <div className="hidden md:flex items-center space-x-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>bKash &amp; Nagad Instant Gateways Live</span>
          </div>

          <button
            onClick={() => setAuthMode(authMode === 'REGISTER' ? 'LOGIN' : 'REGISTER')}
            className="px-4 py-1.5 rounded-xl border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 font-bold transition-all text-xs"
          >
            {authMode === 'REGISTER' ? 'লগইন করুন (Sign In)' : 'নতুন অ্যাকাউন্ট (Register)'}
          </button>
        </div>
      </header>

      {/* Main Registration & Welcome Center Stage */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Hero Welcome & Value Proposition */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
              <span>১০০% ফার্স্ট ডিপোজিট বোনাস + ১০,০০০ ৳ ওয়েলকাম গিফট</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight font-sans tracking-tight">
              লুক্সারি ক্যাসিনো ও <br />
              <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
                ইনস্ট্যান্ট বিকাশ-নগদ
              </span> গেমিং।
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
              Playall 365-এ আপনাকে স্বাগতম! রেজিস্ট্রেশন করুন আর সরাসরি খেলুন <strong>Aviator (1000x)</strong>, <strong>Sweet Bonanza</strong> এবং <strong>Live Lightning Roulette</strong>। ৪ সেকেন্ডের মধ্যে বিকাশ ও নগদ ক্যাশ-আউট।
            </p>

            {/* Live Benefits Grid */}
            <div className="grid grid-cols-2 gap-3 pt-2 font-mono">
              <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold">
                  <CreditCard className="w-4 h-4" />
                  <span>বিকাশ ও নগদ 0% ফি</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  ৫০০ ৳ থেকে ৫০,০০০ ৳ ইনস্ট্যান্ট লেনদেন
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
                <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold">
                  <Zap className="w-4 h-4" />
                  <span>&lt; ৪ সেকেন্ড SLA</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  PostgreSQL ACID সুরক্ষিত লেজার
                </div>
              </div>
            </div>

            {/* VIP & Security Assurance (Real-Time Infrastructure) */}
            <div className="bg-slate-900/90 border border-emerald-500/30 p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-emerald-400 uppercase font-bold flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>রিয়েল-টাইম সিকিউরিটি ও ভিআইপি সিস্টেম</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  OFFICIAL VIP CORE
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-mono text-xs">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start space-x-2.5">
                  <Flame className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-white text-xs">সরাসরি বিকাশ ও নগদ ক্যাশ-আউট</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">১০০% রিয়েল-টাইম অটোমেটিক প্রসেসিং</div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start space-x-2.5">
                  <Zap className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-white text-xs">B2B সিমলেস লেজার সিকিউরিটি</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">ACID ট্রানজেকশন প্রটেকশন</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Real-Time Registration & Auth Form Card */}
          <div className="lg:col-span-6">
            <div className="relative bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/15 backdrop-blur-2xl">
              
              {/* Form Mode Header Tabs */}
              <div className="flex items-center space-x-1 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 mb-6 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('REGISTER');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    authMode === 'REGISTER'
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-lg font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>নতুন রেজিস্ট্রেশন (Register)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('LOGIN');
                    setErrorMessage(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-bold flex items-center justify-center space-x-1.5 transition-all ${
                    authMode === 'LOGIN'
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-lg font-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>লগইন (Sign In)</span>
                </button>
              </div>

              {errorMessage && (
                <div className="mb-4 p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-mono flex items-center space-x-2 animate-shake">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successAnimation && (
                <div className="mb-4 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-mono flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 animate-spin" />
                  <span>
                    {authMode === 'LOGIN'
                      ? 'লগইন সফল! ক্যাসিনো লবিতে প্রবেশ করা হচ্ছে...'
                      : 'রেজিস্ট্রেশন সম্পন্ন! ক্যাসিনো লবিতে প্রবেশ করা হচ্ছে...'}
                  </span>
                </div>
              )}

              {/* Registration / Login Form */}
              <form onSubmit={handleRegisterSubmit} className="space-y-4 font-mono text-xs">
                
                {/* Username */}
                <div>
                  <label className="block text-slate-300 mb-1 font-bold">
                    VIP ইউজারনেম (Username) *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. your_username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-3 py-3 text-white placeholder-slate-600 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Email (only on register) */}
                {authMode === 'REGISTER' && (
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">
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
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-3 py-3 text-white placeholder-slate-600 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* Phone & Currency Selection (only on register) */}
                {authMode === 'REGISTER' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">
                        মোবাইল (bKash/Nagad)
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                        <input
                          type="text"
                          placeholder="01XXXXXXXXX"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-3 py-3 text-white placeholder-slate-600 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1 font-bold">
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

                {/* Password */}
                <div>
                  <label className="block text-slate-300 mb-1 font-bold">
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
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-10 py-3 text-white placeholder-slate-600 focus:outline-none transition-colors"
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

                {/* Confirm Password (only on register) */}
                {authMode === 'REGISTER' && (
                  <div>
                    <label className="block text-slate-300 mb-1 font-bold">
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
                        className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl pl-10 pr-3 py-3 text-white placeholder-slate-600 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* Promo Code Bonus Pill (on register) */}
                {authMode === 'REGISTER' && (
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center space-x-2">
                    <Gift className="w-4 h-4 text-amber-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="PROMO CODE (ঐচ্ছিক)"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="bg-transparent text-xs font-mono text-white uppercase focus:outline-none flex-1 placeholder-slate-600"
                    />
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                      +100% বোনাস কোড
                    </span>
                  </div>
                )}

                {/* 18+ Agreement */}
                {authMode === 'REGISTER' && (
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      checked={termsAgreed}
                      onChange={(e) => setTermsAgreed(e.target.checked)}
                      className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-amber-500 focus:ring-0"
                    />
                    <span>আমার বয়স ১৮+ বছর এবং আমি শর্তাবলীতে সম্মত।</span>
                  </div>
                )}

                {/* Action Big Button */}
                <button
                  type="submit"
                  disabled={loading || (authMode === 'REGISTER' && !termsAgreed)}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>
                    {loading
                      ? 'অ্যাকাউন্ট ভেরিফাই হচ্ছে...'
                      : authMode === 'REGISTER'
                      ? 'রেজিস্ট্রেশন করুন ও ক্যাসিনোতে প্রবেশ করুন'
                      : 'লগইন করুন ও খেলুন'}
                  </span>
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </button>
              </form>

              {/* Google Sign In Separator */}
              <div className="mt-5 pt-4 border-t border-slate-800 text-center">
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-mono font-bold flex items-center justify-center space-x-2 transition-all"
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
                  <span>Google দিয়ে ১-ক্লিকে সাইন ইন করুন</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Luxury Footer */}
      <footer className="relative z-10 bg-[#07090e] border-t border-slate-800/80 py-4 px-4 text-center text-xs text-slate-400 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-slate-300 font-bold">Playall 365 VIP Architecture</span>
          </div>
          <div>bKash • Nagad • Rocket • Upay • USDT • SSL 256-bit Encrypted</div>
        </div>
      </footer>
    </div>
  );
};
