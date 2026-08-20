/**
 * @file InstallPwaButton.tsx
 * @description PWA Installation Floating / Navbar Button & Interactive Modal.
 * Prompts the native browser PWA install sheet for Android/Chrome/Desktop
 * and provides visual step-by-step installation guidance for iOS Safari.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone,
  Download,
  Sparkles,
  CheckCircle2,
  X,
  Share,
  PlusSquare,
  Zap,
  ShieldCheck,
  Bell,
  Layers,
  ArrowRight,
  Flame
} from 'lucide-react';
import { pwaService } from '../services/pwaService';
import confetti from 'canvas-confetti';

interface InstallPwaButtonProps {
  isFloating?: boolean;
}

export const InstallPwaButton: React.FC<InstallPwaButtonProps> = ({ isFloating = false }) => {
  const [canInstall, setCanInstall] = useState<boolean>(true);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);

  useEffect(() => {
    setIsIOS(pwaService.isIOS());
    const unsubscribe = pwaService.subscribe((installable, installed) => {
      setCanInstall(installable);
      setIsInstalled(installed);
    });

    return () => unsubscribe();
  }, []);

  const handleInstallClick = async () => {
    const outcome = await pwaService.promptInstall();

    if (outcome === 'accepted') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#06b6d4', '#10b981']
      });
      setShowModal(false);
    } else {
      // Open informative installation modal
      setShowModal(true);
    }
  };

  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* 1. Navbar / Trigger Button */}
      {isFloating ? (
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleInstallClick}
          className="fixed bottom-20 right-4 z-40 md:hidden bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 px-4 py-2.5 rounded-full font-mono font-black text-xs shadow-2xl shadow-amber-500/40 border border-amber-300 flex items-center space-x-2"
        >
          <Smartphone className="w-4 h-4 animate-bounce" />
          <span>অ্যাপ ইনস্টল করুন (Install App)</span>
          <Download className="w-3.5 h-3.5" />
        </motion.button>
      ) : (
        <button
          onClick={handleInstallClick}
          className="hidden sm:flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500/20 via-slate-900 to-amber-500/20 border border-amber-500/40 hover:border-amber-400 text-slate-200 hover:text-white font-mono text-xs font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-md shadow-amber-500/10 cursor-pointer"
          title="Install Playall 365 Mobile PWA App"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden md:inline">Install App</span>
          <span className="md:hidden">App</span>
          <span className="px-1.5 py-0.2 rounded-md bg-amber-500 text-slate-950 font-black text-[9px]">
            PWA
          </span>
        </button>
      )}

      {/* 2. Interactive PWA Installation & Experience Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-mono">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#090d16] border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-5 overflow-hidden"
            >
              {/* Ambient Glow */}
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header */}
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-500 p-0.5 shadow-lg shadow-amber-500/30 shrink-0">
                  <div className="w-full h-full bg-[#0b0f19] rounded-[14px] flex items-center justify-center text-amber-400">
                    <Smartphone className="w-6 h-6" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-black text-white font-sans uppercase">
                      Playall 365 Mobile App
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                      PWA
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-sans mt-0.5">
                    সরাসরি আপনার মোবাইল হোম স্ক্রিনে ইনস্টল করুন।
                  </p>
                </div>
              </div>

              {/* Benefits Grid */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-amber-400 font-bold">
                    <Zap className="w-3.5 h-3.5" />
                    <span>0% Lag & Fast Load</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    সার্ভিস ওয়ার্কার ক্যাশিংয়ের মাধ্যমে সুপার ফাস্ট স্পিন।
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-cyan-400 font-bold">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Full Screen Casino</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    কোন ব্রাউজার বার নেই, ১০০% নেটিভ অ্যাপের মতো ফুলস্ক্রিন।
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                    <Bell className="w-3.5 h-3.5" />
                    <span>Instant Push Alerts</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    বিকাশ উইথড্রয়াল অনুমোদন ও বোনাসের নোটিফিকেশন।
                  </p>
                </div>

                <div className="bg-slate-950/80 border border-slate-800/80 p-3 rounded-2xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-purple-400 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Biometric 1-Tap</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    বায়োমেট্রিক ও পিন ভিত্তিক দ্রুত ও নিরাপদ লগইন।
                  </p>
                </div>
              </div>

              {/* iOS Step-by-Step Guide or One-Tap Android Button */}
              {isIOS ? (
                <div className="bg-gradient-to-r from-slate-900 to-cyan-950/30 border border-cyan-500/30 p-4 rounded-2xl space-y-3 text-xs">
                  <div className="text-white font-bold font-sans flex items-center space-x-2">
                    <Share className="w-4 h-4 text-cyan-400" />
                    <span>আইফোন / আইপ্যাডে ইনস্টল করার নিয়ম (iOS Safari):</span>
                  </div>
                  <ol className="list-decimal list-inside text-[11px] text-slate-300 space-y-1.5 font-sans">
                    <li>
                      সাফারি ব্রাউজারের নিচের <strong className="text-cyan-300 font-mono">Share (শেয়ার)</strong> বাটনে ট্যাপ করুন।
                    </li>
                    <li>
                      মেনু স্ক্রল করে <strong className="text-amber-300 font-mono">"Add to Home Screen"</strong> অপশনে চাপ দিন।
                    </li>
                    <li>
                      উপরের ডানদিকের <strong className="text-emerald-300 font-mono">"Add"</strong> বাটনে ক্লিক করে শেষ করুন!
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={async () => {
                      const res = await pwaService.promptInstall();
                      if (res === 'accepted') {
                        setShowModal(false);
                      }
                    }}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/30 active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>এখনই ১-ট্যাপে ইনস্টল করুন (Install PWA)</span>
                  </button>
                  <p className="text-[10px] text-center text-slate-400">
                    কোন Play Store বা APK ফাইল ডাউনলোড করতে হবে না। মাত্র ২ মেগাবাইট!
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
