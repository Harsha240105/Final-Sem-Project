function TaskCard({ task, isAdmin, isArchived, onMarkComplete, onUploadFile, submitting }) {
  const currentUserId = (() => {
    try {
      const t = localStorage.getItem("token");
      if (!t) return null;
      return JSON.parse(atob(t.split(".")[1])).id;
    } catch { return null; }
  })();
  const isAssigned = (task.completedBy || []).some(c => String(c.userId?._id || c.userId) === currentUserId);

  return (
    <div className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition ${
      task.completed_status
        ? "bg-emerald-500/5 border-emerald-500/10"
        : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]"
    }`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        task.completed_status ? "bg-emerald-500/20 text-emerald-400" : "bg-purple-500/20 text-purple-400"
      }`}>
        {task.completed_status ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${task.completed_status ? "text-emerald-300 line-through" : "text-white"}`}>
          {task.title}
        </p>
        {task.description && <p className="text-[11px] text-gray-500 truncate mt-0.5">{task.description}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
          task.completed_status
            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
            : "bg-amber-500/10 border border-amber-500/20 text-amber-300"
        }`}>
          {task.completed_status ? "Completed" : "Pending"}
        </span>
        {!task.completed_status && !isArchived && onMarkComplete && (
          <button
            onClick={() => onMarkComplete(task._id)}
            disabled={submitting}
            className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40 transition"
          >
            {submitting ? "..." : "Complete"}
          </button>
        )}
      </div>
    </div>
  );
}

export default TaskCard;
