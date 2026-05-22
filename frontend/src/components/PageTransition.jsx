import { motion } from "framer-motion";

const easeOutExpo = [0.16, 1, 0.3, 1];

function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.35, ease: easeOutExpo }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

export default PageTransition;
