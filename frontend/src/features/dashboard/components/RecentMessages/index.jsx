import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getConversations } from "../../../../shared/services/api";

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

function RecentMessages() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getConversations(token);
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 15000);
    return () => clearInterval(interval);
  }, [fetch]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg shimmer-skeleton" />)}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
        <p className="text-xs text-gray-500">No messages yet</p>
      </div>
    );
  }

  const currentUserId = (() => {
    try {
      const t = localStorage.getItem("token");
      if (!t) return null;
      return JSON.parse(atob(t.split(".")[1])).id;
    } catch { return null; }
  })();

  return (
    <div className="space-y-1">
      {conversations.slice(0, 5).map(c => {
        const other = c.participants?.find(p => (p._id || p) !== currentUserId);
        const name = other?.name || "Unknown";
        const lastMsg = c.lastMessage;
        return (
          <button
            key={c._id}
            onClick={() => {
              const otherId = other?._id || other;
              if (otherId) navigate(`/messages/${otherId}`);
            }}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition text-left"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-xs font-bold text-white">
              {getInitials(name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-white truncate">{name}</p>
                {lastMsg?.createdAt && (
                  <span className="text-[10px] text-gray-500 shrink-0">{timeAgo(lastMsg.createdAt)}</span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate">{lastMsg?.text || "No messages"}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default RecentMessages;
