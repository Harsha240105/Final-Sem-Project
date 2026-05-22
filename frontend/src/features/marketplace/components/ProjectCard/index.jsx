import { motion } from "framer-motion";
import { POST_TYPE_META, STATUS_META } from "../../utils";

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function timeAgo(date) {
  if (!date) return "";
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString();
}

function ProjectCard({ post, onOpen, compact }) {
  const typeMeta = POST_TYPE_META[post.postType] || { label: post.postType, icon: "📌", color: "bg-gray-500/20 text-gray-400 border-gray-500/20" };
  const statusMeta = STATUS_META[post.status] || { label: post.status, color: "bg-gray-500/20 text-gray-400 border-gray-500/20" };
  const openRoles = (post.requiredRoles || []).filter(r => !r.filled);
  const isRecruiting = post.status === "recruiting";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onOpen?.(post)}
      className={`group cursor-pointer rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.04] hover:border-white/[0.10] transition ${compact ? "" : ""}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-sm ${typeMeta.color.split(" ")[0]} ${typeMeta.color.split(" ")[1]}`}>
          {typeMeta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate group-hover:text-cyan-400 transition">{post.title}</h3>
            {isRecruiting && (
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400 animate-pulse">HIRING</span>
            )}
          </div>
          <p className="text-[10px] text-gray-600 mt-0.5 line-clamp-2">{post.description?.slice(0, 120)}</p>
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className={`rounded-lg px-2 py-0.5 text-[9px] font-semibold border ${typeMeta.color}`}>{typeMeta.icon} {typeMeta.label}</span>
        <span className={`rounded-lg px-2 py-0.5 text-[9px] font-semibold border ${statusMeta.color}`}>{statusMeta.label}</span>
        {openRoles.length > 0 && (
          <span className="rounded-lg bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-300 border border-amber-500/20">
            {openRoles.length} role{openRoles.length > 1 ? "s" : ""} open
          </span>
        )}
      </div>

      {/* Skills */}
      {post.skills?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {post.skills.slice(0, 4).map((s, i) => (
            <span key={i} className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[9px] text-gray-600">{s}</span>
          ))}
          {post.skills.length > 4 && <span className="text-[9px] text-gray-700">+{post.skills.length - 4}</span>}
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 flex items-center gap-3 text-[10px] text-gray-700">
        <div className="flex items-center gap-1">
          <div className="h-4 w-4 rounded-full bg-cyan-500/20 flex items-center justify-center text-[7px] font-bold text-white">
            {getInitials(post.createdBy?.name)}
          </div>
          <span className="truncate max-w-[80px]">{post.createdBy?.name || "Unknown"}</span>
        </div>
        <span className="ml-auto">{timeAgo(post.createdAt)}</span>
        {post.collaborators && (
          <span>{post.collaborators.filter(c => c.status === "accepted").length + (post.participants?.length || 0)} members</span>
        )}
      </div>
    </motion.div>
  );
}

export default ProjectCard;
