import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Award, BookOpen, Wallet, ExternalLink, Shield, MapPin } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import {
  getUserPublicProfile,
  getUserFollowers,
  getUserFollowing,
  getUserMutuals,
} from "../services/api";
import FollowButton from "../components/FollowButton";
import VerifiedBadge from "../components/VerifiedBadge";

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

function formatCount(num) {
  if (!num) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

export default function UserProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("followers");
  const [listData, setListData] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  const isSelf = currentUser?.id === userId || currentUser?._id === userId;

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getUserPublicProfile(userId, token);
      setProfile(data);
    } catch (err) {
      console.error("Failed to load user profile:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const fetchList = useCallback(async (tab) => {
    if (!userId) return;
    setListLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      let data;
      if (tab === "followers") data = await getUserFollowers(userId, token);
      else if (tab === "following") data = await getUserFollowing(userId, token);
      else if (tab === "mutuals") data = await getUserMutuals(userId, token);
      setListData(data?.users || []);
    } catch {
      setListData([]);
    } finally {
      setListLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchList(activeTab);
  }, [activeTab, fetchList]);

  const user = profile?.user || {};
  const stats = profile?.stats || {};
  const communities = profile?.communities || [];
  const recentCerts = profile?.recentCertificates || [];

  // Build the user full profile
  const fullUser = {
    ...user,
    ...stats,
  };

  const avatarUrl = resolveAvatar(user.avatar);
  const bannerUrl = resolveAvatar(user.banner);
  const initials = getInitials(user.name);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
          <p className="text-xs text-gray-500">Loading profile...</p>
        </div>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="mx-auto max-w-4xl space-y-6"
    >
      {/* Back button */}
      <motion.div variants={itemVariants}>
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
      </motion.div>

      {/* Profile Header */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-white/[0.08] bg-gradient-to-r from-white/[0.06] to-transparent backdrop-blur-md overflow-hidden"
      >
        {/* Banner */}
        <div
          className="h-28 bg-gradient-to-r from-purple-600/30 via-indigo-600/20 to-blue-600/30 relative"
          style={bannerUrl ? {
            backgroundImage: `url(${bannerUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          } : {}}
        >
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djJIMjR2LTJIMTJ2LTJoMTJ2LTJoLTEydi0yaDEydi0ySDEyVjIyaDEyVjIwSDEydi0yaDEydi0ySDEyVjE0aDI0djJIMjR2Mmg2djJIMjR2Mmg2djJIMjR2Mmg2djJIMjR2Mmg2djJIMjR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        </div>

        <div className="px-6 pb-6 -mt-12 relative z-10">
          <div className="flex flex-wrap items-end gap-5">
            {/* Avatar */}
            <div className="relative group">
              <motion.div
                className="h-24 w-24 rounded-2xl overflow-hidden ring-4 ring-gray-950 shadow-xl"
                whileHover={{ scale: 1.05 }}
              >
                {avatarUrl ? (
                  /\.(mp4|webm)(\?|$)/i.test(avatarUrl) ? (
                    <video src={avatarUrl} muted autoPlay loop playsInline className="h-full w-full object-cover" />
                  ) : (
                    <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                  )
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-500 text-2xl font-extrabold text-white">
                    {initials}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Name & Info */}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold text-white truncate">{user.name || "Unknown"}</h1>
                {user.verificationStatus === "verified" && (
                  <VerifiedBadge status="verified" role={user.role} />
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-purple-300 capitalize">
                  {user.role || "student"}
                </span>
                {user.institutionName && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
                    <MapPin className="h-2.5 w-2.5" />
                    {user.institutionName}
                  </span>
                )}
              </div>
              {user.bio && (
                <p className="mt-2 text-sm text-gray-400 max-w-lg">{user.bio}</p>
              )}
            </div>

            {/* Follow / Actions */}
            <div className="flex items-center gap-2 pb-1">
              {!isSelf && currentUser && (
                <FollowButton
                  userId={userId}
                  size="lg"
                />
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 mt-5 pt-4 border-t border-white/[0.06]">
            <div className="text-center">
              <p className="text-lg font-bold text-white">{formatCount(stats.followers)}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-white">{formatCount(stats.following)}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Following</p>
            </div>
            {stats.mutualConnections > 0 && (
              <div className="text-center">
                <p className="text-lg font-bold text-purple-400">{stats.mutualConnections}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Mutual</p>
              </div>
            )}
            {user.role !== "teacher" && (
              <div className="text-center">
                <p className="text-lg font-bold text-cyan-400">{stats.nftCount || 0}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">NFTs</p>
              </div>
            )}
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-400">{stats.communityCount || 0}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Communities</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Two column layout */}
      <div className="grid gap-5 md:grid-cols-3">
        {/* Left - Details */}
        <motion.div variants={itemVariants} className="md:col-span-1 space-y-4">
          {/* Wallet */}
          {user.walletAddress && (
            <div className="glass-card-premium p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Wallet</h3>
              <div className="flex items-center gap-2">
                <Wallet className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                <span className="font-mono text-xs text-gray-300 truncate">
                  {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                </span>
              </div>
            </div>
          )}

          {/* Recent Certificates (teachers issue certs, they don't earn them) */}
          {user.role !== "teacher" && recentCerts.length > 0 && (
            <div className="glass-card-premium p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Recent Certificates
              </h3>
              <div className="space-y-2">
                {recentCerts.map((cert, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
                    <Award className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="text-xs text-gray-300 truncate">
                      {cert.communityName || cert.title || `Certificate #${idx + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Right - Tabs */}
        <motion.div variants={itemVariants} className="md:col-span-2 space-y-4">
          {/* Communities */}
          {communities.length > 0 && (
            <div className="glass-card-premium p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Communities ({communities.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {communities.map((comm, idx) => (
                  <div
                    key={comm._id || idx}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2"
                  >
                    {comm.image ? (
                      <img src={resolveAvatar(comm.image)} alt="" className="h-5 w-5 rounded object-cover" />
                    ) : (
                      <BookOpen className="h-4 w-4 text-cyan-400" />
                    )}
                    <span className="text-xs text-gray-300">{comm.name || "Community"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Followers / Following / Mutuals Tabs */}
          <div className="glass-card-premium p-4">
            <div className="flex items-center gap-1 border-b border-white/[0.06] -mx-4 px-4 pb-3">
              {["followers", "following", "mutuals"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${
                    activeTab === tab
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                      : "text-gray-500 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  {tab}
                  {tab === "followers" && stats.followers > 0 && (
                    <span className="ml-1.5 text-[10px] opacity-70">({stats.followers})</span>
                  )}
                  {tab === "following" && stats.following > 0 && (
                    <span className="ml-1.5 text-[10px] opacity-70">({stats.following})</span>
                  )}
                  {tab === "mutuals" && stats.mutualConnections > 0 && (
                    <span className="ml-1.5 text-[10px] opacity-70">({stats.mutualConnections})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="mt-3">
              {listLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
                </div>
              ) : listData.length === 0 ? (
                <p className="py-8 text-center text-xs text-gray-500">No users yet</p>
              ) : (
                <div className="space-y-1">
                  {listData.map((u) => {
                    const isCurrentUser = u._id === currentUser?.id || u._id === currentUser?._id;
                    return (
                      <div
                        key={u._id || u.id}
                        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-white/[0.03] transition cursor-pointer"
                        onClick={() => navigate(`/profile/${u._id || u.id}`)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                            {u.avatar ? (
                              <img src={resolveAvatar(u.avatar)} alt="" className="h-full w-full object-cover" />
                            ) : (
                              getInitials(u.name)
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{u.name}</p>
                            <p className="text-[10px] text-gray-500 capitalize">{u.role || "student"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!isCurrentUser && (
                            <FollowButton
                              userId={u._id || u.id}
                              isFollowing={u.isFollowing || false}
                              isMutual={u.isFollowing && u.isFollower}
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
