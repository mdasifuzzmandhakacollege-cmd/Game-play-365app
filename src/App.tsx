/**
 * @file App.tsx
 * @description Enterprise Full-Stack iGaming Application Shell for "Playall 365".
 * Connects the Global Wallet Game State Manager (Zustand/React Context),
 * Authentic PG Soft & JILI Simulators, Real-Time Audio Engine, and Full Navigation.
 */

import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { CelebrationModal } from './components/CelebrationModal';
import { RegistrationPage } from './components/RegistrationPage';
import { GameLobby } from './components/GameLobby';
import { MiniGameLauncher } from './components/MiniGameLauncher';
import { CashierView } from './components/CashierView';
import { UserProfileView } from './components/UserProfileView';
import { AffiliateDashboard } from './components/AffiliateDashboard';
import { VipProgressionView } from './components/VipProgressionView';
import { PromotionHub } from './components/PromotionHub';
import { WageringRequirements } from './components/WageringRequirements';
import { GoogleDrivePickerHub } from './components/GoogleDrivePickerHub';
import { ProviderSimulator } from './components/ProviderSimulator';
import { ConcurrencyStressTester } from './components/ConcurrencyStressTester';
import { LedgerExplorer } from './components/LedgerExplorer';
import { CodeViewer } from './components/CodeViewer';
import { ArchitectureGuide } from './components/ArchitectureGuide';
import { HMACDebugger } from './components/HMACDebugger';
import { LatencyMonitor } from './components/LatencyMonitor';
import { DeadlockSimulator } from './components/DeadlockSimulator';
import { TpsCapacityGauge } from './components/TpsCapacityGauge';
import { CacheDiagnostics } from './components/CacheDiagnostics';
import { WalletAutoSync } from './components/WalletAutoSync';
import { ApiRateMonitor } from './components/ApiRateMonitor';
import { AuthModal } from './components/AuthModal';
import { InstallPwaButton } from './components/InstallPwaButton';
import { AdminPanel } from './components/AdminPanel';
import { TransactionAuditLog } from './components/TransactionAuditLog';
import { SystemErrorsMonitor } from './components/SystemErrorsMonitor';
import { SecurityDashboard } from './components/SecurityDashboard';
import { useErrorReporter } from './hooks/useErrorReporter';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { WalletGameProvider, useWalletGame } from './contexts/WalletGameContext';
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  Terminal,
  Activity,
  Lock,
  Layers, RefreshCw,
  FileCode2,
  BookOpen,
  RotateCcw,
  AlertOctagon,
  ShieldAlert,
  Bug
} from 'lucide-react';

function Playall365InnerApp() {
  // Automated Firestore Error Reporting Hook - captures API failures, stack traces & pushes to 'SystemErrors'
  const {
    errors: systemErrors,
    newErrorsCount,
    triggerTestError,
    resolveError,
    markInvestigating,
    clearLocalErrors
  } = useErrorReporter();

  const {
    isAuthenticated,
    setIsAuthenticated,
    currentUser,
    currentWallet,
    users,
    wallets,
    currency,
    activeTab,
    setActiveTab,
    activeGameId,
    setActiveGameId,
    launchGame,
    loginUser,
    switchUser,
    refreshState,
    toastMessage,
    showToast,
    celebrationData,
    clearCelebration
  } = useWalletGame();

  const [workbenchSubTab, setWorkbenchSubTab] = useState<
    'simulator' | 'latency' | 'concurrency' | 'deadlock' | 'ledger' | 'code' | 'architecture' | 'hmac' | 'cache' | 'autosync' | 'apiRate' | 'errors'
  >('simulator');

  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);

  // 1. If not authenticated, display the dedicated Registration & Auth Landing Page
  if (!isAuthenticated) {
    return (
      <RegistrationPage
        onLoginSuccess={(user, wallet) => {
          loginUser(user, wallet);
        }}
        allUsers={users}
      />
    );
  }

  // 2. Once Registered / Logged In, display the full Playall 365 Casino App
  return (
    <div className="min-h-screen bg-[#06080d] text-slate-100 flex flex-col font-bengali selection:bg-amber-500 selection:text-slate-950">
      {/* Luxury Corporate Futurism Navbar */}
      <Navbar
        onOpenCashier={() => setActiveTab('cashier')}
        onOpenProfile={() => setActiveTab('profile')}
      />

      {/* Main Content View Switcher */}
      <main className="flex-1 w-full pb-12">
        {/* 1. CASINO LOBBY */}
        {activeTab === 'lobby' && (
          <GameLobby
            currentUser={currentUser}
            currentWallet={currentWallet}
            currency={currency}
            onLaunchGame={launchGame}
            onOpenCashier={() => setActiveTab('cashier')}
            onNavigateTab={setActiveTab}
          />
        )}

        {/* 2. LIVE INTERACTIVE MINI-GAMES & SIMULATORS */}
        {activeTab === 'games' && (
          <MiniGameLauncher
            defaultGameId={activeGameId}
            onBackToLobby={() => setActiveTab('lobby')}
            onOpenCashier={() => setActiveTab('cashier')}
          />
        )}

        {/* 3. VIP PROGRESSION & LADDER (V1 to V10) */}
        {activeTab === 'vip' && (
          <VipProgressionView
            currentUser={currentUser}
            currentWallet={currentWallet}
            currency={currency}
            onBonusClaimed={refreshState}
          />
        )}

        {/* 4. MULTI-TIER AFFILIATE & COMMISSION ENGINE (MLM Tree) */}
        {activeTab === 'affiliate' && (
          <AffiliateDashboard
            currentUser={currentUser}
            currentWallet={currentWallet}
            currency={currency}
            onCommissionClaimed={refreshState}
          />
        )}

        {/* 5. PROMOTION & EVENT HUB (Daily Check-in & Lucky Wheel) */}
        {activeTab === 'promo' && (
          <PromotionHub
            currentUser={currentUser}
            currentWallet={currentWallet}
            currency={currency}
            onRewardClaimed={refreshState}
          />
        )}

        {/* 5.1 DEDICATED WAGERING & ROLLOVER TURNOVER PROGRESS VIEW */}
        {activeTab === 'wagering' && (
          <div className="max-w-6xl mx-auto px-4 py-6">
            <WageringRequirements
              currentUser={currentUser}
              currentWallet={currentWallet}
              currency={currency}
              onConversionSuccess={refreshState}
            />
          </div>
        )}

        {/* 5.2 GOOGLE DRIVE PICKER & KYC DOCUMENT VAULT */}
        {activeTab === 'drive_vault' && (
          <div className="max-w-6xl mx-auto px-4 py-6">
            <GoogleDrivePickerHub
              currentUser={currentUser}
              onKycUpdated={refreshState}
            />
          </div>
        )}

        {/* 6. CASHIER (bKash, Nagad, Rocket, Upay Deposits & Withdrawals) */}
        {activeTab === 'cashier' && (
          <CashierView
            currentUser={currentUser}
            currentWallet={currentWallet}
            currency={currency}
            onLedgerMutated={refreshState}
            onClose={() => setActiveTab('lobby')}
          />
        )}

        {/* 7. VIP PROFILE & DOUBLE-ENTRY LEDGER */}
        {activeTab === 'profile' && (
          <UserProfileView
            currentUser={currentUser}
            currentWallet={currentWallet}
            currency={currency}
            onOpenCashier={() => setActiveTab('cashier')}
          />
        )}

        {/* 7.1 ROLE-BASED OPERATOR ADMIN PANEL */}
        {activeTab === 'admin' && (
          <AdminPanel
            onStateMutated={refreshState}
            onClose={() => setActiveTab('lobby')}
          />
        )}

        {/* 7.2 CRYPTOGRAPHIC TRANSACTION AUDIT LOG */}
        {activeTab === 'audit' && (
          <TransactionAuditLog
            onNavigateToLedger={() => setActiveTab('ledger')}
          />
        )}

        {/* 8. B2B SEAMLESS WORKBENCH (Developer & Architect View) */}
        {['workbench', 'latency', 'stress', 'hmac', 'ledger', 'architecture', 'code', 'deadlock'].includes(activeTab) && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* Workbench Navigation Header */}
            <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-base font-black text-white flex items-center space-x-2">
                  <Terminal className="w-5 h-5 text-cyan-400" />
                  <span>B2B Seamless Integration Workbench</span>
                </h1>
                <p className="text-xs text-slate-400 font-mono">
                  Test HTTP HMAC calls, &lt;4s SLA Latency Telemetry, 100-thread race conditions, row-level locks, and deadlock resolution.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    refreshState();
                    showToast('PostgreSQL Ledger & Wallets synced');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-mono flex items-center space-x-1.5 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Sync DB State</span>
                </button>
              </div>
            </div>

            {/* Live TPS Capacity Gauge Widget */}
            <TpsCapacityGauge
              onStressTestClick={() => {
                setWorkbenchSubTab('concurrency');
              }}
            />

            {/* Workbench Subtabs */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 font-mono text-xs scrollbar-none">
              {[
                { id: 'simulator', label: 'HTTP / API Simulator', icon: Zap },
                { id: 'security', label: 'Security & HMAC Guard', icon: ShieldCheck },
                { id: 'errors', label: `Firestore Errors (${systemErrors.length})`, icon: ShieldAlert, badge: newErrorsCount > 0 ? newErrorsCount : undefined },
                { id: 'latency', label: 'Latency SLA Monitor', icon: Activity },
                { id: 'cache', label: 'Cache & State Sync', icon: Layers },
                { id: 'autosync', label: 'Live Auto-Sync', icon: RefreshCw },
                { id: 'apiRate', label: 'API Rate Monitor', icon: Activity },
                { id: 'concurrency', label: '100-Thread Stress Test', icon: Activity },
                { id: 'deadlock', label: 'Deadlock Simulation', icon: AlertOctagon },
                { id: 'hmac', label: 'HMAC SHA-256 Inspector', icon: Lock },
                { id: 'ledger', label: 'PostgreSQL Ledger', icon: Layers },
                { id: 'code', label: 'API Code & Schema', icon: FileCode2 },
                { id: 'architecture', label: 'Architecture SLA Spec', icon: BookOpen }
              ].map((tab) => {
                const Icon = tab.icon;
                const isSelected = workbenchSubTab === tab.id || (activeTab === 'latency' && tab.id === 'latency');
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setWorkbenchSubTab(tab.id as any);
                      if (tab.id === 'latency') setActiveTab('latency');
                    }}
                    className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl font-bold whitespace-nowrap transition-all ${
                      isSelected
                        ? tab.id === 'errors'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-md'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-md'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${tab.id === 'errors' && newErrorsCount > 0 ? 'text-rose-400 animate-pulse' : ''}`} />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span className="bg-rose-500 text-slate-950 font-black px-1.5 py-0.2 rounded-full text-[9px]">
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Subtab Contents */}
            <div className="pt-2">
              {workbenchSubTab === 'simulator' && activeTab !== 'latency' && (
                <ProviderSimulator
                  currentUser={currentUser}
                  currentWallet={currentWallet}
                  onLedgerMutated={refreshState}
                />
              )}

              {workbenchSubTab === 'security' && (
                <SecurityDashboard />
              )}

              {workbenchSubTab === 'errors' && (
                <SystemErrorsMonitor
                  errors={systemErrors}
                  onTriggerTestError={triggerTestError}
                  onResolveError={resolveError}
                  onMarkInvestigating={markInvestigating}
                  onClearLocal={clearLocalErrors}
                />
              )}

              {workbenchSubTab === 'cache' && (
                <CacheDiagnostics />
              )}

              {workbenchSubTab === 'autosync' && (
                <WalletAutoSync />
              )}

              {workbenchSubTab === 'apiRate' && (
                <ApiRateMonitor />
              )}

              {(workbenchSubTab === 'latency' || activeTab === 'latency') && (
                <LatencyMonitor />
              )}

              {workbenchSubTab === 'concurrency' && (
                <ConcurrencyStressTester
                  currentUser={currentUser}
                  currentWallet={currentWallet}
                  onLedgerMutated={refreshState}
                />
              )}

              {workbenchSubTab === 'deadlock' && (
                <DeadlockSimulator
                  currentUser={currentUser}
                  currentWallet={currentWallet}
                  onLedgerMutated={refreshState}
                />
              )}

              {workbenchSubTab === 'hmac' && <HMACDebugger />}

              {workbenchSubTab === 'ledger' && <LedgerExplorer onRefresh={refreshState} />}

              {workbenchSubTab === 'code' && <CodeViewer />}

              {workbenchSubTab === 'architecture' && <ArchitectureGuide />}
            </div>
          </div>
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        allUsers={users}
        onSelectUser={(userId) => {
          switchUser(userId);
          showToast('VIP Player authentication successful');
        }}
      />

      {/* Global Mega Win & Celebration Modal */}
      {celebrationData && (
        <CelebrationModal
          isOpen={!!celebrationData}
          onClose={clearCelebration}
          title={celebrationData.title}
          subtitle={celebrationData.gameTitle || 'Mega Payout Triggered!'}
          rewardAmount={celebrationData.amount}
          currency={celebrationData.currency}
          type="MEGA_WIN"
        />
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 backdrop-blur-md border border-amber-500/40 text-amber-300 px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-xs font-mono animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating PWA Install Button for Mobile */}
      <InstallPwaButton isFloating />

      {/* Mobile Sticky Bottom Navigation (PWA / Mobile-First) */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenCashier={() => setActiveTab('cashier')}
      />

      {/* Luxury Footer */}
      <footer className="bg-[#05070b] border-t border-slate-800/80 py-6 text-xs text-slate-400 pb-20 lg:pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-white font-mono">
              Playall 365 Primary System • B2B Seamless Architecture
            </span>
          </div>

          <div className="flex items-center space-x-6 text-[11px] font-mono text-slate-400">
            <span>🇧🇩 bKash / Nagad Direct Gateway</span>
            <span>🔒 HMAC-SHA256 Signed</span>
            <span>⚡ SLA &lt; 4s Response Time</span>
            <span>🛡️ PostgreSQL ACID Row-Locked</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <WalletGameProvider>
            <Playall365InnerApp />
          </WalletGameProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
