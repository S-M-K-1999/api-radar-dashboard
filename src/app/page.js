"use client";

import { useEffect, useState, useMemo } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { Activity, AlertCircle, CheckCircle2, Clock, Key, BarChart3, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export default function Dashboard() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [logs, setLogs] = useState([]);
  const [apiKey, setApiKey] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncUserAndFetchLogs = async () => {
    if (!isLoaded || !isSignedIn) return;
    try {
      const syncRes = await fetch(`${BACKEND_URL}/v1/projects/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
      const syncData = await syncRes.json();
      const userApiKey = syncData.api_key;
      setApiKey(userApiKey);

      const logsRes = await fetch(`${BACKEND_URL}/v1/logs/${userApiKey}`);
      const logsData = await logsRes.json();
      setLogs(logsData.data || []);
    } catch (error) {
      console.error("Dashboard Sync Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncUserAndFetchLogs();
    const interval = setInterval(syncUserAndFetchLogs, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, [isLoaded, isSignedIn]);

  // --- Data Processing for Charts ---
  const stats = useMemo(() => {
    if (logs.length === 0) return { avgLatency: 0, successRate: 0, totalErrors: 0 };
    const total = logs.length;
    const errors = logs.filter(l => l.status >= 400).length;
    const latencySum = logs.reduce((acc, curr) => acc + curr.latency, 0);
    
    return {
      avgLatency: Math.round(latencySum / total),
      successRate: Math.round(((total - errors) / total) * 100),
      totalErrors: errors,
      chartData: [...logs].reverse().map((l, i) => ({ 
        name: i, 
        latency: l.latency,
        time: new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }))
    };
  }, [logs]);

  if (!isLoaded || !isSignedIn) return null;

  return (
    <main className="max-w-7xl mx-auto p-8 bg-slate-50 min-h-screen">
      {/* Top Navigation */}
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Activity size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">APIRadar</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-full text-slate-500 shadow-sm">
            <Key size={12} className="text-blue-500" /> {apiKey || "..."}
          </div>
          <UserButton afterSignOutUrl="/"/>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard title="Avg Latency" value={`${stats.avgLatency}ms`} icon={<Clock className="text-blue-500" />} />
        <MetricCard title="Success Rate" value={`${stats.successRate}%`} icon={<CheckCircle2 className="text-green-500" />} />
        <MetricCard title="Total Errors" value={stats.totalErrors} icon={<AlertCircle className="text-red-500" />} />
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mb-8">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp size={18} className="text-blue-500" />
          <h2 className="font-semibold text-slate-800">Latency Trend (ms)</h2>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.chartData}>
              <defs>
                <linearGradient id="colorLat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="time" hide />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
              <Area type="monotone" dataKey="latency" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorLat)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Log Table Section - Cleaner Version */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-50 flex items-center gap-2">
           <BarChart3 size={18} className="text-slate-400" />
           <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">Live Request Stream</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-slate-500 font-medium">
              <tr>
                <th className="p-4">Status</th>
                <th className="p-4">Method</th>
                <th className="p-4">Endpoint</th>
                <th className="p-4 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.length === 0 ? (
                <tr><td colSpan="4" className="p-10 text-center text-slate-400 italic">Listening for incoming API calls...</td></tr>
              ) : (
                logs.map((log, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-all cursor-default">
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${log.status >= 400 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-bold text-slate-700 uppercase tracking-tighter">{log.method}</td>
                    <td className="p-4 text-slate-600 font-mono text-xs truncate max-w-xs">{log.url}</td>
                    <td className="p-4 text-slate-400 text-right text-xs uppercase">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
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

// Reusable Metric Card Component
function MetricCard({ title, value, icon }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-5">
      <div className="p-3 bg-slate-50 rounded-xl">{icon}</div>
      <div>
        <p className="text-sm font-medium text-slate-500 mb-0.5">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}