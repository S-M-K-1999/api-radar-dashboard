"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { Activity, AlertCircle, CheckCircle2, Clock, Key, BarChart3, TrendingUp, Loader2 } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://api-radar.onrender.com";

export default function Dashboard() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [logs, setLogs] = useState([]);
  const [analytics, setAnalytics] = useState({ total_requests: 0, error_rate: "0%", avg_latency: "0ms", p95_latency: "0ms" });
  const [apiKey, setApiKey] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- Logic: Sync Project (Run Once) ---
  const syncProject = async (token) => {
    try {
      const res = await fetch(`${BACKEND_URL}/v1/projects/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      setApiKey(data.api_key);
      return data.api_key;
    } catch (err) {
      console.error("Sync Error:", err);
      return null;
    }
  };

  // --- Logic: Fetch Dashboard Data (Logs + Analytics) ---
  const refreshDashboardData = useCallback(async (token, currentApiKey) => {
    if (!currentApiKey) return;
    try {
      // Run both fetches in parallel for speed
      const [logsRes, statsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/v1/logs/${currentApiKey}`, { headers: { "Authorization": `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/v1/analytics/${currentApiKey}`, { headers: { "Authorization": `Bearer ${token}` } })
      ]);

      const [logsData, statsData] = await Promise.all([logsRes.json(), statsRes.json()]);

      setLogs(logsData.data || []);
      setAnalytics(statsData);
    } catch (err) {
      console.error("Data Fetch Error:", err);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    let intervalId;

    const init = async () => {
      setLoading(true);
      const token = await window.Clerk.session.getToken();
      const activeKey = await syncProject(token);

      if (activeKey) {
        await refreshDashboardData(token, activeKey);

        // Poll every 10s for fresh data
        intervalId = setInterval(async () => {
          const freshToken = await window.Clerk.session.getToken();
          await refreshDashboardData(freshToken, activeKey);
        }, 10000);
      }
      setLoading(false);
    };

    init();
    return () => clearInterval(intervalId);
  }, [isLoaded, isSignedIn, refreshDashboardData]);

  // --- Chart Data Processing ---
  const chartData = useMemo(() => {
    return [...logs].reverse().map((l, i) => ({
      name: i,
      latency: l.latency,
      time: new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));
  }, [logs]);

  if (!isLoaded || !isSignedIn) return null;

  if (loading && !apiKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
        <p className="text-slate-500 font-medium">Connecting to APIRadar Engine...</p>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto p-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-3 text-blue-600">
          <Activity size={32} strokeWidth={2.5} />
          <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">APIRadar</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-full text-slate-400 shadow-sm">
            <Key size={10} className="text-blue-500" /> {apiKey}
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* Metrics Grid - Now using Real Backend Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <MetricCard title="Avg Latency" value={analytics.avg_latency} icon={<Clock className="text-blue-500" />} />
        <MetricCard title="P95 Latency" value={analytics.p95_latency} icon={<TrendingUp className="text-purple-500" />} />
        <MetricCard title="Success Rate" value={`${100 - parseFloat(analytics.error_rate)}%`} icon={<CheckCircle2 className="text-emerald-500" />} />
        <MetricCard title="Total Requests" value={analytics.total_requests} icon={<BarChart3 className="text-amber-500" />} />
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mb-8">
        <div className="flex items-center gap-2 mb-8">
          <div className="p-2 bg-blue-50 rounded-xl"><TrendingUp size={18} className="text-blue-600" /></div>
          <h2 className="font-bold text-slate-800">Latency Trend (ms)</h2>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorLat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="time" hide />
              <YAxis fontSize={12} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
              <Area type="monotone" dataKey="latency" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorLat)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-slate-400" />
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-widest">Inbound Requests</h3>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2.5 py-1 rounded-full animate-pulse">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> LIVE
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
              <tr>
                <th className="p-5">Status</th>
                <th className="p-5">Method</th>
                <th className="p-5">Endpoint</th>
                <th className="p-5 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.length === 0 ? (
                <tr><td colSpan="4" className="p-20 text-center text-slate-400 italic">Listening for incoming traffic...</td></tr>
              ) : (
                logs.map((log, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors cursor-default">
                    <td className="p-5">
                      <span className={`px-3 py-1 rounded-full text-xs font-black ${log.status >= 400 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="p-5 font-bold text-slate-700 tracking-tighter">{log.method}</td>
                    <td className="p-5 text-slate-500 font-mono text-[11px] truncate max-w-xs">{log.url}</td>
                    <td className="p-5 text-slate-400 text-right text-xs font-medium tabular-nums">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function MetricCard({ title, value, icon }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 hover:border-blue-100 transition-colors">
      <div className="p-4 bg-slate-50 rounded-2xl">{icon}</div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
      </div>
    </div>
  );
}