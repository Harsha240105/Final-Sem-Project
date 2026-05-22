import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Search, Users, Compass, Filter, X, BadgeCheck, GraduationCap, Sparkles, UserPlus } from "lucide-react";
import { useAuth } from "../../shared/hooks/useAuth";
import { discoverUsers } from "../../shared/services/api";
import FollowButton from "../../shared/components/FollowButton";
import ProfileLink from "../../shared/components/ProfileLink";
import VerifiedBadge from "../../shared/components/VerifiedBadge";

const API_ORIGIN = "http://localhost:5001";

function resolveAvatar(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function UserCard({ user }) {
  const navigate = useNavigate();
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const userId = user._id || user.id;
  const avatarUrl = resolveAvatar(user.avatar);
  const initials = getInitials(user.name);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -8, y: x * 8 });
  };
  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ type: "spring", damping: 20, stiffness: 260 }}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transformStyle: "preserve-3d" }}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-gray-900/80 via-gray-900/40 to-gray-800/30 p-4 transition-all duration-300 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5 cursor-pointer"
      onClick={() => navigate(`/profile/${userId}`)}
    >
      {/* Hover glow */}
      <motion.div
        className="absolute -inset-20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at ${50 + tilt.y}% ${50 + tilt.x}%, rgba(168,85,247,0.06), transparent 60%)`,
        }}
      />

      <div className="relative flex items-start gap-4">
        {/* Avatar */}
        <motion.div
          animate={{ rotateX: tilt.x, rotateY: tilt.y }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="relative flex-shrink-0"
        >
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center text-lg font-bold text-white overflow-hidden ring-1 ring-white/[0.06] group-hover:ring-purple-500/30 transition-all duration-300">
            {avatarUrl ? (
              /\.(mp4|webm)(\?|$)/i.test(avatarUrl) ? (
                <video src={avatarUrl} muted autoPlay loop playsInline className="h-full w-full object-cover" />
              ) : (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
              )
            ) : (
              <span className="bg-gradient-to-br from-purple-300 to-cyan-300 bg-clip-text text-transparent">{initials}</span>
            )}
          </div>
          {/* Online indicator */}
          {user.online && (
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-gray-900 bg-emerald-400"
            />
          )}
        </motion.div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ProfileLink userId={userId} className="text-sm font-bold text-white truncate hover:text-purple-300 transition-colors">
              {user.name}
            </ProfileLink>
            {user.verified && <VerifiedBadge status="verified" role={user.role} size="sm" />}
          </div>

          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-gray-400 capitalize border border-white/[0.04]">
              <GraduationCap className="h-2.5 w-2.5" />
              {user.role || "student"}
            </span>
            {user.institutionName && (
              <span className="text-[10px] text-gray-500 truncate">· {user.institutionName}</span>
            )}
          </div>

          {/* Bio preview */}
          {user.bio && (
            <p className="text-[11px] text-gray-500 mt-1.5 line-clamp-2">{user.bio}</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <motion.span
              whileHover={{ scale: 1.05 }}
              className="text-[11px] text-gray-400"
            >
              <span className="font-bold text-gray-200">{user.stats?.followers ?? 0}</span>
              <span className="ml-0.5 text-gray-500">followers</span>
            </motion.span>
            <span className="text-[11px] text-gray-400">
              <span className="font-bold text-gray-200">{user.stats?.following ?? 0}</span>
              <span className="ml-0.5 text-gray-500">following</span>
            </span>
            {(user.nftCount || 0) > 0 && (
              <span className="text-[11px] text-gray-400">
                <span className="font-bold text-amber-400">{user.nftCount}</span>
                <span className="ml-0.5 text-gray-500">NFTs</span>
              </span>
            )}
            {(user.communityCount || 0) > 0 && (
              <span className="text-[11px] text-gray-400">
                <span className="font-bold text-cyan-400">{user.communityCount}</span>
                <span className="ml-0.5 text-gray-500">communities</span>
              </span>
            )}
          </div>
        </div>

        {/* Follow + Profile buttons */}
        <div className="flex flex-col gap-1.5 items-end" onClick={(e) => e.stopPropagation()}>
          <FollowButton
            userId={userId}
            size="sm"
            compact
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={(e) => { e.stopPropagation(); navigate(`/profile/${userId}`); }}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[10px] font-medium text-gray-400 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            Profile
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Discover() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) { setLoading(false); return; }
      const data = await discoverUsers(token, debouncedSearch);
      setUsers(data?.users || []);
    } catch (err) {
      console.error("Failed to discover users:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter((u) => {
    if (roleFilter === "all") return true;
    return (u.role || "student") === roleFilter;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-gray-900/80 via-gray-900/40 to-purple-950/30 p-5 md:p-6"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 blur-[80px] rounded-full" />
        <div className="relative flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Compass className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Discover People</h1>
            <p className="text-sm text-gray-400">Find and connect with students, teachers, and creators</p>
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="hidden md:flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.04]"
          >
            <Sparkles className="h-4 w-4 text-purple-400" />
          </motion.div>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, college, or role..."
              className="w-full rounded-xl border border-white/[0.06] bg-black/40 pl-10 pr-10 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500/40 focus:bg-black/60 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {["all", "student", "teacher", "admin"].map((role) => (
              <motion.button
                key={role}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setRoleFilter(role)}
                className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                  roleFilter === role
                    ? "bg-purple-500/20 border border-purple-500/30 text-purple-300"
                    : "bg-white/[0.03] border border-white/[0.06] text-gray-400 hover:bg-white/[0.06]"
                }`}
              >
                {role}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Results header */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between"
      >
        <p className="text-xs text-gray-500">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border border-cyan-500/30 border-t-cyan-400" />
              Searching...
            </span>
          ) : (
            <>
              <span className="font-semibold text-gray-300">{filteredUsers.length}</span>
              {" "}user{filteredUsers.length !== 1 ? "s" : ""} found
              {debouncedSearch && <span className="text-gray-600"> for "<span className="text-gray-400">{debouncedSearch}</span>"</span>}
            </>
          )}
        </p>
        {roleFilter !== "all" && (
          <button
            onClick={() => setRoleFilter("all")}
            className="text-[10px] text-purple-400 hover:text-purple-300 font-medium"
          >
            Clear filter
          </button>
        )}
      </motion.div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-3 md:grid-cols-2"
          >
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse" />
            ))}
          </motion.div>
        ) : filteredUsers.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.04] bg-white/[0.01] py-16 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-800 to-gray-700 border border-white/[0.06]">
              <Users className="h-7 w-7 text-gray-500" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {debouncedSearch ? "No results found" : "No users to discover"}
            </h3>
            <p className="mt-1 text-sm text-gray-500 max-w-md">
              {debouncedSearch
                ? "Try a different name, college, or role filter"
                : "Invite more people to join the platform!"}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid gap-3 md:grid-cols-2"
          >
            <AnimatePresence>
              {filteredUsers.map((u) => (
                <UserCard key={u._id || u.id} user={u} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
