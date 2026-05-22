import { motion } from "framer-motion";

const ITEMS = [
  { label: "You", color: "bg-cyan-400", ring: "ring-cyan-400/50", desc: "Your node" },
  { label: "NFT Holder", color: "bg-amber-400", ring: "ring-amber-400/50", desc: "Owns NFT certificate" },
  { label: "Admin", color: "bg-purple-500", ring: "ring-purple-500/50", desc: "Platform admin" },
  { label: "Teacher", color: "bg-blue-500", ring: "ring-blue-500/50", desc: "Faculty member" },
  { label: "Mutual", color: "bg-emerald-400", ring: "ring-emerald-400/50", desc: "Follows you back" },
  { label: "Following", color: "bg-indigo-400", ring: "ring-indigo-400/50", desc: "You follow them" },
  { label: "Follower", color: "bg-pink-400", ring: "ring-pink-400/50", desc: "Follows you" },
];

export default function GraphLegend({ isVisible, onToggle }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: isVisible ? 1 : 0, x: isVisible ? 0 : 20 }}
      className="absolute left-4 bottom-4 z-20"
    >
      <button
        onClick={onToggle}
        className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-black/60 px-3 py-2 text-xs text-gray-300 backdrop-blur-sm hover:border-cyan-500/30 hover:text-white transition-all"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Legend
      </button>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="mt-2 rounded-xl border border-white/[0.08] bg-gray-900/90 p-4 backdrop-blur-md min-w-[180px]"
        >
          <div className="space-y-2.5">
            {ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2.5">
                <div
                  className={`h-3 w-3 rounded-full ${item.color} ring-1 ${item.ring}`}
                />
                <div>
                  <p className="text-xs font-medium text-white">{item.label}</p>
                  <p className="text-[10px] text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.06]">
            <p className="text-[10px] text-gray-500">Click a node to expand its network</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
