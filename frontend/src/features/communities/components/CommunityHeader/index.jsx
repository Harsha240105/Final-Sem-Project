import { getInitials, resolveAvatar } from "../../utils";

function CommunityHeader({ community, isAdmin, isMember, onJoin, onLeave, onEdit }) {
  if (!community) return null;

  const isArchived = community.status === "archived";
  const image = community.image || community.logo;

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-gray-900/90 to-gray-950/90">
      {image && (
        <div className="absolute inset-0">
          <img src={resolveAvatar(image)} alt="" className="h-full w-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent" />
        </div>
      )}
      <div className="relative z-10 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {community.logo ? (
              <img src={resolveAvatar(community.logo)} alt="" className="h-14 w-14 rounded-xl object-cover border border-white/[0.08]" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 text-lg font-bold text-white">
                {getInitials(community.name)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{community.name}</h1>
                {isArchived && (
                  <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-400 border border-yellow-500/20">
                    Archived
                  </span>
                )}
                {community.status === "active" && community.completionType === "task_only" && (
                  <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-400 border border-green-500/20">
                    Tasks Done
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-400 mt-0.5">{community.description}</p>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                <span>{community.members?.length || 0} members</span>
                {community.category && <span>· {community.category}</span>}
                {community.communityType && <span>· {community.communityType}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isMember && !isArchived && (
              <button onClick={onLeave} className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 hover:border-red-400/30 transition">
                Leave
              </button>
            )}
            {!isMember && (
              <button onClick={onJoin} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-400 transition">
                Join
              </button>
            )}
            {isAdmin && !isArchived && (
              <button onClick={onEdit} className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-gray-400 hover:text-white transition">
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommunityHeader;
