import { formatTime } from "../../utils";

function ArchiveView({ community }) {
  if (community.status !== "archived") return null;

  return (
    <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-lg">📦</span>
        <div>
          <h3 className="text-sm font-semibold text-yellow-400">Community Archived</h3>
          <p className="text-[10px] text-gray-500">
            Archived {community.archivedAt ? formatTime(community.archivedAt) : "N/A"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2">
          <p className="text-lg font-bold text-white">{community.members?.length || 0}</p>
          <p className="text-[10px] text-gray-500">Members</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2">
          <p className="text-lg font-bold text-white">{community.collaborations?.length || 0}</p>
          <p className="text-[10px] text-gray-500">Collaborations</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2">
          <p className="text-lg font-bold text-white">{community.resources?.length || 0}</p>
          <p className="text-[10px] text-gray-500">Resources</p>
        </div>
        <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-2">
          <p className="text-lg font-bold text-white">{community.communityMessages?.length || 0}</p>
          <p className="text-[10px] text-gray-500">Messages</p>
        </div>
      </div>
      {community.completionType && (
        <div className="mt-3 text-center">
          <span className="rounded-full bg-white/[0.04] px-3 py-1 text-[10px] text-gray-400">
            Completed: {community.completionType === "full" ? "Full Archive" : "Tasks Only"}
          </span>
        </div>
      )}
      <div className="mt-3 rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
        <p className="text-[10px] text-gray-500 text-center">
          This community is in archive state. All content is preserved for verification and historical reference.
        </p>
      </div>
    </div>
  );
}

export default ArchiveView;
