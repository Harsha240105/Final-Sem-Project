import { Link } from "react-router-dom";
import { motion } from "framer-motion";

function GlitchText({ text }) {
  return (
    <span className="relative inline-block">
      <span
        className="absolute inset-0 text-cyan-400/80 select-none"
        style={{ clipPath: "inset(20% 0 60% 0)", transform: "translate(-3px, -3px)" }}
      >
        {text}
      </span>
      <span
        className="absolute inset-0 text-pink-500/80 select-none"
        style={{ clipPath: "inset(60% 0 10% 0)", transform: "translate(3px, 3px)" }}
      >
        {text}
      </span>
      <span className="relative text-white">{text}</span>
    </span>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 relative overflow-hidden">
      <div className="cyber-bg absolute inset-0" />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10"
      >
        <div className="max-w-md text-center">
          <div className="neon-border-cyan rounded-2xl overflow-hidden">
            <div className="bg-gray-900/80 backdrop-blur-xl p-8 border border-white/[0.06]">
              <motion.div
                animate={{ scale: [1, 1.05, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-7xl font-black font-display mb-4"
              >
                <GlitchText text="404" />
              </motion.div>
              <p className="mt-4 text-sm text-gray-400 font-mono">
                [PAGE_NOT_FOUND] — The requested resource could not be located on this server.
              </p>
              <p className="mt-2 text-xs text-gray-600">
                The link may be broken, or the page may have been moved to a different sector.
              </p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-8"
              >
                <Link
                  to="/"
                  className="cyber-btn relative inline-flex rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition"
                >
                  RETURN TO BASE
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default NotFound;
