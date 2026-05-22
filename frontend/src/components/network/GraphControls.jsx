import { motion } from "framer-motion";

const btnBase =
  "flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-black/50 text-xs text-gray-300 backdrop-blur-md hover:border-cyan-500/40 hover:text-white hover:shadow-[0_0_16px_rgba(0,245,255,0.12)] transition-all duration-200 active:scale-90";

export default function GraphControls({
  onZoomIn, onZoomOut, onCenter, onReset, onToggleFullscreen, isFullscreen,
  onExpandAll, isExpanding, autoRotate, onToggleAutoRotate, nodeCount, activeFilters, onToggleFilters,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-none absolute bottom-6 left-1/2 z-30 -translate-x-1/2"
    >
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-gray-900/70 px-3 py-2 backdrop-blur-md shadow-2xl">
        <button onClick={onZoomIn} className={btnBase} title="Zoom In">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m-8-8h16" />
          </svg>
        </button>
        <button onClick={onZoomOut} className={btnBase} title="Zoom Out">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
          </svg>
        </button>
        <div className="mx-1 h-8 w-px bg-white/[0.06]" />
        <button onClick={onCenter} className={btnBase} title="Center on Me">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h2m14 0h2M12 3v2m0 14v2" />
          </svg>
        </button>
        <button onClick={onReset} className={btnBase} title="Fit All">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
        <div className="mx-1 h-8 w-px bg-white/[0.06]" />
        <button
          onClick={onToggleAutoRotate}
          className={`${btnBase} ${autoRotate ? "border-cyan-500/60 text-cyan-300 shadow-[0_0_12px_rgba(0,245,255,0.25)]" : ""}`}
          title={autoRotate ? "Stop Rotation" : "Auto Rotate"}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <div className="mx-1 h-8 w-px bg-white/[0.06]" />
        <button onClick={onExpandAll} disabled={isExpanding} className={btnBase} title="Expand Network">
          {isExpanding ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-cyan-400" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m0-16l-3 3m3-3l3 3M4 12h16" />
            </svg>
          )}
        </button>
        <div className="mx-1 h-8 w-px bg-white/[0.06]" />
        <button onClick={onToggleFullscreen} className={btnBase} title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
          {isFullscreen ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
        {nodeCount !== undefined && (
          <>
            <div className="mx-1 h-8 w-px bg-white/[0.06]" />
            <div className="px-3 text-[10px] font-medium text-gray-500 whitespace-nowrap">
              {nodeCount} <span className="text-gray-600">nodes</span>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
