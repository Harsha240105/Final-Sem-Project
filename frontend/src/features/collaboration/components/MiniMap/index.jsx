import { memo, useRef, useCallback, useState, useEffect } from "react";
import { Maximize2 } from "lucide-react";

const MINIMAP_SIZE = 160;
const VIEWPORT_PADDING = 100;

export const MiniMap = memo(function MiniMap({ nodes, edges, viewport, containerRef, onViewportChange }) {
  const svgRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const bounds = nodes.reduce(
    (acc, n) => ({
      minX: Math.min(acc.minX, n.position.x),
      minY: Math.min(acc.minY, n.position.y),
      maxX: Math.max(acc.maxX, n.position.x + n.size.width),
      maxY: Math.max(acc.maxY, n.position.y + n.size.height),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  if (nodes.length === 0) {
    return null;
  }

  const canvasW = bounds.maxX - bounds.minX + VIEWPORT_PADDING * 2 || 500;
  const canvasH = bounds.maxY - bounds.minY + VIEWPORT_PADDING * 2 || 500;
  const scale = Math.min(MINIMAP_SIZE / canvasW, MINIMAP_SIZE / canvasH);

  const mapW = canvasW * scale;
  const mapH = canvasH * scale;

  const containerRect = containerRef?.current?.getBoundingClientRect();
  const viewW = containerRect?.width || 800;
  const viewH = containerRect?.height || 600;

  const viewX = (-viewport.panX / viewport.zoom - bounds.minX + VIEWPORT_PADDING) * scale;
  const viewY = (-viewport.panY / viewport.zoom - bounds.minY + VIEWPORT_PADDING) * scale;
  const viewBoxW = (viewW / viewport.zoom) * scale;
  const viewBoxH = (viewH / viewport.zoom) * scale;

  const handleMiniMapClick = useCallback(
    (e) => {
      const rect = svgRef.current.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / scale;
      const my = (e.clientY - rect.top) / scale;

      const targetX = -(mx - viewW / 2 / viewport.zoom) * viewport.zoom;
      const targetY = -(my - viewH / 2 / viewport.zoom) * viewport.zoom;

      onViewportChange({ zoom: viewport.zoom, panX: targetX, panY: targetY });
    },
    [viewport, viewW, viewH, onViewportChange]
  );

  return (
    <div
      className={`absolute bottom-4 right-4 z-40 rounded-lg border border-slate-700/50 bg-slate-900/90 backdrop-blur-md shadow-xl overflow-hidden transition-all duration-200 ${
        isExpanded ? "w-56" : "w-40"
      }`}
    >
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/5">
        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Navigator</span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-0.5 rounded hover:bg-white/5 text-slate-500 hover:text-slate-300"
        >
          <Maximize2 size={10} />
        </button>
      </div>
      <svg
        ref={svgRef}
        width={isExpanded ? 224 : 160}
        height={isExpanded ? 224 : 160}
        viewBox={`0 0 ${canvasW} ${canvasH}`}
        className="cursor-pointer"
        onClick={handleMiniMapClick}
        style={{ maxWidth: "100%", height: "auto" }}
      >
        <rect width={canvasW} height={canvasH} fill="rgba(6,8,18,0.6)" rx="4" />

        {edges.map((edge) => {
          const src = nodes.find((n) => n.nodeId === edge.source);
          const tgt = nodes.find((n) => n.nodeId === edge.target);
          if (!src || !tgt) return null;
          const sx = src.position.x + src.size.width / 2 - bounds.minX + VIEWPORT_PADDING;
          const sy = src.position.y + src.size.height / 2 - bounds.minY + VIEWPORT_PADDING;
          const tx = tgt.position.x + tgt.size.width / 2 - bounds.minX + VIEWPORT_PADDING;
          const ty = tgt.position.y + tgt.size.height / 2 - bounds.minY + VIEWPORT_PADDING;
          return (
            <line
              key={edge.edgeId}
              x1={sx} y1={sy} x2={tx} y2={ty}
              stroke="rgba(148,163,184,0.15)"
              strokeWidth={1}
            />
          );
        })}

        {nodes.map((node) => {
          const x = node.position.x - bounds.minX + VIEWPORT_PADDING;
          const y = node.position.y - bounds.minY + VIEWPORT_PADDING;
          return (
            <rect
              key={node.nodeId}
              x={x}
              y={y}
              width={Math.max(node.size.width / 2, 6)}
              height={Math.max(node.size.height / 2, 4)}
              rx="2"
              fill="rgba(34,211,238,0.4)"
              stroke="rgba(34,211,238,0.2)"
              strokeWidth={0.5}
            />
          );
        })}

        <rect
          x={(-viewport.panX / viewport.zoom - bounds.minX + VIEWPORT_PADDING)}
          y={(-viewport.panY / viewport.zoom - bounds.minY + VIEWPORT_PADDING)}
          width={viewW / viewport.zoom}
          height={viewH / viewport.zoom}
          fill="none"
          stroke="rgba(34,211,238,0.5)"
          strokeWidth={2}
          rx="2"
        />
      </svg>
    </div>
  );
});
