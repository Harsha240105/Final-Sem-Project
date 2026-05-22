import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Users, UserPlus, Search, ArrowLeft } from "lucide-react";
import { useAuth } from "../../shared/hooks/useAuth";
import { getConnectionsOverview } from "../../shared/services/api";
import ProfileLink from "../../shared/components/ProfileLink";
import FollowButton from "../../shared/components/FollowButton";

const TABS = [
  { id: "followers", label: "Followers" },
  { id: "following", label: "Following" },
];

function getInitials(name) {
  if (!name) return "?";
  return name.split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

function UserRow({ user, type }) {
  const userId = user._id || user.id;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-purple-500/20 hover:bg-white/[0.04]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 text-sm font-bold text-white ring-1 ring-white/10">
        {getInitials(user.name)}
      </div>
      <div className="min-w-0 flex-1">
        <ProfileLink userId={userId} className="text-sm font-semibold text-white hover:text-purple-300 transition-colors">
          {user.name}
        </ProfileLink>
        <p className="text-xs text-gray-500 capitalize">{user.role || "student"}</p>
      </div>
      <FollowButton userId={userId} size="sm" compact />
    </motion.div>
  );
}

export default function Connections() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("followers");
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadOverview = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getConnectionsOverview(token, search);
      setOverview(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const followers = overview?.followers || [];
  const following = overview?.following || [];
  const displayList = activeTab === "followers" ? followers : following;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] text-gray-400 hover:text-white transition"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Connections</h1>
          <p className="text-sm text-gray-400">
            {overview?.stats?.followers || 0} followers · {overview?.stats?.following || 0} following
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search connections..."
          className="w-full rounded-xl border border-white/[0.06] bg-black/40 pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500/40 transition-all"
        />
      </div>

      <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/[0.02] border border-white/[0.04]" />
          ))}
        </div>
      ) : displayList.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <Users className="h-6 w-6 text-gray-500" />
          </div>
          <h3 className="text-base font-bold text-white">No connections yet</h3>
          <p className="mt-1 text-sm text-gray-500">Connect with other users to build your network</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayList.map(u => (
            <UserRow key={u._id || u.id} user={u} type={activeTab} />
          ))}
        </div>
      )}
    </div>
  );
}
