import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, UserCheck, Loader2, Check } from "lucide-react";
import { useFollow } from "./FollowContext";
import { useToast } from "../hooks/useToast";
import { useAuth } from "../hooks/useAuth";

function getCurrentUserId() {
  try {
    const t = localStorage.getItem("token");
    if (!t) return null;
    return JSON.parse(atob(t.split(".")[1])).id;
  } catch {
    return null;
  }
}

const SIZE_CLASSES = {
  sm: "px-2.5 py-1 text-xs gap-1",
  md: "px-3.5 py-2 text-sm gap-1.5",
  lg: "px-5 py-2.5 text-base gap-2",
};

const COMPACT_SIZE_CLASSES = {
  sm: "p-1.5",
  md: "p-2",
  lg: "p-2.5",
};

const ICON_SIZES = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export default function FollowButton({
  userId,
  isMutual: propIsMutual,
  size = "md",
  followBack = false,
  showLabel = true,
  onFollow,
  onUnfollow,
  className = "",
  compact = false,
}) {
  const { user: currentUser } = useAuth();
  const { isFollowing: checkFollowing, isMutual: checkMutual, follow, unfollow } = useFollow();
  const following = checkFollowing(userId);
  const isStateMutual = propIsMutual ?? checkMutual(userId);
  const { addToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [ripples, setRipples] = useState([]);

  const selfId = currentUser?.id || getCurrentUserId();
  const isSelf = !userId || (selfId && String(userId) === String(selfId));

  const showUnfollowHover = following && isHovered && !loading && !showSuccess;
  const state = !following ? "follow" : isStateMutual ? "mutual" : "following";

  const handleClick = useCallback(
    async (e) => {
      e.stopPropagation();
      if (loading || !userId) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const id = Date.now();
      setRipples((prev) => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top, id }]);
      setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 700);

      setLoading(true);
      try {
        if (following) {
          await unfollow(userId);
          setShowSuccess(true);
          setTimeout(() => { setShowSuccess(false); setLoading(false); }, 800);
          addToast("Connection removed", "success");
          onUnfollow?.();
        } else {
          await follow(userId);
          setShowSuccess(true);
          setTimeout(() => { setShowSuccess(false); setLoading(false); }, 800);
          addToast("Connection added", "success");
          onFollow?.();
        }
      } catch (err) {
        addToast(err?.response?.data?.error || "Action failed", "error");
        setLoading(false);
      }
    },
    [userId, following, loading, addToast, onFollow, onUnfollow, follow, unfollow]
  );

  const btnSize = compact
    ? COMPACT_SIZE_CLASSES[size] || COMPACT_SIZE_CLASSES.md
    : SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const iconSize = ICON_SIZES[size] || ICON_SIZES.md;

  const getStyles = () => {
    if (showUnfollowHover) {
      return {
        bg: "bg-red-500/10",
        border: "border-red-500/40",
        text: "text-red-300",
        glow: "shadow-[0_0_6px_rgba(255,77,109,0.1)] hover:shadow-[0_0_10px_rgba(255,77,109,0.15)]",
      };
    }
    switch (state) {
      case "follow":
        return {
          bg: "bg-gradient-to-r from-cyan-500 to-purple-500",
          border: "border-white/[0.08]",
          text: "text-white",
          glow: "shadow-[0_0_6px_rgba(0,245,255,0.1)] hover:shadow-[0_0_12px_rgba(0,245,255,0.15)]",
        };
      case "following":
        return {
          bg: "bg-gradient-to-r from-emerald-500 to-teal-500",
          border: "border-white/[0.08]",
          text: "text-white",
          glow: "shadow-[0_0_6px_rgba(0,255,163,0.1)] hover:shadow-[0_0_12px_rgba(0,255,163,0.15)]",
        };
      case "mutual":
        return {
          bg: "bg-gradient-to-r from-purple-500 to-violet-500",
          border: "border-white/[0.08]",
          text: "text-white",
          glow: "shadow-[0_0_6px_rgba(123,97,255,0.1)] hover:shadow-[0_0_12px_rgba(123,97,255,0.15)]",
        };
    }
  };

  const styles = getStyles();

  const renderLabel = () => {
    if (compact || !showLabel) return null;
    if (loading) return state === "follow" ? "Adding..." : "Removing...";
    if (showSuccess) return "Done!";
    if (showUnfollowHover) return "Unfollow";
    if (!following) return followBack ? "Follow Back" : "Follow";
    if (isStateMutual) {
      return (
        <span className="inline-flex items-center gap-1">
          <span>Mutual</span>
          <span className="opacity-50 text-[0.65em]">·</span>
          <span className="opacity-70">Following</span>
        </span>
      );
    }
    return "Following";
  };

  const displayKey = loading ? "loading" : showSuccess ? "success" : showUnfollowHover ? "unfollow" : state;

  if (isSelf) return null;

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={loading || !userId}
      initial={{ opacity: 0, scale: 0.95, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      whileHover={{ scale: loading ? 1 : 1.02 }}
      whileTap={{ scale: loading ? 1 : 0.97 }}
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-lg border backdrop-blur transition-all duration-300 ease-out font-semibold select-none disabled:opacity-50 disabled:cursor-not-allowed ${styles.bg} ${styles.border} ${styles.text} ${styles.glow} ${btnSize} ${className}`}
    >
      <span className="absolute inset-0 bg-white/[0.03] pointer-events-none rounded-lg" />

      <AnimatePresence>
        {ripples.map((ripple) => (
          <motion.span
            key={ripple.id}
            initial={{ scale: 0, opacity: 0.5 }}
            animate={{ scale: 3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute rounded-full bg-white/30 pointer-events-none"
            style={{ left: ripple.x - 10, top: ripple.y - 10, width: 20, height: 20 }}
          />
        ))}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.span
          key={displayKey}
          initial={{ opacity: 0, y: 6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="relative inline-flex items-center gap-1.5 z-10"
        >
          {loading ? (
            <Loader2 className={`${iconSize} animate-spin`} />
          ) : showSuccess ? (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 15 }}>
              <Check className={iconSize} />
            </motion.span>
          ) : showUnfollowHover ? (
            <UserCheck className={iconSize} />
          ) : following ? (
            <UserCheck className={iconSize} />
          ) : (
            <UserPlus className={iconSize} />
          )}

          {renderLabel()}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
