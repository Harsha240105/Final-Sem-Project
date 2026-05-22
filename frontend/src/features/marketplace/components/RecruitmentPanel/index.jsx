function RecruitmentPanel({ post, currentUserId, onRequest, onAccept, onReject, requesting }) {
  const isOwner = post.createdBy?._id === currentUserId || post.createdBy === currentUserId;
  const myRequest = (post.collaborators || []).find(c => c.user?._id === currentUserId || c.user === currentUserId);
  const openRoles = (post.requiredRoles || []).filter(r => !r.filled);
  const pendingRequests = (post.collaborators || []).filter(c => c.status === "pending");

  if (post.status === "completed" || post.status === "archived") return null;

  return (
    <div className="space-y-3">
      {/* Role requirements */}
      {openRoles.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Open Positions</h4>
          <div className="space-y-1.5">
            {openRoles.map((role, i) => (
              <div key={role._id || i} className="flex items-center justify-between text-xs">
                <div>
                  <span className="text-white font-medium">{role.role}</span>
                  <span className="text-gray-600 ml-2">×{role.count}</span>
                  {role.skills?.length > 0 && (
                    <div className="flex gap-1 mt-0.5">
                      {role.skills.map((s, si) => (
                        <span key={si} className="rounded-md bg-white/[0.04] px-1 py-0.5 text-[8px] text-gray-600">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Owner: manage requests */}
      {isOwner && pendingRequests.length > 0 && (
        <div className="rounded-xl border border-amber-500/10 bg-amber-500/[0.02] p-3">
          <h4 className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider mb-2">
            Pending Requests ({pendingRequests.length})
          </h4>
          <div className="space-y-2">
            {pendingRequests.map(c => (
              <div key={c._id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[8px] font-bold text-white">
                    {c.user?.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <span className="text-gray-300">{c.user?.name}</span>
                  {c.role && <span className="text-[9px] text-gray-600">— {c.role}</span>}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => onAccept(c._id)} disabled={requesting} className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[9px] font-semibold text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40">Accept</button>
                  <button onClick={() => onReject(c._id)} disabled={requesting} className="rounded-md bg-red-500/20 px-2 py-0.5 text-[9px] font-semibold text-red-400 hover:bg-red-500/30 disabled:opacity-40">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Non-owner: request to join */}
      {!isOwner && !myRequest && post.status === "recruiting" && (
        <button onClick={onRequest} disabled={requesting} className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white hover:shadow-lg hover:shadow-cyan-500/20 transition disabled:opacity-40">
          {requesting ? "Requesting..." : "Request to Join"}
        </button>
      )}

      {/* My request status */}
      {!isOwner && myRequest && (
        <div className={`rounded-xl border p-3 text-xs text-center ${
          myRequest.status === "accepted" ? "border-emerald-500/20 bg-emerald-500/[0.02] text-emerald-400" :
          myRequest.status === "rejected" ? "border-red-500/20 bg-red-500/[0.02] text-red-400" :
          "border-amber-500/20 bg-amber-500/[0.02] text-amber-400"
        }`}>
          {myRequest.status === "accepted" ? "✅ You're on the team!" :
           myRequest.status === "rejected" ? "❌ Request declined" :
           "⏳ Request pending..."}
          {myRequest.role && <span className="block text-[9px] text-gray-600 mt-0.5">Role: {myRequest.role}</span>}
        </div>
      )}
    </div>
  );
}

export default RecruitmentPanel;
