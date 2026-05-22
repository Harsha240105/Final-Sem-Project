import { useMemo } from "react";
import { useSocket } from "../../../../shared/services/SocketContext";

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date)) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ICONS = {
  task_completed: "✅",
  nft_minted: "🎨",
  certificate_claimed: "🏅",
  community_joined: "🏛️",
  follow: "👤",
  marketplace_post: "📦",
};

function WorkspaceActivity() {
  const { liveActivities, connected } = useSocket();

  const activities = useMemo(() => {
    return liveActivities.slice(0, 10);
  }, [liveActivities]);

  return (
    <div className="space-y-1">
      {activities.length === 0 ? (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-center">
          <p className="text-xs text-gray-500">No recent activity</p>
          <p className="text-[10px] text-gray-600 mt-1">Complete tasks or join communities to see activity</p>
        </div>
      ) : (
        activities.map(a => (
          <div
            key={a._id}
            className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-white/[0.04] transition"
          >
            <span className="text-sm shrink-0 mt-0.5">{ICONS[a.type] || "⚡"}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-200 leading-snug">{a.message}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{timeAgo(a.createdAt)}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default WorkspaceActivity;
