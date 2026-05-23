import { useRef } from "react";

function TaskCard({ task, isAdmin, isArchived, onMarkComplete, onUploadFile, submitting, onClick }) {
  const fileRef = useRef(null);
  const currentUserId = (() => {
    try { const t = localStorage.getItem("token"); if (!t) return null; return JSON.parse(atob(t.split(".")[1])).id; } catch { return null; }
  })();

  return (
    <div
      onClick={onClick}
      className="group relative flex items-center gap-4 rounded-xl border transition-all cursor-pointer overflow-hidden
        bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.10]
        active:scale-[0.99]"
    >
      {/* Left color accent */}
      <div className={`h-full w-1 shrink-0 ${task.completed_status ? "bg-emerald-500" : "bg-purple-500/60"}`} />

      {/* Icon */}
      <div className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-lg ${
        task.completed_status ? "bg-emerald-500/15 text-emerald-400" : "bg-purple-500/15 text-purple-400"
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

      {/* Info */}
      <div className="flex-1 min-w-0 py-3">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-semibold truncate transition ${task.completed_status ? "text-emerald-300/70 line-through" : "text-white group-hover:text-gray-100"}`}>
            {task.title}
          </p>
          {!task.completed_status && <span className="shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-300">Pending</span>}
        </div>
        {task.description && <p className="text-[11px] text-gray-500 truncate mt-0.5">{task.description}</p>}
        <div className="flex items-center gap-3 mt-1">
          {task.attachments?.length > 0 && <span className="text-[9px] text-gray-600">📎 {task.attachments.length} file(s)</span>}
          <span className="text-[9px] text-gray-600/50 opacity-0 group-hover:opacity-100 transition">Click to view details →</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 pr-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        {task.completed_status && (
          <span className="rounded-full px-2 py-0.5 text-[8px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">Completed</span>
        )}
        {!task.completed_status && !isArchived && (
          <>
            {onUploadFile && (
              <>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onUploadFile(task._id, e.target.files[0]); e.target.value = ""; }} />
                <button onClick={() => fileRef.current?.click()} className="rounded-lg bg-white/[0.04] px-2 py-1.5 text-[11px] text-gray-400 hover:text-white hover:bg-white/[0.08] transition" title="Upload file">📎</button>
              </>
            )}
            {onMarkComplete && (
              <button onClick={() => onMarkComplete(task._id)} disabled={submitting} className="rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-40 transition active:scale-95">
                {submitting ? "..." : "✓ Complete"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default TaskCard;