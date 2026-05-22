import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getCommunities } from "../../../../shared/services/api";

function ActiveCommunities() {
  const navigate = useNavigate();
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getCommunities(token);
      setCommunities(Array.isArray(data) ? data : []);
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
        {[1, 2].map(i => <div key={i} className="h-14 rounded-lg shimmer-skeleton" />)}
      </div>
    );
  }

  if (communities.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
        <p className="text-xs text-gray-500">No communities yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {communities.slice(0, 5).map(c => (
        <button
          key={c._id}
          onClick={() => navigate(`/communities/${c._id}`)}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition text-left"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 text-xs font-bold text-white">
            {c.name?.charAt(0) || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{c.name}</p>
            <p className="text-xs text-gray-500">{c.members?.length || 0} members</p>
          </div>
        </button>
      ))}
    </div>
  );
}

export default ActiveCommunities;
