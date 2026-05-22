import { motion, AnimatePresence } from "framer-motion";
import { STAGE_LABELS, getStageProgress } from "../../hooks/useMintProgress";

const STATUS_COLORS = {
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/20",
  generating_metadata: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  uploading_ipfs: "bg-cyan-500/20 text-cyan-400 border-cyan-500/20",
  minting: "bg-purple-500/20 text-purple-400 border-purple-500/20",
  confirming: "bg-indigo-500/20 text-indigo-400 border-indigo-500/20",
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/20",
  failed: "bg-red-500/20 text-red-400 border-red-500/20",
  retrying: "bg-amber-500/20 text-amber-400 border-amber-500/20",
};

function MintProgress({ activeJobs, lastCompleted, lastFailed, onDismissComplete, onDismissFailed }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {lastCompleted && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className="rounded-xl border border-emerald-500/20 bg-gray-900/95 backdrop-blur-lg p-4 shadow-2xl shadow-emerald-500/5"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
                <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-emerald-300">Certificate Minted!</p>
                <p className="text-[10px] text-gray-500 mt-0.5 truncate">{lastCompleted.communityName || "Community"}</p>
                {lastCompleted.tokenId && (
                  <p className="text-[9px] text-gray-600 mt-0.5">Token #{lastCompleted.tokenId}</p>
                )}
              </div>
              <button onClick={onDismissFailed} className="shrink-0 text-gray-600 hover:text-white transition">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lastFailed && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className="rounded-xl border border-red-500/20 bg-gray-900/95 backdrop-blur-lg p-4 shadow-2xl shadow-red-500/5"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500/20">
                <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-300">Mint Failed</p>
                <p className="text-[10px] text-gray-500 mt-0.5 truncate">{lastFailed.error || "Unknown error"}</p>
              </div>
              <button onClick={onDismissFailed} className="shrink-0 text-gray-600 hover:text-white transition">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeJobs.map(job => (
          <motion.div
            key={job.jobId}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className="rounded-xl border border-white/[0.08] bg-gray-900/95 backdrop-blur-lg p-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                <svg className="h-5 w-5 text-cyan-400 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`rounded-lg px-2 py-0.5 text-[9px] font-semibold border ${STATUS_COLORS[job.status] || "bg-gray-500/20 text-gray-400"}`}>
                    {STAGE_LABELS[job.status] || job.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1.5">{job.message || "Processing..."}</p>
                <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${job.progress || 0}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export default MintProgress;
