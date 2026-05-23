import { useState, useCallback } from "react";
import { completeTaskAndIssueCertificates } from "../../../../shared/services/api";

function CertificateIssuance({ tasks, communityId, onRefresh }) {
  const [selected, setSelected] = useState({});
  const [issuing, setIssuing] = useState({});
  const [results, setResults] = useState(null);

  const completedTasks = tasks.filter(t => t.completed_status || t.completedBy?.length > 0);

  const toggleStudent = (taskId, studentId) => {
    setSelected(prev => {
      const key = `${taskId}-${studentId}`;
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  const toggleAll = (taskId, studentIds, checked) => {
    setSelected(prev => {
      const next = { ...prev };
      for (const sid of studentIds) {
        const key = `${taskId}-${sid}`;
        if (checked) next[key] = true;
        else delete next[key];
      }
      return next;
    });
  };

  const getSelectedForTask = (taskId) => {
    return Object.keys(selected)
      .filter(k => k.startsWith(`${taskId}-`))
      .map(k => k.split("-").slice(1).join("-"));
  };

  const handleIssue = useCallback(async (taskId) => {
    const studentIds = getSelectedForTask(taskId);
    if (studentIds.length === 0) return;
    setIssuing(prev => ({ ...prev, [taskId]: true }));
    setResults(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await completeTaskAndIssueCertificates(taskId, token, { studentIds });
      setResults(data);
      onRefresh?.();
    } catch {} finally {
      setIssuing(prev => ({ ...prev, [taskId]: false }));
    }
  }, [onRefresh]);

  const handleIssueAll = useCallback(async (taskId) => {
    const task = tasks.find(t => t._id === taskId);
    const allIds = (task.completedBy || []).map(c => c.userId?._id || c.userId).filter(Boolean);
    if (allIds.length === 0) return;
    setIssuing(prev => ({ ...prev, [taskId]: true }));
    setResults(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await completeTaskAndIssueCertificates(taskId, token, { studentIds: allIds });
      setResults(data);
      onRefresh?.();
    } catch {} finally {
      setIssuing(prev => ({ ...prev, [taskId]: false }));
    }
  }, [tasks, onRefresh]);

  if (completedTasks.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h3 className="text-sm font-semibold text-white mb-3">🎓 Certificate Issuance</h3>
      <p className="text-[10px] text-gray-500 mb-4">Select students who completed each task and issue NFT certificates to them.</p>

      {results && (
        <div className={`mb-4 rounded-lg p-3 text-xs border ${
          results.certificateStatus === "success"
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
            : results.certificateStatus === "partial"
            ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
            : "bg-red-500/10 border-red-500/20 text-red-300"
        }`}>
          {results.message}
          <button onClick={() => setResults(null)} className="ml-2 text-gray-500 hover:text-white">✕</button>
        </div>
      )}

      <div className="space-y-4">
        {completedTasks.map(task => {
          const completions = task.completedBy || [];
          const selectedForTask = getSelectedForTask(task._id);

          return (
            <div key={task._id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              {/* Task header */}
              <div className="flex items-center justify-between px-3 py-2.5 bg-white/[0.02] border-b border-white/[0.04]">
                <p className="text-xs font-semibold text-white truncate flex-1">{task.title}</p>
                <span className="text-[9px] text-gray-500">{completions.length} completed</span>
              </div>

              {/* Student list */}
              {completions.length > 0 ? (
                <div className="p-2">
                  <div className="flex items-center gap-2 px-2 py-1.5 border-b border-white/[0.03]">
                    <input
                      type="checkbox"
                      checked={completions.length > 0 && selectedForTask.length === completions.length}
                      onChange={(e) => toggleAll(task._id, completions.map(c => c.userId?._id || c.userId).filter(Boolean), e.target.checked)}
                      className="rounded border-white/[0.1] bg-black/30 text-cyan-500 focus:ring-cyan-500/30"
                    />
                    <span className="text-[9px] text-gray-500 font-medium">Select all</span>
                  </div>
                  {completions.map((c, i) => {
                    const studentId = c.userId?._id || c.userId;
                    const checked = selected[`${task._id}-${studentId}`] || false;
                    return (
                      <label key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] cursor-pointer transition">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleStudent(task._id, studentId)}
                          className="rounded border-white/[0.1] bg-black/30 text-cyan-500 focus:ring-cyan-500/30"
                        />
                        <div className="h-6 w-6 shrink-0 rounded-full bg-purple-500/15 flex items-center justify-center text-[9px] font-bold text-purple-400">
                          {(c.userId?.name || "?").charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[11px] text-gray-300 flex-1 truncate">{c.userId?.name || "Unknown"}</span>
                        <span className="text-[8px] text-gray-600 font-mono">{c.completedAt ? new Date(c.completedAt).toLocaleDateString() : ""}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-gray-600 text-center py-4">No students have completed this task yet</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 px-3 py-2 border-t border-white/[0.04] bg-white/[0.01]">
                <button
                  onClick={() => handleIssue(task._id)}
                  disabled={selectedForTask.length === 0 || issuing[task._id]}
                  className="rounded-lg bg-purple-500/20 px-3 py-1.5 text-[10px] font-semibold text-purple-400 hover:bg-purple-500/30 disabled:opacity-30 transition"
                >
                  {issuing[task._id] ? "Issuing..." : `Issue to Selected (${selectedForTask.length})`}
                </button>
                <button
                  onClick={() => handleIssueAll(task._id)}
                  disabled={completions.length === 0 || issuing[task._id]}
                  className="rounded-lg bg-white/[0.04] px-3 py-1.5 text-[10px] text-gray-400 hover:text-white hover:bg-white/[0.08] disabled:opacity-30 transition"
                >
                  Issue to All ({completions.length})
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CertificateIssuance;