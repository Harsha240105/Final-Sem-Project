import { useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSocket } from "../context/SocketContext";

const ACTIVITY_ICONS = {
  task_completed: "✅",
  nft_minted: "🎨",
  certificate_claimed: "🏅",
  community_joined: "🏛️",
  follow: "👤",
  marketplace_post: "📦",
  leaderboard_change: "📊",
  generic: "⚡",
};

const ACTIVITY_COLORS = {
  task_completed: "border-l-green-400 bg-green-500/5",
  nft_minted: "border-l-purple-400 bg-purple-500/5",
  certificate_claimed: "border-l-yellow-400 bg-yellow-500/5",
  community_joined: "border-l-cyan-400 bg-cyan-500/5",
  follow: "border-l-blue-400 bg-blue-500/5",
  marketplace_post: "border-l-pink-400 bg-pink-500/5",
  leaderboard_change: "border-l-orange-400 bg-orange-500/5",
  generic: "border-l-gray-400 bg-white/[0.02]",
};

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ActivityFeed({ maxHeight = 320, maxItems = 20 }) {
  const { liveActivities } = useSocket();
  const prevLengthRef = useRef(liveActivities.length);

  const activities = useMemo(() => {
    return liveActivities.slice(0, maxItems);
  }, [liveActivities, maxItems]);

  const isNew = activities.length > prevLengthRef.current;
  prevLengthRef.current = activities.length;

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center py-10 text-center">
        <span className="text-2xl mb-2 opacity-30">⚡</span>
        <p className="text-xs text-gray-500">No activity yet</p>
        <p className="text-[10px] text-gray-600 mt-1">Complete tasks, join communities, or earn certificates to see activity here</p>
      </div>
    );
  }

  return (
    <div className="space-y-1" style={{ maxHeight, overflowY: "auto" }}>
      <AnimatePresence initial={false}>
        {activities.map((a, i) => {
          const icon = ACTIVITY_ICONS[a.type] || ACTIVITY_ICONS.generic;
          const color = ACTIVITY_COLORS[a.type] || ACTIVITY_COLORS.generic;
          return (
            <motion.div
              key={a._id}
              initial={i === 0 && isNew ? { opacity: 0, x: -10, height: 0 } : false}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0, x: 10, height: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className={`flex items-start gap-2.5 rounded-lg border-l-2 px-3 py-2 ${color} transition hover:bg-white/[0.04]`}
            >
              <span className="mt-0.5 text-sm shrink-0">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-gray-200 leading-relaxed">{a.message}</p>
                <p className="text-[9px] text-gray-600 mt-0.5">{timeAgo(a.createdAt)}</p>
              </div>
              {i === 0 && isNew && (
                <span className="shrink-0 h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse mt-1.5" />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default ActivityFeed;
