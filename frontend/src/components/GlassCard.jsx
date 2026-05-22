import { motion } from "framer-motion";
import PropTypes from "prop-types";

const variants = {
  default: "glass-card",
  premium: "glass-card-premium",
  holographic: "glass-card-premium holographic",
  neon: "glass-card neon-border-cyan",
};

function GlassCard({
  children,
  variant = "default",
  className = "",
  whileHover = { y: -3 },
  whileTap = { scale: 0.99 },
  ...props
}) {
  return (
    <motion.div
      className={`${variants[variant] || variants.default} ${className}`}
      whileHover={whileHover}
      whileTap={whileTap}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

GlassCard.propTypes = {
  children: PropTypes.node,
  variant: PropTypes.oneOf(["default", "premium", "holographic", "neon"]),
  className: PropTypes.string,
  whileHover: PropTypes.object,
  whileTap: PropTypes.object,
};

export default GlassCard;
