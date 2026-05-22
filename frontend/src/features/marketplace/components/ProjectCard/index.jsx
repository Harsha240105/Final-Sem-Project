import { POST_TYPE_META, STATUS_META } from "../../utils";

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function timeAgo(date) {
  if (!date) return "";
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function ProjectCard({ post, onOpen, isSelected }) {
  const typeMeta = POST_TYPE_META[post.postType] || { label: post.postType, icon: "📌", color: "bg-slate-500/20 text-slate-400 border-slate-500/20" };
  const statusMeta = STATUS_META[post.status] || { label: post.status, color: "bg-slate-500/20 text-slate-400 border-slate-500/20" };
  const openRoles = (post.requiredRoles || []).filter(r => !r.filled);
  const memberCount = post.collaborators?.filter(c => c.status === "accepted").length + (post.participants?.length || 0) + 1;

  return (
    <div
      onClick={() => onOpen?.(post)}
      className={`group cursor-pointer rounded-lg border p-3 transition ${
        isSelected ? "border-cyan-500/30 bg-cyan-500/[0.03]" : "border-slate-700/30 bg-slate-800/20 hover:border-slate-600/50"
      }`}
    >
      <div className="flex items-start gap-2 mb-2">
        <div className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-sm bg-slate-800/50">
          {typeMeta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-slate-200 truncate">{post.title}</h3>
            {post.status === "recruiting" && (
              <span className="shrink-0 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-400">HIRING</span>
            )}
          </div>
          <p className="text-[11px] text-slate-600 line-clamp-2">{post.description?.slice(0, 120)}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium border ${typeMeta.color}`}>
          {typeMeta.icon} {typeMeta.label}
        </span>
        <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium border ${statusMeta.color}`}>
          {statusMeta.label}
        </span>
        {openRoles.length > 0 && (
          <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-300 border border-amber-500/20">
            {openRoles.length} open
          </span>
        )}
      </div>

      {post.skills?.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {post.skills.slice(0, 4).map((s, i) => (
            <span key={i} className="rounded bg-slate-700/30 px-1.5 py-0.5 text-[9px] text-slate-500">{s}</span>
          ))}
          {post.skills.length > 4 && <span className="text-[9px] text-slate-600">+{post.skills.length - 4}</span>}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-600">
        <div className="flex items-center gap-1">
          <div className="h-3.5 w-3.5 rounded-full bg-cyan-500/20 flex items-center justify-center text-[6px] font-bold text-white">
            {getInitials(post.createdBy?.name)}
          </div>
          <span className="truncate max-w-[70px]">{post.createdBy?.name || "Unknown"}</span>
        </div>
        <span>{timeAgo(post.createdAt)}</span>
        <span className="ml-auto">{memberCount} members</span>
      </div>
    </div>
  );
}
