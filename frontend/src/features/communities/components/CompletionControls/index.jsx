import { useState } from "react";
import { useToast } from "../../../../shared/hooks/useToast";
import { completeCommunityTask, archiveCommunity } from "../../../../shared/services/api";

function CompletionControls({ community, onRefresh }) {
  const { addToast } = useToast();
  const [completing, setCompleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(null);

  const handleCompleteTask = async () => {
    setCompleting(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await completeCommunityTask(community._id, token);
      addToast("Tasks marked complete", "success");
      setShowConfirm(null);
      onRefresh?.();
    } catch {
      addToast("Failed to complete", "error");
    } finally {
      setCompleting(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await archiveCommunity(community._id, token);
      addToast("Community archived permanently", "success");
      setShowConfirm(null);
      onRefresh?.();
    } catch {
      addToast("Failed to archive", "error");
    } finally {
      setArchiving(false);
    }
  };

  if (community.status === "archived") return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h3 className="text-sm font-semibold text-white mb-3">🏁 Completion</h3>
      <div className="space-y-2">
        <p className="text-[10px] text-gray-500">
          Complete this community's workflow. You have two options:
        </p>

        {/* Option 1: Complete tasks only */}
        {showConfirm === "task" ? (
          <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/20 p-3 space-y-2">
            <p className="text-xs text-cyan-400">Mark all tasks as complete? Submissions and collaborations remain active.</p>
            <div className="flex gap-2">
              <button onClick={handleCompleteTask} disabled={completing} className="rounded-lg bg-cyan-500 px-3 py-1 text-[10px] font-semibold text-white disabled:opacity-40">
                {completing ? "Completing..." : "Confirm"}
              </button>
              <button onClick={() => setShowConfirm(null)} className="rounded-lg border border-white/[0.08] px-3 py-1 text-[10px] text-gray-400">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm("task")}
            className="w-full rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-left hover:bg-cyan-500/10 transition"
          >
            <p className="text-xs font-medium text-cyan-400">Complete Tasks Only</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Mark tasks done. Students can continue other work.</p>
          </button>
        )}

        {/* Option 2: Full archive */}
        {showConfirm === "archive" ? (
          <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/20 p-3 space-y-2">
            <p className="text-xs text-yellow-400">⚠️ Archive entire community? This is permanent. All submissions frozen, messaging read-only.</p>
            <div className="flex gap-2">
              <button onClick={handleArchive} disabled={archiving} className="rounded-lg bg-yellow-500 px-3 py-1 text-[10px] font-semibold text-black disabled:opacity-40">
                {archiving ? "Archiving..." : "Confirm Archive"}
              </button>
              <button onClick={() => setShowConfirm(null)} className="rounded-lg border border-white/[0.08] px-3 py-1 text-[10px] text-gray-400">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm("archive")}
            className="w-full rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-left hover:bg-yellow-500/10 transition"
          >
            <p className="text-xs font-medium text-yellow-400">Archive Community</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Lock everything. Permanently preserve all work.</p>
          </button>
        )}
      </div>
    </div>
  );
}

export default CompletionControls;
