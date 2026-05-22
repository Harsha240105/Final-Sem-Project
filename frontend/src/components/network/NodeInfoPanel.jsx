import { motion } from "framer-motion";

const LEGEND_ITEMS = [
  { label: "You", color: "bg-cyan-400", ring: "ring-cyan-400/50", desc: "Your central node" },
  { label: "Mutual", color: "bg-emerald-400", ring: "ring-emerald-400/50", desc: "Follows you back" },
  { label: "Following", color: "bg-indigo-400", ring: "ring-indigo-400/50", desc: "You follow them" },
  { label: "Follower", color: "bg-pink-400", ring: "ring-pink-400/50", desc: "Follows you" },
  { label: "NFT Holder", color: "bg-amber-400", ring: "ring-amber-400/50", desc: "Owns NFT certificate" },
  { label: "Admin", color: "bg-purple-500", ring: "ring-purple-500/50", desc: "Platform admin" },
  { label: "Teacher", color: "bg-blue-500", ring: "ring-blue-500/50", desc: "Faculty member" },
];

function getInitials(name) {
  if (!name) return "?";
  return name.split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
}

function getRoleLabel(role) {
  switch (role) {
    case "teacher": return "Teacher";
    case "community_manager": return "Community Manager";
    case "admin": return "Admin";
    default: return "Student";
  }
}

export default function NodeInfoPanel({ selectedNode, stats, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="pointer-events-none absolute right-4 top-20 z-30 flex w-64 flex-col gap-3"
    >
      {selectedNode ? (
        <motion.div
          key={selectedNode.id}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="pointer-events-auto rounded-2xl border border-white/[0.1] bg-gray-900/80 p-5 backdrop-blur-md shadow-2xl"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Node Info</h3>
            <button onClick={onClose} className="rounded-full p-1 text-gray-500 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 text-base font-bold text-white ring-2 ring-white/20">
              {getInitials(selectedNode.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">{selectedNode.name}</p>
              <p className="text-[10px] text-gray-400">{selectedNode.collegeName || selectedNode.institutionName || "No college"}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className="rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
              {selectedNode.relation === "self" ? "You" : selectedNode.relation === "mutual" ? "Mutual" : selectedNode.relation === "following" ? "Following" : "Follower"}
            </span>
            <span className="rounded-md border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300">
              {getRoleLabel(selectedNode.role)}
            </span>
            {(selectedNode.nftCount || 0) > 0 && (
              <span className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                NFT
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-2 text-center">
              <p className="text-sm font-bold text-cyan-400">{selectedNode.stats?.followers || selectedNode.followers || 0}</p>
              <p className="text-[9px] text-gray-500">Followers</p>
            </div>
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-2 text-center">
              <p className="text-sm font-bold text-purple-400">{selectedNode.stats?.following || selectedNode.following || 0}</p>
              <p className="text-[9px] text-gray-500">Following</p>
            </div>
            <div className="rounded-lg bg-white/[0.04] border border-white/[0.06] p-2 text-center">
              <p className="text-sm font-bold text-green-400">{selectedNode.nftCount || 0}</p>
              <p className="text-[9px] text-gray-500">NFTs</p>
            </div>
          </div>

          {selectedNode.walletAddress && (
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2.5 mb-2">
              <p className="text-[9px] text-gray-500 mb-0.5">Wallet</p>
              <p className="text-[10px] font-mono text-indigo-400/80 truncate">
                {selectedNode.walletAddress.slice(0, 6)}...{selectedNode.walletAddress.slice(-4)}
              </p>
            </div>
          )}
        </motion.div>
      ) : (
        <div className="pointer-events-auto rounded-2xl border border-white/[0.08] bg-gray-900/70 p-4 backdrop-blur-md">
          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-3">Network Stats</h3>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="text-center">
              <p className="text-lg font-bold text-cyan-400">{stats.followers || 0}</p>
              <p className="text-[9px] text-gray-500">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-purple-400">{stats.following || 0}</p>
              <p className="text-[9px] text-gray-500">Following</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-green-400">{stats.mutual || 0}</p>
              <p className="text-[9px] text-gray-500">Mutual</p>
            </div>
          </div>

          <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-2">Legend</h3>
          <div className="space-y-1.5">
            {LEGEND_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${item.color} ring-1 ${item.ring}`} />
                <div>
                  <p className="text-[11px] font-medium text-white/80">{item.label}</p>
                  <p className="text-[9px] text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
