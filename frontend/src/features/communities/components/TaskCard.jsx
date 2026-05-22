import PropTypes from "prop-types";
import { motion } from "framer-motion";

function TaskCard({ task, isAssignedToMe, onComplete, completing }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 transition ${
        task.completed_status
          ? "bg-emerald-500/5 border border-emerald-500/10"
          : "bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05]"
      }`}
    >
      {/* Status Icon */}
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          task.completed_status
            ? "bg-emerald-500/20 text-emerald-400"
            : "bg-purple-500/20 text-purple-400"
        }`}
      >
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

      {/* Task Info */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${
            task.completed_status ? "text-emerald-300 line-through" : "text-white"
          }`}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="text-[11px] text-gray-600 truncate mt-0.5">{task.description}</p>
        )}
        {task.assignedTo?.name && (
          <p className="text-[10px] text-gray-600 mt-0.5">
            Assigned to: {task.assignedTo.name}
          </p>
        )}
      </div>

      {/* Status Badge + Action */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
            task.completed_status
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
              : "bg-amber-500/10 border border-amber-500/20 text-amber-300"
          }`}
        >
          {task.completed_status ? "Completed" : "Pending"}
        </span>
        {!task.completed_status && isAssignedToMe && onComplete && (
          <button
            onClick={() => onComplete(task._id)}
            disabled={completing}
            className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-3 py-1.5 text-[10px] font-bold text-white transition hover:shadow-lg hover:shadow-emerald-500/20 disabled:opacity-40"
          >
            {completing ? "..." : "Mark Complete"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

TaskCard.propTypes = {
  task: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    completed_status: PropTypes.bool,
    assignedTo: PropTypes.shape({
      _id: PropTypes.string,
      name: PropTypes.string,
    }),
  }).isRequired,
  isAssignedToMe: PropTypes.bool,
  onComplete: PropTypes.func,
  completing: PropTypes.bool,
};

export default TaskCard;
