/**
 * @file MiniGameLauncher.tsx
 * @description Enterprise Multi-Engine Casino Simulator Hub for Playall 365.
 * Features PG Soft (Mahjong Ways 2), JILI (Super Ace), Aviator (Spribe), Sweet Bonanza (Pragmatic Play),
 * Lightning Roulette (Evolution), and Generic Aggregator Demo Iframe with Web Audio API sound effects.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Play,
  RotateCcw,
  Sparkles,
  Award,
  TrendingUp,
  AlertCircle,
  Coins,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Flame,
  Volume2,
  VolumeX,
  History,
  ShieldCheck,
  ChevronLeft,
  Globe,
  Layers
} from 'lucide-react';
import { useWalletGame } from '../contexts/WalletGameContext';
import { soundEngine } from '../services/soundEngine';
import { assetLoader, GameAsset } from '../services/assetLoader';
import { PgSoftMahjongWays } from './games/PgSoftMahjongWays';
import { JiliSuperAce } from './games/JiliSuperAce';
import { AviatorProGame } from './games/AviatorProGame';
import { DemoIframe } from './games/DemoIframe';

interface MiniGameLauncherProps {
  onBackToLobby: () => void;
  onOpenCashier: () => void;
  defaultGameId?: string;
}

export const MiniGameLauncher: React.FC<MiniGameLauncherProps> = ({
  onBackToLobby,
  onOpenCashier,
  defaultGameId = 'pgsoft_mahjong_ways2'
}) => {
  const {
    currentUser,
    currentWallet,
    currency,
    placeSeamlessBet,
    settleSeamlessWin,
    soundMuted,
    toggleSound,
    triggerCelebration,
    showToast
  } = useWalletGame();

  type GameType = 'pgsoft' | 'jili' | 'aviator' | 'bonanza' | 'roulette' | 'iframe';

  const [activeGame, setActiveGame] = useState<GameType>(() => {
    if (defaultGameId.includes('mahjong') || defaultGameId.includes('pgsoft')) return 'pgsoft';
    if (defaultGameId.includes('jili') || defaultGameId.includes('ace')) return 'jili';
    if (defaultGameId.includes('bonanza')) return 'bonanza';
    if (defaultGameId.includes('roulette')) return 'roulette';
    if (defaultGameId.includes('iframe')) return 'iframe';
    return 'pgsoft';
  });

  // --------------------------------------------------------------------------
  // AVIATOR CRASH GAME ENGINE
  // --------------------------------------------------------------------------
  const [aviatorBetAmount, setAviatorBetAmount] = useState<number>(20);
  const [aviatorGameState, setAviatorGameState] = useState<'IDLE' | 'BET_PLACED' | 'FLYING' | 'CASHED_OUT' | 'CRASHED'>('IDLE');
  const [aviatorMultiplier, setAviatorMultiplier] = useState<number>(1.0);
  const [aviatorCrashPoint, setAviatorCrashPoint] = useState<number>(2.5);
  const [aviatorActiveBetTxId, setAviatorActiveBetTxId] = useState<string>('');
  const [aviatorActiveRoundId, setAviatorActiveRoundId] = useState<string>('');
  const [aviatorHistory, setAviatorHistory] = useState<number[]>([1.85, 2.45, 1.12, 14.80, 1.05, 3.90, 8.42, 1.34]);
  const [aviatorWinAmount, setAviatorWinAmount] = useState<number>(0);
  const [aviatorAutoCashout, setAviatorAutoCashout] = useState<boolean>(false);
  const [aviatorAutoCashoutMult, setAviatorAutoCashoutMult] = useState<number>(2.0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // --------------------------------------------------------------------------
  // SWEET BONANZA SLOT REEL ENGINE
  // --------------------------------------------------------------------------
  const [slotBetAmount, setSlotBetAmount] = useState<number>(10);
  const [slotSpinning, setSlotSpinning] = useState<boolean>(false);
  const [slotGrid, setSlotGrid] = useState<string[][]>([
    ['🍓', '🍇', '🍉', '🍌', '🍬'],
    ['🍉', '🍬', '⭐', '🍇', '🍓'],
    ['🍬', '🍓', '🍌', '🍉', '💎']
  ]);
  const [slotLastWin, setSlotLastWin] = useState<number>(0);
  const [slotWinMultiplier, setSlotWinMultiplier] = useState<number>(0);

  // --------------------------------------------------------------------------
  // LIGHTNING ROULETTE ENGINE
  // --------------------------------------------------------------------------
  const [rouletteBetAmount, setRouletteBetAmount] = useState<number>(25);
  const [rouletteSelectedBet, setRouletteSelectedBet] = useState<'RED' | 'BLACK' | 'GREEN_ZERO' | '1-18' | '19-36' | '7'>('RED');
  const [rouletteSpinning, setRouletteSpinning] = useState<boolean>(false);
  const [rouletteResultNumber, setRouletteResultNumber] = useState<number | null>(null);
  const [rouletteLightningStrikes, setRouletteLightningStrikes] = useState<Array<{ num: number; mult: number }>>([]);
  const [rouletteLastWin, setRouletteLastWin] = useState<number>(0);

  const [message, setMessage] = useState<string | null>(null);

  // Clean Audio & Loops on Unmount or Tab/Game Switch
  useEffect(() => {
    return () => {
      soundEngine.stopAll();
    };
  }, [activeGame]);

  // Aviator Animation Loop
  useEffect(() => {
    if (activeGame !== 'aviator') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let startTime: number | null = null;

    const render = (time: number) => {
      if (!startTime) startTime = time;
      const progress = (time - startTime) / 1000;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw grid lines
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 60) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let j = 0; j < canvas.height; j += 40) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
      }

      if (aviatorGameState === 'FLYING' || aviatorGameState === 'CASHED_OUT' || aviatorGameState === 'CRASHED') {
        const currentMult = Math.min(aviatorMultiplier, aviatorCrashPoint);
        const curveFactor = Math.min(1, (currentMult - 1) / (aviatorCrashPoint > 1 ? aviatorCrashPoint : 1));

        const startX = 40;
        const startY = canvas.height - 40;
        const endX = startX + (canvas.width - 120) * curveFactor;
        const endY = startY - (canvas.height - 100) * Math.pow(curveFactor, 1.4);

        // Draw glowing laser trajectory curve
        const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
        gradient.addColorStop(0, '#06b6d4');
        gradient.addColorStop(1, aviatorGameState === 'CRASHED' ? '#ef4444' : '#f59e0b');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(startX + (endX - startX) * 0.3, startY, endX, endY);
        ctx.stroke();

        // Draw filled glow area under curve
        ctx.fillStyle = aviatorGameState === 'CRASHED' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)';
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(startX + (endX - startX) * 0.3, startY, endX, endY);
        ctx.lineTo(endX, startY);
        ctx.closePath();
        ctx.fill();

        // Draw Plane Icon at endX, endY
        ctx.save();
        ctx.translate(endX, endY);
        ctx.rotate(-0.25);
        ctx.fillStyle = aviatorGameState === 'CRASHED' ? '#ef4444' : '#fbbf24';
        ctx.font = '24px sans-serif';
        ctx.fillText('✈️', -12, 8);
        ctx.restore();
      }

      if (aviatorGameState === 'FLYING') {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    animationFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [activeGame, aviatorGameState, aviatorMultiplier, aviatorCrashPoint]);

  // Handle Aviator Flying Counter
  useEffect(() => {
    let interval: any = null;
    if (aviatorGameState === 'FLYING') {
      interval = setInterval(() => {
        setAviatorMultiplier((prev) => {
          const next = Number((prev + (prev * 0.045 + 0.01)).toFixed(2));

          // Check Auto Cashout
          if (aviatorAutoCashout && next >= aviatorAutoCashoutMult && aviatorGameState === 'FLYING') {
            handleAviatorCashout(next);
          }

          // Check Crash Point
          if (next >= aviatorCrashPoint) {
            clearInterval(interval);
            handleAviatorCrash(next);
            return aviatorCrashPoint;
          }
          return next;
        });
      }, 70);
    }
    return () => clearInterval(interval);
  }, [aviatorGameState, aviatorCrashPoint, aviatorAutoCashout, aviatorAutoCashoutMult]);

  // Aviator Place Bet Handler
  const handleAviatorStartBet = async () => {
    if (!currentWallet || currentWallet.real_balance < aviatorBetAmount) {
      soundEngine.playClick(300);
      setMessage('ব্যালেন্স পর্যাপ্ত নয় (Insufficient balance)');
      return;
    }

    soundEngine.playClick(1000);
    setMessage(null);
    setAviatorGameState('BET_PLACED');
    setAviatorMultiplier(1.0);
    setAviatorWinAmount(0);

    const roundId = `RND_AV_${Math.floor(100000 + Math.random() * 900000)}`;
    const betTxId = `TX_AV_BET_${Date.now()}`;
    setAviatorActiveRoundId(roundId);
    setAviatorActiveBetTxId(betTxId);

    const betRes = await placeSeamlessBet({
      providerId: 'spribe',
      gameId: 'spribe_aviator',
      amount: aviatorBetAmount,
      roundId,
      customTxId: betTxId
    });

    if (betRes.success) {
      soundEngine.startReelSpin();
      const rand = Math.random();
      let crash = 1.05;
      if (rand < 0.1) crash = Number((1.01 + Math.random() * 0.2).toFixed(2));
      else if (rand < 0.7) crash = Number((1.2 + Math.random() * 2.8).toFixed(2));
      else if (rand < 0.92) crash = Number((4.0 + Math.random() * 11.0).toFixed(2));
      else crash = Number((15.0 + Math.random() * 85.0).toFixed(2));

      setAviatorCrashPoint(crash);
      setTimeout(() => {
        soundEngine.stopReelSpin();
        setAviatorGameState('FLYING');
      }, 600);
    } else {
      setMessage(`Bet rejected: ${betRes.error}`);
      setAviatorGameState('IDLE');
    }
  };

  // Aviator Cash Out Handler
  const handleAviatorCashout = async (lockedMultiplier?: number) => {
    if (aviatorGameState !== 'FLYING') return;

    const mult = lockedMultiplier || aviatorMultiplier;
    setAviatorGameState('CASHED_OUT');
    const winAmt = Number((aviatorBetAmount * mult).toFixed(2));
    setAviatorWinAmount(winAmt);

    soundEngine.playWinChime();
    soundEngine.playCoinShower(8);

    if (mult >= 5.0) {
      triggerCelebration({
        title: 'AVIATOR CASHOUT!',
        amount: winAmt,
        currency: currency === 'BDT' ? '৳' : '$',
        multiplier: mult,
        gameTitle: 'Spribe Aviator'
      });
    }

    await settleSeamlessWin({
      providerId: 'spribe',
      gameId: 'spribe_aviator',
      amount: winAmt,
      roundId: aviatorActiveRoundId,
      referenceBetTxId: aviatorActiveBetTxId
    });

    setAviatorHistory((prev) => [mult, ...prev.slice(0, 7)]);
  };

  const handleAviatorCrash = (finalMult: number) => {
    soundEngine.playClick(200);
    setAviatorGameState('CRASHED');
    setAviatorHistory((prev) => [finalMult, ...prev.slice(0, 7)]);
  };

  // Sweet Bonanza Spin
  const symbols = ['🍓', '🍇', '🍉', '🍌', '🍬', '⭐', '💎'];
  const handleSpinSlot = async () => {
    if (!currentWallet || currentWallet.real_balance < slotBetAmount) {
      soundEngine.playClick(300);
      setMessage('Insufficient balance to spin!');
      return;
    }

    setMessage(null);
    setSlotSpinning(true);
    setSlotLastWin(0);

    soundEngine.startReelSpin();

    const roundId = `RND_SB_${Math.floor(100000 + Math.random() * 900000)}`;
    const betResult = await placeSeamlessBet({
      providerId: 'pragmatic_play',
      gameId: 'vs20sweetbonanza',
      amount: slotBetAmount,
      roundId
    });

    if (!betResult.success) {
      soundEngine.stopReelSpin();
      setMessage(`Bet failed: ${betResult.error}`);
      setSlotSpinning(false);
      return;
    }

    setTimeout(async () => {
      soundEngine.stopReelSpin();
      soundEngine.playReelStop(2);

      const newGrid = [
        [symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)]],
        [symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)]],
        [symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)]]
      ];
      setSlotGrid(newGrid);

      const isWin = Math.random() < 0.44;
      let winMultiplier = 0;
      let winAmount = 0;

      if (isWin) {
        winMultiplier = Number((1.5 + Math.random() * 12.0).toFixed(2));
        winAmount = Number((slotBetAmount * winMultiplier).toFixed(2));
        soundEngine.playWinChime();
        soundEngine.playCoinShower(6);
      }

      setSlotWinMultiplier(winMultiplier);
      setSlotLastWin(winAmount);

      if (winAmount > 0) {
        await settleSeamlessWin({
          providerId: 'pragmatic_play',
          gameId: 'vs20sweetbonanza',
          amount: winAmount,
          roundId: roundId,
          referenceBetTxId: betResult.txId
        });
      }

      setSlotSpinning(false);
    }, 900);
  };

  // Lightning Roulette Spin
  const handleSpinRoulette = async () => {
    if (!currentWallet || currentWallet.real_balance < rouletteBetAmount) {
      soundEngine.playClick(300);
      setMessage('Insufficient balance for roulette spin!');
      return;
    }

    setMessage(null);
    setRouletteSpinning(true);
    setRouletteLastWin(0);

    soundEngine.startReelSpin();

    const roundId = `RND_LT_${Math.floor(100000 + Math.random() * 900000)}`;
    const betRes = await placeSeamlessBet({
      providerId: 'evolution',
      gameId: 'evolution_lightning_roulette',
      amount: rouletteBetAmount,
      roundId
    });

    if (!betRes.success) {
      soundEngine.stopReelSpin();
      setMessage(`Bet rejected: ${betRes.error}`);
      setRouletteSpinning(false);
      return;
    }

    const strikes = [
      { num: Math.floor(Math.random() * 36) + 1, mult: [50, 100, 200, 500][Math.floor(Math.random() * 4)] },
      { num: Math.floor(Math.random() * 36) + 1, mult: [50, 100, 250][Math.floor(Math.random() * 3)] }
    ];
    setRouletteLightningStrikes(strikes);

    setTimeout(async () => {
      soundEngine.stopReelSpin();
      soundEngine.playReelStop(0);

      const winningNumber = Math.floor(Math.random() * 37);
      setRouletteResultNumber(winningNumber);

      const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(winningNumber);
      let winMultiplier = 0;

      if (rouletteSelectedBet === 'RED' && isRed) winMultiplier = 2.0;
      else if (rouletteSelectedBet === 'BLACK' && !isRed && winningNumber !== 0) winMultiplier = 2.0;
      else if (rouletteSelectedBet === 'GREEN_ZERO' && winningNumber === 0) winMultiplier = 36.0;
      else if (rouletteSelectedBet === '1-18' && winningNumber >= 1 && winningNumber <= 18) winMultiplier = 2.0;
      else if (rouletteSelectedBet === '19-36' && winningNumber >= 19 && winningNumber <= 36) winMultiplier = 2.0;
      else if (rouletteSelectedBet === '7' && winningNumber === 7) {
        const lightning = strikes.find((s) => s.num === 7);
        winMultiplier = lightning ? lightning.mult : 30.0;
      }

      const winAmount = Number((rouletteBetAmount * winMultiplier).toFixed(2));
      setRouletteLastWin(winAmount);

      if (winAmount > 0) {
        soundEngine.playWinChime();
        soundEngine.playCoinShower(7);
        await settleSeamlessWin({
          providerId: 'evolution',
          gameId: 'evolution_lightning_roulette',
          amount: winAmount,
          roundId: roundId,
          referenceBetTxId: betRes.txId
        });
      }

      setRouletteSpinning(false);
    }, 1200);
  };

  const GAME_ID_MAP: Record<GameType, string> = {
    pgsoft: 'pgsoft_mahjong_ways2',
    jili: 'jili_super_ace',
    aviator: 'spribe_aviator',
    bonanza: 'vs20sweetbonanza',
    roulette: 'evolution_lightning_roulette',
    iframe: 'vs20olympgate'
  };

  const currentAsset = assetLoader.getGameAsset(GAME_ID_MAP[activeGame]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
      {/* 1. TOP DYNAMIC AUTHENTIC GAME SHOWCASE BANNER */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-[#080c16] shadow-2xl">
        {/* Background Ambient Backdrop Art */}
        <div className="absolute inset-0 z-0">
          <img
            src={currentAsset.bannerUrl || currentAsset.thumbnailUrl}
            alt={currentAsset.name}
            className="w-full h-full object-cover opacity-20 filter blur-[2px] scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#080c16] via-[#080c16]/90 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080c16] via-transparent to-transparent" />
        </div>

        {/* Banner Content */}
        <div className="relative z-10 p-4 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5 sm:space-x-5">
            {/* Back Button */}
            <button
              onClick={() => {
                soundEngine.playClick(800);
                onBackToLobby();
              }}
              className="p-2.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-all flex items-center space-x-1.5 text-xs font-mono shrink-0 shadow-lg active:scale-95 cursor-pointer"
              title="লবিতে ফিরে যান"
            >
              <ChevronLeft className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">লবি (LOBBY)</span>
            </button>

            {/* Thumbnail Asset Icon Frame */}
            <div className="relative w-14 h-14 sm:w-18 sm:h-18 rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-xl shrink-0 bg-slate-950">
              <img
                src={currentAsset.thumbnailUrl}
                alt={currentAsset.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1 right-1 px-1 py-0.2 rounded bg-black/70 text-[9px] font-mono font-bold text-amber-300">
                {currentAsset.icon}
              </div>
            </div>

            {/* Title & Metadata */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>{currentAsset.name}</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] sm:text-xs font-mono font-black uppercase">
                  {currentAsset.provider}
                </span>
                {currentAsset.badge && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-600/90 text-white text-[10px] font-mono font-bold">
                    {currentAsset.badge}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 font-sans max-w-xl line-clamp-1 sm:line-clamp-2">
                {currentAsset.description}
              </p>

              {/* Feature Chips */}
              <div className="hidden sm:flex flex-wrap items-center gap-1.5 pt-1">
                {currentAsset.features.slice(0, 3).map((feat, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-slate-900/80 border border-slate-700 text-slate-300 text-[10px] font-mono"
                  >
                    ✦ {feat}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Metrics Strip */}
          <div className="flex items-center space-x-2 sm:space-x-4 bg-slate-950/80 border border-slate-800/80 p-2.5 sm:p-3 rounded-2xl shrink-0 font-mono">
            <div className="px-2 text-center">
              <div className="text-[10px] text-slate-400 uppercase font-bold">RTP</div>
              <div className="text-xs sm:text-sm font-black text-emerald-400">{currentAsset.rtp}</div>
            </div>
            <div className="h-6 w-[1px] bg-slate-800" />
            <div className="px-2 text-center">
              <div className="text-[10px] text-slate-400 uppercase font-bold">MAX PAYOUT</div>
              <div className="text-xs sm:text-sm font-black text-amber-400">{currentAsset.maxMultiplier}</div>
            </div>
            <div className="h-6 w-[1px] bg-slate-800" />
            <div className="px-2 text-center">
              <div className="text-[10px] text-slate-400 uppercase font-bold">VOLATILITY</div>
              <div className="text-xs sm:text-sm font-black text-rose-400">{currentAsset.volatility}</div>
            </div>
          </div>
        </div>

        {/* Multi-Game Studio Selector Pills */}
        <div className="relative z-10 px-4 sm:px-6 py-2.5 bg-slate-950/90 border-t border-slate-800/80 flex items-center space-x-2 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
            STUDIO ENGINE:
          </span>

          <button
            onClick={() => {
              soundEngine.playClick();
              setActiveGame('pgsoft');
            }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs font-mono whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeGame === 'pgsoft'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/25 font-black scale-105'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>🀄</span>
            <span>PG Mahjong 2</span>
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              setActiveGame('jili');
            }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs font-mono whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeGame === 'jili'
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25 font-black scale-105'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>🃏</span>
            <span>JILI Super Ace</span>
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              setActiveGame('aviator');
            }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs font-mono whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeGame === 'aviator'
                ? 'bg-gradient-to-r from-rose-600 to-red-500 text-white shadow-lg shadow-rose-500/25 font-black scale-105'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>✈️</span>
            <span>Spribe Aviator</span>
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              setActiveGame('bonanza');
            }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs font-mono whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeGame === 'bonanza'
                ? 'bg-gradient-to-r from-pink-500 to-yellow-400 text-slate-950 shadow-lg font-black scale-105'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>🍬</span>
            <span>Sweet Bonanza</span>
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              setActiveGame('roulette');
            }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs font-mono whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeGame === 'roulette'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-lg font-black scale-105'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>⚡</span>
            <span>Lightning Roulette</span>
          </button>

          <button
            onClick={() => {
              soundEngine.playClick();
              setActiveGame('iframe');
            }}
            className={`px-3 py-1.5 rounded-xl font-black text-xs font-mono whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeGame === 'iframe'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-lg font-black scale-105'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <span>🌐</span>
            <span>Live Aggregator</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{message}</span>
          </div>
          <button
            onClick={onOpenCashier}
            className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold text-[10px]"
          >
            Deposit Now
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. PG SOFT MAHJONG WAYS 2 SIMULATOR */}
      {/* ========================================================================= */}
      {activeGame === 'pgsoft' && <PgSoftMahjongWays onOpenCashier={onOpenCashier} />}

      {/* ========================================================================= */}
      {/* 2. JILI SUPER ACE CARD SIMULATOR */}
      {/* ========================================================================= */}
      {activeGame === 'jili' && <JiliSuperAce onOpenCashier={onOpenCashier} />}

      {/* ========================================================================= */}
      {/* 3. AGGREGATOR DEMO IFRAME ENGINE */}
      {/* ========================================================================= */}
      {activeGame === 'iframe' && (
        <DemoIframe
          gameTitle="Pragmatic Play Live Aggregator Stream"
          providerName="Pragmatic Play / Seamless Iframe Bridge"
        />
      )}

      {/* ========================================================================= */}
      {/* 4. AVIATOR PRO CRASH GAME VIEW */}
      {/* ========================================================================= */}
      {activeGame === 'aviator' && (
        <AviatorProGame
          onBackToLobby={onBackToLobby}
          onOpenCashier={onOpenCashier}
        />
      )}

      {/* ========================================================================= */}
      {/* 5. SWEET BONANZA SLOT REEL VIEW */}
      {/* ========================================================================= */}
      {activeGame === 'bonanza' && (
        <div className="relative overflow-hidden bg-[#0e0717] border-2 border-pink-500/40 rounded-3xl p-4 sm:p-8 shadow-2xl space-y-6">
          {/* Subtle Ambient Background Artwork */}
          <div className="absolute inset-0 z-0 opacity-15 pointer-events-none">
            <img
              src="https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?auto=format&fit=crop&w=1200&q=80"
              alt="Sweet Bonanza Backdrop"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-between border-b border-pink-900/40 pb-4 gap-2">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-yellow-400 p-0.5 shadow-lg shadow-pink-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-2xl">
                  🍬
                </div>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white flex items-center space-x-2">
                  <span>Sweet Bonanza 1000</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 font-mono font-bold border border-pink-500/30">
                    96.53% RTP
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 font-mono font-bold border border-yellow-500/30">
                    1000x BOMBS
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Pragmatic Play Tumble Feature &amp; Rainbow Multiplier Bombs
                </p>
              </div>
            </div>

            <div className="text-right font-mono bg-slate-950/80 border border-pink-500/30 px-3 py-1.5 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Last Win</div>
              <div className="text-base sm:text-lg font-black text-emerald-400">
                +${slotLastWin.toFixed(2)} {slotWinMultiplier > 0 && <span className="text-yellow-400 font-black">({slotWinMultiplier}x)</span>}
              </div>
            </div>
          </div>

          {/* 5x3 Candy Grid */}
          <div className="relative z-10 bg-gradient-to-b from-slate-950 via-[#180a2b] to-slate-950 p-4 sm:p-6 rounded-2xl border-2 border-pink-500/30 shadow-2xl">
            <div className="grid grid-cols-5 gap-2 sm:gap-4">
              {slotGrid.map((row, rIdx) =>
                row.map((symbol, cIdx) => (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    className={`aspect-square rounded-2xl bg-slate-900/90 border border-pink-500/20 flex items-center justify-center text-3xl sm:text-5xl shadow-md transition-all duration-300 ${
                      slotSpinning ? 'animate-bounce opacity-60 scale-95' : 'hover:scale-105 hover:border-pink-400 shadow-pink-500/10'
                    }`}
                  >
                    {symbol}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/90 p-4 rounded-2xl border border-pink-500/20">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <span className="text-xs font-mono text-slate-400 uppercase font-bold">Bet:</span>
              {[2, 5, 10, 25, 50].map((b) => (
                <button
                  key={b}
                  onClick={() => setSlotBetAmount(b)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black transition-all cursor-pointer ${
                    slotBetAmount === b
                      ? 'bg-gradient-to-r from-pink-500 to-yellow-400 text-slate-950 shadow-lg shadow-pink-500/30 scale-105'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                  }`}
                >
                  ${b}
                </button>
              ))}
            </div>

            <button
              disabled={slotSpinning}
              onClick={handleSpinSlot}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-400 text-slate-950 font-black text-base shadow-xl shadow-pink-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <RotateCcw className={`w-5 h-5 ${slotSpinning ? 'animate-spin' : ''}`} />
              <span>SPIN (${slotBetAmount})</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. LIGHTNING ROULETTE VIEW */}
      {/* ========================================================================= */}
      {activeGame === 'roulette' && (
        <div className="relative overflow-hidden bg-[#060b13] border-2 border-cyan-500/40 rounded-3xl p-4 sm:p-8 shadow-2xl space-y-6">
          {/* Subtle Live Studio Backdrop Artwork */}
          <div className="absolute inset-0 z-0 opacity-15 pointer-events-none">
            <img
              src="https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&w=1200&q=80"
              alt="Lightning Studio"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-between border-b border-cyan-900/40 pb-4 gap-2">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-400 to-blue-600 p-0.5 shadow-lg shadow-cyan-500/20">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-2xl">
                  ⚡
                </div>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white flex items-center space-x-2">
                  <span>Lightning Roulette Live</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold border border-cyan-500/30">
                    500x STRIKE
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                    97.30% RTP
                  </span>
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Evolution Gaming Electrified Studio with RNG Multipliers
                </p>
              </div>
            </div>

            <div className="text-right font-mono bg-slate-950/80 border border-cyan-500/30 px-3 py-1.5 rounded-xl">
              <div className="text-[10px] text-slate-400 uppercase font-bold">Roulette Result</div>
              <div className="text-base sm:text-lg font-black text-cyan-300">
                {rouletteResultNumber !== null ? `Number #${rouletteResultNumber}` : 'Awaiting Spin'}
              </div>
            </div>
          </div>

          {rouletteLightningStrikes.length > 0 && (
            <div className="relative z-10 grid grid-cols-2 gap-4">
              {rouletteLightningStrikes.map((s, idx) => (
                <div
                  key={idx}
                  className="bg-gradient-to-r from-cyan-950/80 via-slate-900 to-slate-950 border border-cyan-400/60 p-3.5 rounded-2xl flex items-center justify-between font-mono animate-pulse shadow-lg shadow-cyan-500/20"
                >
                  <span className="text-xs text-slate-300 font-black">⚡ LUCKY #{s.num}</span>
                  <span className="text-base sm:text-lg font-black text-yellow-400">{s.mult}X STRIKE</span>
                </div>
              ))}
            </div>
          )}

          {/* Betting Grid */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            {[
              { id: 'RED', label: 'RED (2x)', bg: 'bg-red-600' },
              { id: 'BLACK', label: 'BLACK (2x)', bg: 'bg-slate-900' },
              { id: 'GREEN_ZERO', label: 'ZERO 0 (36x)', bg: 'bg-emerald-600' },
              { id: '1-18', label: 'LOW 1-18 (2x)', bg: 'bg-slate-800' },
              { id: '19-36', label: 'HIGH 19-36 (2x)', bg: 'bg-slate-800' },
              { id: '7', label: 'LUCKY 7 (500x)', bg: 'bg-gradient-to-r from-amber-600 to-yellow-600' }
            ].map((bet) => (
              <button
                key={bet.id}
                onClick={() => setRouletteSelectedBet(bet.id as any)}
                className={`p-4 rounded-2xl border text-xs font-mono font-bold transition-all cursor-pointer ${bet.bg} ${
                  rouletteSelectedBet === bet.id
                    ? 'border-cyan-400 ring-2 ring-cyan-400/60 scale-105 shadow-xl shadow-cyan-500/30'
                    : 'border-slate-800 text-slate-300 hover:border-cyan-500/40'
                }`}
              >
                {bet.label}
              </button>
            ))}
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/90 p-4 rounded-2xl border border-cyan-500/20">
            <div className="flex items-center space-x-2 font-mono text-xs text-slate-300">
              <span>Bet: <strong>${rouletteBetAmount}</strong> on <strong className="text-cyan-400">{rouletteSelectedBet}</strong></span>
            </div>

            <button
              disabled={rouletteSpinning}
              onClick={handleSpinRoulette}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white font-black text-sm shadow-xl shadow-cyan-500/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Zap className={`w-5 h-5 ${rouletteSpinning ? 'animate-spin' : ''}`} />
              <span>SPIN WHEEL (${rouletteBetAmount})</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
