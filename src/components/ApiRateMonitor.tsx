import React, { useState, useEffect } from 'react';
import { Activity, Zap, Shield, Server, BarChart2 } from 'lucide-react';
import { seamlessEngine } from '../services/simulatedWalletEngine';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

export const ApiRateMonitor: React.FC = () => {
  const [data, setData] = useState<{ time: string; rps: number; latency: number }[]>([]);
  const [currentRps, setCurrentRps] = useState(0);
  const [avgLatency, setAvgLatency] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const rateConfig = seamlessEngine.getRateLimitConfig();
      const rps = rateConfig.currentUsage;
      
      const history = seamlessEngine.getLatencyHistory();
      const recentLatency = history.filter(r => now - new Date(r.timestamp).getTime() < 2000);
      
      const latency = recentLatency.length > 0 
        ? Math.round(recentLatency.reduce((acc, curr) => acc + curr.latencyMs, 0) / recentLatency.length)
        : 0;
        
      setCurrentRps(rps);
      setAvgLatency(latency);

      const timeLabel = new Date().toLocaleTimeString([], { hour12: false, second: '2-digit', minute: '2-digit' });
      
      setData(prev => {
        const next = [...prev, { time: timeLabel, rps, latency }];
        if (next.length > 30) return next.slice(next.length - 30);
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const simulateBurst = () => {
    seamlessEngine.simulateTrafficBurst(20);
  };

  return (
    <div className="bg-[#0b0f19] border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 text-white font-mono">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-black flex items-center space-x-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span>API Rate Monitor (RPS & Latency)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time throughput and latency tracking. Simulates real-time D3 charts for server telemetry under load.
          </p>
        </div>
        <button
          onClick={simulateBurst}
          className="px-4 py-2 rounded-xl font-bold text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all flex items-center space-x-2"
        >
          <Zap className="w-4 h-4" />
          <span>Simulate Load Burst</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-center items-center">
          <div className="absolute top-3 left-3 flex items-center space-x-1.5 text-xs text-slate-500">
            <Server className="w-4 h-4" />
            <span>Throughput (RPS)</span>
          </div>
          <div className="mt-4 text-5xl font-black tabular-nums text-cyan-400">
            {currentRps}
          </div>
          <div className="text-xs text-slate-500 mt-2 uppercase tracking-wider font-bold">Reqs / Sec</div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-center items-center">
          <div className="absolute top-3 left-3 flex items-center space-x-1.5 text-xs text-slate-500">
            <Activity className="w-4 h-4" />
            <span>Avg Latency (1s)</span>
          </div>
          <div className={`mt-4 text-5xl font-black tabular-nums ${avgLatency > 2000 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {avgLatency}
          </div>
          <div className="text-xs text-slate-500 mt-2 uppercase tracking-wider font-bold">Milliseconds</div>
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 h-72">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-400" />
            Live Telemetry Graph
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height="85%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRps" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="time" stroke="#475569" fontSize={10} tickMargin={10} />
            <YAxis yAxisId="left" stroke="#06b6d4" fontSize={10} orientation="left" />
            <YAxis yAxisId="right" stroke="#10b981" fontSize={10} orientation="right" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
              itemStyle={{ fontWeight: 'bold' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
            <Area yAxisId="left" type="monotone" dataKey="rps" name="Requests/Sec" stroke="#06b6d4" fillOpacity={1} fill="url(#colorRps)" strokeWidth={2} isAnimationActive={false} />
            <Line yAxisId="right" type="monotone" dataKey="latency" name="Latency (ms)" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
