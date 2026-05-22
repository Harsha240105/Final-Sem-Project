import { memo } from "react";
import { getInitials, resolveAvatar } from "../../utils";

function MemberManagement({ members = [], isAdmin, isArchived, onRemove, onAssignManager }) {
  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
        <p className="text-xs text-gray-500">No members yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">👥 Members ({members.length})</h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 max-h-80 overflow-y-auto scrollbar-thin">
        {members.map(member => (
          <div key={member._id} className="flex items-center gap-3 rounded-lg bg-white/[0.02] px-3 py-2 border border-white/[0.04]">
            <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center text-xs font-bold text-white">
              {member.avatar ? <img src={resolveAvatar(member.avatar)} alt="" className="h-full w-full rounded-full object-cover" /> : getInitials(member.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">{member.name || "Unknown"}</p>
              <p className="text-[10px] text-gray-500 capitalize">{member.role || "member"}</p>
            </div>
            {isAdmin && !isArchived && (
              <button
                onClick={() => onRemove?.(member._id)}
                className="text-[10px] text-gray-600 hover:text-red-400 transition shrink-0"
                title="Remove member"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(MemberManagement);
