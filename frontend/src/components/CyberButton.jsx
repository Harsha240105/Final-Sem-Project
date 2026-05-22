import { motion } from "framer-motion";
import PropTypes from "prop-types";

const variants = {
  primary: "bg-gradient-to-r from-neon-cyan to-neon-purple text-white shadow-md shadow-cyan-500/15",
  secondary: "bg-white/[0.06] border border-white/[0.1] text-white hover:bg-white/[0.1]",
  ghost: "bg-transparent text-gray-400 hover:text-white hover:bg-white/[0.05]",
  danger: "bg-gradient-to-r from-neon-red to-red-600 text-white shadow-md shadow-red-500/15",
  glass: "backdrop-blur bg-white/[0.04] border border-white/[0.08] text-white hover:bg-white/[0.08]",
};

function CyberButton({
  children,
  variant = "primary",
  className = "",
  loading = false,
  disabled = false,
  glowOnHover = true,
  ...props
}) {
  return (
    <motion.button
      className={`cyber-btn relative inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all ${variants[variant] || variants.primary} ${disabled || loading ? "opacity-50 pointer-events-none" : ""} ${className}`}
      whileHover={disabled || loading ? {} : { scale: 1.02, y: -1 }}
      whileTap={disabled || loading ? {} : { scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="cyber-spinner inline-block h-4 w-4" />
      )}
      <span className={`relative z-10 flex items-center gap-2 ${loading ? "opacity-70" : ""}`}>
        {children}
      </span>
    </motion.button>
  );
}

CyberButton.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(["primary", "secondary", "ghost", "danger", "glass"]),
  className: PropTypes.string,
  loading: PropTypes.bool,
  disabled: PropTypes.bool,
  glowOnHover: PropTypes.bool,
};

export default CyberButton;
