function CollaborationStatus({ post }) {
  const collabs = post.collaborators || [];
  const accepted = collabs.filter(c => c.status === "accepted");
  const pending = collabs.filter(c => c.status === "pending");

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Team</h4>
      <div className="space-y-1.5">
        {/* Creator */}
        <div className="flex items-center gap-2 text-xs">
          <div className="h-5 w-5 shrink-0 rounded-full bg-cyan-500/20 flex items-center justify-center text-[8px] font-bold text-white">
            {post.createdBy?.name?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="text-gray-300 font-medium truncate">{post.createdBy?.name}</span>
          <span className="text-[8px] text-cyan-400 ml-auto">Lead</span>
        </div>

        {accepted.map(c => (
          <div key={c._id} className="flex items-center gap-2 text-xs">
            <div className="h-5 w-5 shrink-0 rounded-full bg-emerald-500/20 flex items-center justify-center text-[8px] font-bold text-white">
              {c.user?.name?.[0]?.toUpperCase() || "?"}
            </div>
            <span className="text-gray-300 truncate">{c.user?.name}</span>
            {c.role && <span className="text-[9px] text-gray-600">{c.role}</span>}
          </div>
        ))}

        {pending.length > 0 && (
          <div className="pt-1 border-t border-white/[0.04]">
            <p className="text-[9px] text-amber-400">{pending.length} pending request{pending.length > 1 ? "s" : ""}</p>
          </div>
        )}

        {accepted.length === 0 && !post.createdBy && (
          <p className="text-[10px] text-gray-600">No team members yet</p>
        )}
      </div>
    </div>
  );
}

export default CollaborationStatus;
