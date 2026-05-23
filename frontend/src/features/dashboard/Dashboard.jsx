import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../shared/hooks/useAuth";
import { useSocket } from "../../shared/services/SocketContext";
import { getDashboardConnectionStats } from "../../shared/services/api";
import ActiveCommunities from "./components/ActiveCommunities";
import ActiveCollaborations from "./components/ActiveCollaborations";
import RecentMessages from "./components/RecentMessages";
import PendingTasks from "./components/PendingTasks";
import NFTCertificates from "./components/NFTCertificates";
import WorkspaceActivity from "./components/WorkspaceActivity";

function StatCard({ label, value, icon, color, loading }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent p-4 transition-all hover:border-white/[0.12] hover:shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-lg ${color}`}>{icon}</span>
        {loading ? (
          <div className="h-6 w-12 rounded shimmer-skeleton" />
        ) : (
          <span className={`text-xl font-bold ${color}`}>{value ?? "—"}</span>
        )}
      </div>
      <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{label}</p>
    </div>
  );
}

const STATS = [
  { key: "followers", label: "Followers", icon: "👥", color: "text-cyan-400" },
  { key: "following", label: "Following", icon: "🔗", color: "text-purple-400" },
  { key: "mutual", label: "Mutual", icon: "🔄", color: "text-emerald-400" },
  { key: "communities", label: "Communities", icon: "🏛️", color: "text-amber-400" },
  { key: "tasks", label: "Tasks", icon: "📋", color: "text-rose-400" },
  { key: "certificates", label: "Certificates", icon: "🏅", color: "text-yellow-400" },
];

function Dashboard() {
  const { user } = useAuth();
  const { connected } = useSocket();
  const [connectionStats, setConnectionStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getDashboardConnectionStats(token);
      setConnectionStats(data?.stats || null);
    } catch {
      // silent
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const statValues = connectionStats ? {
    followers: connectionStats.followers,
    following: connectionStats.following,
    mutual: connectionStats.mutual,
    communities: "—",
    tasks: "—",
    certificates: "—",
  } : {};

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"} shadow-[0_0_6px_${connected ? "rgba(74,222,128,0.5)" : "rgba(248,113,113,0.5)"}]`} />
          <span className="text-xs text-slate-500">{connected ? "Live" : "Offline"}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STATS.map((s) => (
          <StatCard
            key={s.key}
            label={s.label}
            icon={s.icon}
            color={s.color}
            value={statValues[s.key]}
            loading={statsLoading}
          />
        ))}
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 md:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm">🏛️</span>
            <h2 className="text-sm font-semibold text-white">Active Communities</h2>
          </div>
          <ActiveCommunities />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 md:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm">🤝</span>
            <h2 className="text-sm font-semibold text-white">Active Collaborations</h2>
          </div>
          <ActiveCollaborations />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 md:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm">💬</span>
            <h2 className="text-sm font-semibold text-white">Recent Messages</h2>
          </div>
          <RecentMessages />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 md:col-span-1">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm">📋</span>
            <h2 className="text-sm font-semibold text-white">Pending Tasks</h2>
          </div>
          <PendingTasks />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 md:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm">🏅</span>
            <h2 className="text-sm font-semibold text-white">NFT Certificates</h2>
          </div>
          <NFTCertificates />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 md:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm">⚡</span>
            <h2 className="text-sm font-semibold text-white">Workspace Activity</h2>
          </div>
          <WorkspaceActivity />
        </div>
      </div>
    </div>
  );
}

export default Dashboard;