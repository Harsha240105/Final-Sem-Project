import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getMyTasks } from "../../../../shared/services/api";

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function PendingTasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getMyTasks(token);
      setTasks(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 15000);
    const onUpdate = () => fetch();
    window.addEventListener("dashboard-updated", onUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener("dashboard-updated", onUpdate);
    };
  }, [fetch]);

  const pending = tasks.filter(t => !t.completed_status);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg shimmer-skeleton" />)}
      </div>
    );
  }

  if (pending.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
        <div className="text-lg mb-1">✅</div>
        <p className="text-xs text-gray-500">All tasks completed</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {pending.slice(0, 5).map(t => (
        <div
          key={t._id}
          className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-yellow-400 shadow-[0_0_6px_rgba(255,209,102,0.4)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{t.title}</p>
            <p className="text-xs text-gray-500">{timeAgo(t.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default PendingTasks;
