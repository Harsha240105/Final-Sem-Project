export default function RecruitmentPanel({ post, currentUserId, onRequest, onAccept, onReject, requesting }) {
  const isOwner = post.createdBy?._id === currentUserId || post.createdBy === currentUserId;
  const myRequest = (post.collaborators || []).find(c => c.user?._id === currentUserId || c.user === currentUserId);
  const openRoles = (post.requiredRoles || []).filter(r => !r.filled);
  const pendingRequests = (post.collaborators || []).filter(c => c.status === "pending");

  if (post.status === "completed" || post.status === "archived") return null;

  return (
    <div className="space-y-2">
      {openRoles.length > 0 && (
        <div className="rounded-lg border border-slate-700/30 bg-slate-900/20 p-3">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Open Positions</h4>
          <div className="space-y-1.5">
            {openRoles.map((role, i) => (
              <div key={role._id || i} className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">{role.role}</span>
                  <span className="text-slate-600">x{role.count}</span>
                </div>
                {role.skills?.length > 0 && (
                  <div className="flex gap-1 mt-0.5">
                    {role.skills.map((s, si) => (
                      <span key={si} className="rounded bg-slate-700/30 px-1 py-0.5 text-[8px] text-slate-500">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isOwner && pendingRequests.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.02] p-3">
          <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
            Pending ({pendingRequests.length})
          </h4>
          <div className="space-y-1.5">
            {pendingRequests.map(c => (
              <div key={c._id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-4 w-4 rounded-full bg-amber-500/20 flex items-center justify-center text-[7px] font-bold text-white">
                    {c.user?.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <span className="text-slate-300">{c.user?.name}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => onAccept(c._id)} disabled={requesting} className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40 transition">Accept</button>
                  <button onClick={() => onReject(c._id)} disabled={requesting} className="rounded bg-red-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-40 transition">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isOwner && !myRequest && post.status === "recruiting" && (
        <button onClick={onRequest} disabled={requesting} className="w-full rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-400 transition disabled:opacity-40">
          {requesting ? "Requesting..." : "Request to Join"}
        </button>
      )}

      {!isOwner && myRequest && (
        <div className={`rounded-lg border p-2 text-xs text-center ${
          myRequest.status === "accepted" ? "border-emerald-500/20 bg-emerald-500/[0.02] text-emerald-400" :
          myRequest.status === "rejected" ? "border-red-500/20 bg-red-500/[0.02] text-red-400" :
          "border-amber-500/20 bg-amber-500/[0.02] text-amber-400"
        }`}>
          {myRequest.status === "accepted" ? "You're on the team!" :
           myRequest.status === "rejected" ? "Request declined" : "Request pending..."}
        </div>
      )}
    </div>
  );
}
