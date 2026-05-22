import { motion } from "framer-motion";

const BADGE_STYLES = {
  verified: {
    bg: "bg-green-500/15",
    border: "border-green-500/40",
    text: "text-green-400",
    icon: "✓",
    label: "Verified",
  },
  pending: {
    bg: "bg-yellow-500/15",
    border: "border-yellow-500/40",
    text: "text-yellow-400",
    icon: "⏳",
    label: "Pending",
  },
  rejected: {
    bg: "bg-red-500/15",
    border: "border-red-500/40",
    text: "text-red-400",
    icon: "✕",
    label: "Rejected",
  },
  error: {
    bg: "bg-red-500/15",
    border: "border-red-500/40",
    text: "text-red-400",
    icon: "!",
    label: "Error",
  },
};

export default function VerifiedBadge({ status, role, size = "sm" }) {
  const style = BADGE_STYLES[status] || BADGE_STYLES.pending;

  const sizeClasses =
    size === "lg"
      ? "px-3 py-1 text-xs gap-1.5"
      : "px-2 py-0.5 text-[10px] gap-1";

  const iconSize = size === "lg" ? "text-sm" : "text-[10px]";
  const dotSize = size === "lg" ? "h-2 w-2" : "h-1.5 w-1.5";

  if (status === "verified") {
    return (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`inline-flex items-center rounded-full border ${style.border} ${style.bg} ${style.text} ${sizeClasses} font-semibold`}
      >
        <span className={`${dotSize} rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]`} />
        <span className={iconSize}>✓</span>
        Verified {role === "student" ? "Student" : "Teacher"}
      </motion.span>
    );
  }

  if (status === "pending") {
    return (
      <span
        className={`inline-flex items-center rounded-full border ${style.border} ${style.bg} ${style.text} ${sizeClasses} font-semibold`}
      >
        <span className={`${dotSize} rounded-full bg-yellow-400 animate-pulse`} />
        {style.label}
      </span>
    );
  }

  if (status === "rejected" || status === "error") {
    return (
      <span
        className={`inline-flex items-center rounded-full border ${style.border} ${style.bg} ${style.text} ${sizeClasses} font-semibold`}
        title="Verification failed — please re-submit your details"
      >
        {style.icon} {style.label}
      </span>
    );
  }

  return null;
}
