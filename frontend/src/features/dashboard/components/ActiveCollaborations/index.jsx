import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getMarketplacePosts } from "../../../../shared/services/api";

const TYPE_ICONS = { Job: "💼", Event: "📅", Project: "🚀" };

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ActiveCollaborations() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getMarketplacePosts(token);
      const list = Array.isArray(data) ? data : data?.listings || [];
      setItems(list.filter(i => i.status !== "closed").slice(0, 5));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const onUpdate = () => fetch();
    window.addEventListener("dashboard-updated", onUpdate);
    return () => window.removeEventListener("dashboard-updated", onUpdate);
  }, [fetch]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => <div key={i} className="h-12 rounded-lg shimmer-skeleton" />)}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
        <p className="text-xs text-gray-500">No active collaborations</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {items.map(item => (
        <button
          key={item._id}
          onClick={() => navigate("/marketplace")}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition text-left"
        >
          <span className="text-lg shrink-0">{TYPE_ICONS[item.type] || "📌"}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{item.title}</p>
            <p className="text-xs text-gray-500">{item.type} · {timeAgo(item.createdAt)}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

export default ActiveCollaborations;
