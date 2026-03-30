"use client";

import { useEffect, useState } from "react";
import { useUser, UserButton } from "@clerk/nextjs";
import { Activity, AlertCircle, CheckCircle2, Clock, Key } from "lucide-react";

export default function Dashboard() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [logs, setLogs] = useState([]);
  const [apiKey, setApiKey] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Sync User with Backend to get their unique API Key
  const syncUserAndFetchLogs = async () => {
    if (!isLoaded || !isSignedIn) return;

    try {
      // Sync user to get/create their API Key
      const syncRes = await fetch("http://127.0.0.1:8000/v1/projects/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
      const syncData = await syncRes.json();
      const userApiKey = syncData.api_key;
      setApiKey(userApiKey);

      // 2. Fetch logs using that specific API Key
      const logsRes = await fetch(`http://127.0.0.1:8000/v1/logs/${userApiKey}`);
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
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn) return null;

  return (
    <main className="max-w-7xl mx-auto p-8">
      {/* Header with User Profile */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Activity className="text-blue-600" />
            APIRadar Control Center
          </h1>
          <div className="flex items-center gap-2 mt-2 text-sm font-mono bg-gray-100 p-2 rounded-md text-gray-600">
            <Key size={14} /> {apiKey || "Generating key..."}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={syncUserAndFetchLogs} className="text-sm bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50">
            Refresh
          </button>
          <UserButton afterSignOutUrl="/"/>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-20 text-center text-gray-400">Loading your secure stream...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-gray-500 text-xs uppercase tracking-widest">
                  <th className="p-4">Status</th>
                  <th className="p-4">Method</th>
                  <th className="p-4">Endpoint</th>
                  <th className="p-4">Latency</th>
                  <th className="p-4">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.length === 0 ? (
                  <tr><td colSpan="5" className="p-10 text-center text-gray-400">No logs found. Start your SDK to see data!</td></tr>
                ) : (
                  logs.map((log, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${log.status >= 400 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-sm">{log.method}</td>
                      <td className="p-4 text-sm text-gray-600 font-mono truncate max-w-xs">{log.url}</td>
                      <td className="p-4 text-sm text-gray-500">{log.latency}ms</td>
                      <td className="p-4 text-sm text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}