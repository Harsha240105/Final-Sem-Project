import { useState, memo } from "react";
import { markTaskCompletedByStudent, uploadTaskFile } from "../../../../shared/services/api";
import TaskCard from "../TaskCard";

const TASK_FILTERS = ["all", "active", "submitted", "completed"];

function TaskBoard({ tasks = [], communityId, isAdmin, isArchived, onRefresh }) {
  const [filter, setFilter] = useState("all");
  const [submitting, setSubmitting] = useState({});

  const filtered = tasks.filter(t => {
    if (filter === "all") return true;
    if (filter === "active") return !t.completed_status;
    if (filter === "submitted") return t.completedBy?.length > 0 && !t.completed_status;
    if (filter === "completed") return t.completed_status === true;
    return true;
  });

  const handleMarkComplete = async (taskId) => {
    try {
      setSubmitting(prev => ({ ...prev, [taskId]: true }));
      const token = localStorage.getItem("token");
      if (!token) return;
      await markTaskCompletedByStudent(taskId, token);
      onRefresh?.();
    } catch { /* silent */ } finally {
      setSubmitting(prev => ({ ...prev, [taskId]: false }));
    }
  };

  const handleUploadFile = async (taskId, file) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await uploadTaskFile(taskId, file, token);
      onRefresh?.();
    } catch { /* silent */ }
  };

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center">
        <p className="text-sm text-gray-500">No tasks yet</p>
        <p className="text-xs text-gray-600 mt-1">Tasks will appear here once created</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {TASK_FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-[10px] font-medium transition capitalize ${
              filter === f ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-gray-500 hover:text-white border border-transparent"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map(task => (
          <TaskCard
            key={task._id}
            task={task}
            isAdmin={isAdmin}
            isArchived={isArchived}
            onMarkComplete={handleMarkComplete}
            onUploadFile={handleUploadFile}
            submitting={submitting[task._id]}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(TaskBoard);
