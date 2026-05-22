import { useState, useEffect, useCallback, memo } from "react";
import { getCommunityTimeline } from "../../../../shared/services/api";
import { formatTime } from "../../utils";

const ACTION_ICONS = {
  complete_task: "✅",
  archive: "📦",
  add_resource: "📎",
  community_joined: "👋",
  community_left: "🚪",
  task_created: "📋",
  task_completed: "✅",
  collaboration_created: "🤝",
};

function CommunityTimeline({ communityId }) {
  const [timeline, setTimeline] = useState([]);

  const fetch = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getCommunityTimeline(communityId, token);
      setTimeline(data?.timeline || []);
    } catch { /* silent */ }
  }, [communityId]);

  useEffect(() => { fetch(); }, [fetch]);

  if (timeline.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h3 className="text-sm font-semibold text-white mb-3">📜 Activity Timeline</h3>
      <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
        {timeline.map((entry, i) => (
          <div key={entry._id || i} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <span className="text-sm">{ACTION_ICONS[entry.action] || "⚡"}</span>
              {i < timeline.length - 1 && <div className="w-px flex-1 bg-white/[0.04] mt-1" />}
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <p className="text-xs text-gray-300">
                <span className="font-medium text-white">{entry.actor?.name || "Someone"}</span>
                {" "}{entry.description || entry.action}
              </p>
              <p className="text-[10px] text-gray-600 mt-0.5">{formatTime(entry.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(CommunityTimeline);
