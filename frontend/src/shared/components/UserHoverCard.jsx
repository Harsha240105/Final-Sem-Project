import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getUserProfileWithFollowStatus } from "../services/api";
import FollowButton from "./FollowButton";
import VerifiedBadge from "./VerifiedBadge";

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

export default function UserHoverCard({ userId, children, onProfileClick }) {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const triggerRef = useRef(null);
  const hoverRef = useRef(null);
  const enterTimeout = useRef(null);
  const leaveTimeout = useRef(null);

  useEffect(() => {
    if (!userId) return;
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoading(true);
    getUserProfileWithFollowStatus(userId, token)
      .then((data) => {
        setProfileData(data);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [userId]);

  const handleMouseEnter = () => {
    clearTimeout(leaveTimeout.current);
    enterTimeout.current = setTimeout(() => setShow(true), 400);
  };

  const handleMouseLeave = () => {
    clearTimeout(enterTimeout.current);
    leaveTimeout.current = setTimeout(() => setShow(false), 200);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (onProfileClick) {
      onProfileClick(userId);
    } else {
      navigate(`/profile/${userId}`);
    }
  };

  const user = profileData?.user || {};
  const stats = profileData?.stats || {};
  const initials = getInitials(user.name);
  const avatarUrl = resolveAvatar(user.avatar);

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      <AnimatePresence>
        {show && !loading && !error && profileData && (
          <motion.div
            ref={hoverRef}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onMouseEnter={() => { clearTimeout(leaveTimeout.current); }}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
            className="absolute z-[9999] bottom-full left-1/2 -translate-x-1/2 mb-3 w-72"
          >
            <div className="relative rounded-2xl border border-white/[0.08] bg-[#0e1122]/95 shadow-2xl shadow-black/40 overflow-hidden">
              <div className="h-16 bg-gradient-to-r from-cyan-600/30 via-purple-600/20 to-indigo-600/30" />

              <div className="px-4 -mt-10 relative z-10">
                <div className="h-16 w-16 rounded-2xl overflow-hidden ring-4 ring-[#0e1122] bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-lg font-bold text-white shadow-xl cursor-pointer"
                  onClick={handleClick}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
              </div>

              <div className="px-4 pb-4 mt-2">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <button onClick={handleClick} className="text-left">
                      <p className="text-base font-bold text-white truncate hover:text-cyan-400 transition-colors">
                        {user.name || "Unknown"}
                      </p>
                    </button>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-gray-500 capitalize">{user.role || "student"}</span>
                      {(user.verified || user.verificationStatus === "verified") && (
                        <VerifiedBadge status="verified" role={user.role} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-3 py-2 border-t border-white/[0.06]">
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">{stats.followers ?? 0}</p>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Followers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">{stats.following ?? 0}</p>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Following</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-cyan-400">{profileData?.nftCount ?? 0}</p>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">NFTs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-purple-400">{profileData?.communities?.length ?? 0}</p>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">Groups</p>
                  </div>
                </div>

                <div className="mt-2">
                  {currentUser?.id !== userId && currentUser?._id !== userId && (
                    <FollowButton
                      userId={userId}
                      size="sm"
                    />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
