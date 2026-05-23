import { useState, useEffect, useCallback, memo } from "react";
import { getCommunityStats } from "../../../../shared/services/api";

function Bar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-[10px] text-gray-400 text-right shrink-0">{label}</span>
      <div className="flex-1 h-4 rounded-full bg-white/[0.04] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-10 text-[10px] text-gray-300 font-mono text-right shrink-0">{value}/{max}</span>
    </div>
  );
}

function TaskStats({ communityId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getCommunityStats(communityId, token);
      setStats(data);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="h-4 w-32 rounded shimmer-skeleton mb-4" />
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-4 rounded shimmer-skeleton" />)}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const maxTasks = Math.max(stats.totalTasks, 1);
  const maxSubs = Math.max(stats.totalSubmissions, 1);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h3 className="text-sm font-semibold text-white mb-4">📊 Task Analytics</h3>

      {/* Stat cards row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/10 p-3 text-center">
          <p className="text-lg font-bold text-cyan-400">{stats.totalTasks}</p>
          <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Total Tasks</p>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/10 p-3 text-center">
          <p className="text-lg font-bold text-emerald-400">{stats.completedTasks}</p>
          <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Completed</p>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-purple-500/10 to-violet-500/5 border border-purple-500/10 p-3 text-center">
          <p className="text-lg font-bold text-purple-400">{stats.totalSubmissions}</p>
          <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Submissions</p>
        </div>
        <div className="rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/10 p-3 text-center">
          <p className="text-lg font-bold text-amber-400">{stats.approvedSubmissions}</p>
          <p className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">Approved</p>
        </div>
      </div>

      {/* Progress bars */}
      <div className="space-y-2.5">
        <Bar label="Task Completion" value={stats.completedTasks} max={maxTasks} color="#22d3ee" />
        <Bar label="Submission Rate" value={stats.totalSubmissions} max={maxTasks * 3} color="#a78bfa" />
        <Bar label="Approval Rate" value={stats.approvedSubmissions} max={maxSubs} color="#34d399" />
        <Bar label="Members" value={stats.totalMembers} max={Math.max(stats.totalMembers, 1)} color="#f59e0b" />
        <Bar label="Collaborations" value={stats.totalCollaborations} max={Math.max(stats.totalCollaborations, 1)} color="#f472b6" />
      </div>

      {/* Status badge */}
      <div className="mt-4 flex items-center gap-3 text-[10px] text-gray-500">
        <span>Status: <span className={`font-semibold ${stats.status === "active" ? "text-green-400" : stats.status === "archived" ? "text-red-400" : "text-yellow-400"}`}>{stats.status}</span></span>
        {stats.completionType && <span>Type: <span className="text-gray-300 font-semibold">{stats.completionType}</span></span>}
        {stats.archivedAt && <span>Archived: {new Date(stats.archivedAt).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}

export default memo(TaskStats);