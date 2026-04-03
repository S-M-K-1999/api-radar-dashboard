"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { Activity, AlertCircle, CheckCircle2, Clock, Key, BarChart3, TrendingUp, Loader2, Plus, ChevronDown, LayoutGrid } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://api-radar.onrender.com";

export default function Dashboard() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [logs, setLogs] = useState([]);
  const [analytics, setAnalytics] = useState({ total_requests: 0, error_rate: "0%", avg_latency: "0ms", p95_latency: "0ms" });
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isInitialMount, setIsInitialMount] = useState(true);
  const pollingInterval = useRef(null); // Step 1: Create the Ref

  // 1. Memoize fetchProjects correctly
  const fetchProjects = useCallback(async (token) => {
    try {
      const res = await fetch(`${BACKEND_URL}/v1/projects/`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      const fetchedProjects = data.projects || [];
      setProjects(fetchedProjects);
      return fetchedProjects;
    } catch (err) {
      console.error("Fetch Projects Error:", err);
      return [];
    }
  }, []); // Keep dependencies empty so this function is stable

  // --- 2. Create New Project ---
  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const token = await window.Clerk.session.getToken();
    try {
      const res = await fetch(`${BACKEND_URL}/v1/projects/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ name: newProjectName }),
      });
      const newProj = await res.json();
      setProjects([newProj, ...projects]);
      setSelectedProject(newProj);
      setNewProjectName("");
      setIsCreating(false);
    } catch (err) {
      console.error("Create Error:", err);
    }
  };

  const clearDashboardData = () => {
    setLogs([]);
    setAnalytics({
      total_requests: 0,
      error_rate: "0%",
      avg_latency: "0ms",
      p95_latency: "0ms"
    });
  };

  // --- 3. Refresh Analytics/Logs for Selected Project ---
  const refreshData = useCallback(async (token, key) => {
    if (!key) return;
    try {
      const [logsRes, statsRes] = await Promise.all([
        fetch(`${BACKEND_URL}/v1/logs/${key}`, { headers: { "Authorization": `Bearer ${token}` } }),
        fetch(`${BACKEND_URL}/v1/analytics/${key}`, { headers: { "Authorization": `Bearer ${token}` } })
      ]);
      const [logsData, statsData] = await Promise.all([logsRes.json(), statsRes.json()]);
      setLogs(logsData.data || []);
      setAnalytics(statsData);
    } catch (err) {
      console.error("Refresh Error:", err);
    }
  }, []);

  // 2. Updated useEffect
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    // This flag will tell us if the effect has been "cleaned up" 
    // because the user switched projects mid-fetch
    let isSubscribed = true;

    const init = async () => {
      // 1. Kill any existing timer immediately
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }

      if (isInitialMount) setLoading(true);

      try {
        const token = await window.Clerk.session.getToken();
        const allProjects = await fetchProjects(token);

        // If the user switched projects while we were fetching the token/list, STOP.
        if (!isSubscribed) return;

        const activeKey = selectedProject?.api_key || allProjects?.[0]?.api_key;

        if (activeKey) {
          if (!selectedProject && allProjects.length > 0) {
            setSelectedProject(allProjects[0]);
          }

          // Fetch initial data
          await refreshData(token, activeKey);

          if (!isSubscribed) return;

          // 2. Start the fresh timer
          pollingInterval.current = setInterval(async () => {
            if (!isSubscribed) return;
            const freshToken = await window.Clerk.session.getToken();
            await refreshData(freshToken, activeKey);
          }, 10000);
        }
      } catch (err) {
        console.error("Initialization Error:", err);
      } finally {
        if (isSubscribed) {
          setLoading(false);
          setIsInitialMount(false);
        }
      }
    };

    init();

    // 3. The Return function is the "Kill Switch"
    return () => {
      isSubscribed = false; // Prevents any pending async logic from finishing
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [isLoaded, isSignedIn, selectedProject?.api_key, fetchProjects, refreshData]);

  // --- Chart Data ---
  const chartData = useMemo(() => {
    return [...logs].reverse().map((l, i) => ({
      name: i,
      latency: l.latency,
      time: new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));
  }, [logs]);

  if (!isLoaded || !isSignedIn) return null;

  return (
    <main className="max-w-7xl mx-auto p-6 bg-slate-50 min-h-screen">
      {/* Header & Project Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-blue-600">
            <Activity size={28} strokeWidth={3} />
            <span className="font-black text-xl tracking-tighter text-slate-900">APIRadar</span>
          </div>

          <div className="h-6 w-[1px] bg-slate-200 hidden md:block" />

          {/* Project Dropdown */}
          <div className="relative group">
            <button className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 shadow-sm hover:border-blue-200 transition-all">
              <LayoutGrid size={16} className="text-blue-500" />
              {selectedProject?.project_name || "Select Project"}
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2">
              <p className="text-[10px] font-bold text-slate-400 px-3 py-2 uppercase tracking-widest">Your Projects</p>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    if (selectedProject?.id !== p.id) {
                      clearDashboardData(); // Clear old data immediately
                      setSelectedProject(p);
                    }
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${selectedProject?.id === p.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-50 text-slate-600'
                    }`}
                >
                  {p.project_name}
                </button>
              ))}
              <div className="h-[1px] bg-slate-50 my-2" />
              <button
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-blue-600 font-bold text-sm hover:bg-blue-50 rounded-xl transition-colors"
              >
                <Plus size={16} /> New Project
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {selectedProject && (
            <div className="hidden lg:flex items-center gap-2 text-[10px] font-mono bg-slate-900 text-slate-400 px-4 py-2 rounded-xl">
              <Key size={10} className="text-blue-400" /> {selectedProject.api_key}
            </div>
          )}
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* Main Content */}
      {projects.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border-2 border-dashed border-slate-200">
          <LayoutGrid size={48} className="text-slate-200 mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">No projects found</h2>
          <p className="text-slate-500 mb-6 text-sm">Create your first project to start monitoring APIs.</p>
          <button onClick={() => setIsCreating(true)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 hover:scale-105 transition-transform">
            <Plus size={18} /> Create Project
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <MetricCard title="Avg Latency" value={analytics.avg_latency} icon={<Clock className="text-blue-500" />} />
            <MetricCard title="P95 Latency" value={analytics.p95_latency} icon={<TrendingUp className="text-purple-500" />} />
            <MetricCard title="Success Rate" value={`${100 - parseFloat(analytics.error_rate)}%`} icon={<CheckCircle2 className="text-emerald-500" />} />
            <MetricCard title="Total Requests" value={analytics.total_requests} icon={<BarChart3 className="text-amber-500" />} />
          </div>

          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm mb-8">
            <h2 className="font-bold text-slate-800 mb-8 flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" /> Latency History (ms)
            </h2>
            <div className="h-72">
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
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                  <Area type="monotone" dataKey="latency" stroke="#2563eb" strokeWidth={4} fillOpacity={1} fill="url(#colorLat)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Simple Modal for New Project */}
      {isCreating && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Create New Project</h3>
            <p className="text-slate-500 text-sm mb-6">Give your project a name to get a new API key.</p>
            <input
              autoFocus
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              placeholder="e.g. My Portfolio API"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <div className="flex gap-3">
              <button onClick={() => setIsCreating(false)} className="flex-1 px-6 py-4 rounded-2xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleCreateProject} className="flex-1 bg-blue-600 text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors">Create</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function MetricCard({ title, value, icon }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5">
      <div className="p-4 bg-slate-50 rounded-2xl">{icon}</div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-2xl font-black text-slate-900 tabular-nums">{value}</p>
      </div>
    </div>
  );
}