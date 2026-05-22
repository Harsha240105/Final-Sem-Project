import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Trophy, Medal, Users, Award, ChevronUp, Crown, Sparkles, TrendingUp } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { getLeaderboard, API_SERVER_ORIGIN } from "../services/api";
import FollowButton from "../components/FollowButton";
import VerifiedBadge from "../components/VerifiedBadge";
import ParticleField from "../components/ParticleField";

function resolveAvatar(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_SERVER_ORIGIN}${path}`;
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatCount(num) {
  if (!num) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

const RANK_STYLES = {
  0: {
    gradient: "from-amber-400 via-yellow-500 to-orange-400",
    glow: "shadow-amber-500/30",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    text: "text-amber-300",
    icon: Crown,
    bar: "bg-gradient-to-r from-amber-400 to-yellow-500",
    barWidth: "w-full",
  },
  1: {
    gradient: "from-gray-300 via-gray-400 to-slate-400",
    glow: "shadow-gray-400/20",
    bg: "bg-gray-400/10",
    border: "border-gray-400/30",
    text: "text-gray-300",
    icon: Medal,
    bar: "bg-gradient-to-r from-gray-300 to-gray-400",
    barWidth: "w-4/5",
  },
  2: {
    gradient: "from-orange-400 via-red-400 to-rose-400",
    glow: "shadow-orange-500/20",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    text: "text-orange-300",
    icon: Medal,
    bar: "bg-gradient-to-r from-orange-400 to-red-400",
    barWidth: "w-3/5",
  },
};

function AnimatedNumber({ value, suffix = "" }) {
  const [display, setDisplay] = useState(0);
  const animRef = useRef(null);

  useEffect(() => {
    const start = display;
    const end = value;
    const duration = 600;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(start + (end - start) * eased));
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [value]);

  return <span>{display}{suffix}</span>;
}

function RankBar({ rank }) {
  const style = RANK_STYLES[rank];
  if (!style) return null;
  return (
    <div className={`h-1.5 rounded-full ${style.bar} ${style.barWidth} opacity-60`} />
  );
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [barActive, setBarActive] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getLeaderboard(token, page, 20, roleFilter);
      setUsers(data?.users || []);
      setTimeout(() => setBarActive(true), 100);
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.08 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 18, scale: 0.97 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  };

  const topThree = users.slice(0, 3);
  const rest = users.slice(3);

  return (
    <>
      <ParticleField count={25} color="purple" />
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="mx-auto max-w-4xl space-y-6 relative z-10"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="glass-card p-5 md:p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 blur-[80px] rounded-full" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/5 blur-[60px] rounded-full" />
          <div className="relative flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Leaderboard
                <Sparkles className="h-4 w-4 text-amber-400" />
              </h1>
              <p className="text-sm text-gray-400">Top users ranked by followers</p>
            </div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="hidden md:flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.04]"
            >
              <TrendingUp className="h-4 w-4 text-amber-400" />
            </motion.div>
          </div>

          {/* Role filter */}
          <div className="flex items-center gap-2 mt-4 relative">
            {["", "student", "teacher", "admin"].map((role) => (
              <motion.button
                key={role}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setRoleFilter(role); setPage(1); setBarActive(false); }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${
                  roleFilter === role
                    ? "bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-[0_0_12px_rgba(251,191,36,0.1)]"
                    : "text-gray-500 hover:text-gray-300 border border-transparent hover:bg-white/[0.03]"
                }`}
              >
                {role || "All"}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Podium (top 3) */}
        {!loading && topThree.length >= 3 && (
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3 items-end">
            {[1, 0, 2].map((rankIdx) => {
              const u = topThree[rankIdx];
              const style = RANK_STYLES[rankIdx];
              const initial = getInitials(u.name);
              const avatar = resolveAvatar(u.avatar);
              const isFirst = rankIdx === 0;
              return (
                <motion.div
                  key={u._id || u.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + rankIdx * 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className={`glass-card p-4 text-center cursor-pointer transition-all duration-300 hover:scale-[1.02] ${
                    isFirst ? "md:pb-6" : "md:pb-4"
                  }`}
                  onClick={() => navigate(`/profile/${u._id || u.id}`)}
                  style={{ transformOrigin: "bottom" }}
                >
                  <div className="relative inline-flex mb-2">
                    <div className={`h-14 w-14 md:h-16 md:w-16 rounded-full bg-gradient-to-br ${style.gradient} p-0.5 mx-auto shadow-lg ${style.glow}`}>
                      <div className="h-full w-full rounded-full bg-gray-950 flex items-center justify-center text-sm md:text-base font-bold text-white overflow-hidden">
                        {avatar ? (
                          <img src={avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          initial
                        )}
                      </div>
                    </div>
                    <div className={`absolute -top-1 -right-1 h-6 w-6 rounded-full bg-gradient-to-br ${style.gradient} flex items-center justify-center shadow-lg ${style.glow}`}>
                      <style.icon className="h-3 w-3 text-white" />
                    </div>
                    {u.online && (
                      <motion.span
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-gray-950 bg-emerald-400"
                      />
                    )}
                  </div>
                  <p className={`text-sm font-bold text-white truncate ${isFirst ? "text-base" : ""}`}>{u.name}</p>
                  <p className="text-[10px] text-gray-500 capitalize mt-0.5">{u.role || "student"}</p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <span className={`text-xs font-bold ${isFirst ? "text-amber-300" : "text-gray-300"}`}>
                      {formatCount(u.followerCount || u.stats?.followers || 0)}
                    </span>
                    <span className="text-[9px] text-gray-500">followers</span>
                  </div>
                  <RankBar rank={rankIdx} />
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* List */}
        <motion.div variants={itemVariants} className="space-y-2">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="glass-card p-4 shimmer-skeleton">
                  <div className="flex items-center gap-4">
                    <div className="h-9 w-9 rounded-lg bg-white/[0.03]" />
                    <div className="h-10 w-10 rounded-full bg-white/[0.03]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-32 rounded bg-white/[0.03]" />
                      <div className="h-2 w-20 rounded bg-white/[0.02]" />
                    </div>
                    <div className="h-4 w-16 rounded bg-white/[0.03]" />
                  </div>
                </div>
              ))}
            </div>
          ) : users.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Users className="h-8 w-8 text-gray-600 mx-auto" />
              <p className="mt-2 text-sm text-gray-500">No users found</p>
            </div>
          ) : (
            <>
              {/* Top 3 already shown above in podium, skip them in the list */}
              {(topThree.length >= 3 ? rest : users).map((u, idx) => {
                const actualRank = topThree.length >= 3 ? idx + 3 : idx;
                const rankStyle = RANK_STYLES[actualRank] || {
                  gradient: "",
                  glow: "",
                  bg: "bg-white/[0.02]",
                  border: "border-white/[0.06]",
                  text: "text-gray-500",
                  icon: null,
                };
                const avatarUrl = resolveAvatar(u.avatar);
                const initials = getInitials(u.name);
                const isCurrentUser = u._id === localStorage.getItem("userId") || u.id === localStorage.getItem("userId");
                const RankIcon = rankStyle.icon;

                return (
                  <motion.div
                    key={u._id || u.id}
                    variants={itemVariants}
                    className="glass-card p-3 transition-all cursor-pointer group hover:border-purple-500/20"
                    onClick={() => navigate(`/profile/${u._id || u.id}`)}
                    whileHover={{ y: -2, scale: 1.003 }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className={`flex items-center justify-center h-9 w-9 rounded-lg shrink-0 transition-all duration-300 ${
                        actualRank <= 2
                          ? `bg-gradient-to-br ${RANK_STYLES[actualRank].gradient} shadow-lg ${RANK_STYLES[actualRank].glow}`
                          : "bg-white/[0.04] group-hover:bg-white/[0.06]"
                      }`}>
                        {actualRank <= 2 && RankIcon ? (
                          <RankIcon className="h-4 w-4 text-white" />
                        ) : (
                          <span className="text-xs font-bold text-gray-500">{actualRank + 1}</span>
                        )}
                      </div>

                      {/* Avatar */}
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500/40 to-cyan-500/40 flex items-center justify-center text-sm font-bold text-white shrink-0 overflow-hidden ring-1 ring-white/[0.04] group-hover:ring-purple-500/30 transition-all">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white truncate group-hover:text-purple-300 transition-colors">{u.name}</p>
                          {u.verificationStatus === "verified" && (
                            <VerifiedBadge status="verified" role={u.role} />
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-gray-500 capitalize">{u.role || "student"}</span>
                          {u.institutionName && (
                            <span className="text-[10px] text-gray-500 truncate">· {u.institutionName}</span>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-center">
                          <p className="text-sm font-bold text-white"><AnimatedNumber value={u.followerCount || u.stats?.followers || 0} /></p>
                          <p className="text-[9px] text-gray-500 uppercase tracking-wider">Followers</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-gray-300"><AnimatedNumber value={u.followingCount || u.stats?.following || 0} /></p>
                          <p className="text-[9px] text-gray-500 uppercase tracking-wider">Following</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-cyan-400"><AnimatedNumber value={u.nftCount || u.certificateCount || 0} /></p>
                          <p className="text-[9px] text-gray-500 uppercase tracking-wider">NFTs</p>
                        </div>
                      </div>

                      {/* Follow button */}
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        {!isCurrentUser && (
                          <FollowButton
                            userId={u._id || u.id}
                            size="sm"
                          />
                        )}
                      </div>
                    </div>
                    {/* Animated progress bar for rank */}
                    {barActive && actualRank <= 2 && (
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="h-0.5 rounded-full mt-2"
                        style={{ transformOrigin: "left" }}
                      >
                        <div className={`h-full rounded-full ${RANK_STYLES[actualRank]?.bar || "bg-white/[0.04]"}`} />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </>
          )}
        </motion.div>
      </motion.div>
    </>
  );
}
