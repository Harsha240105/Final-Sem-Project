import { useRef, useEffect, useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Expand } from "lucide-react";

function forceLayout(nodes, edges, centerX, centerY, radius) {
  const positioned = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    return {
      ...n,
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });
  return positioned;
}

export const NetworkGraph = memo(function NetworkGraph({ nodes: rawNodes, edges: rawEdges, centerUserId }) {
  const svgRef = useRef(null);
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);

  const width = expanded ? 500 : 280;
  const height = expanded ? 400 : 220;
  const cx = width / 2;
  const cy = height / 2;

  if (!rawNodes || rawNodes.length === 0) return null;

  const layoutNodes = forceLayout(rawNodes, rawEdges || [], cx, cy, Math.min(cx, cy) * 0.6);
  const nodeMap = {};
  layoutNodes.forEach((n) => { nodeMap[n.id] = n; });

  return (
    <div className={`rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-all duration-300 ${expanded ? "" : ""}`}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-cyan-400" />
          <span className="text-sm font-semibold text-white">Network Graph</span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded-md hover:bg-white/5 text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <Expand size={14} />
        </button>
      </div>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: expanded ? 400 : 220 }}
      >
        {(rawEdges || []).map((edge, i) => {
          const src = nodeMap[edge.source];
          const tgt = nodeMap[edge.target];
          if (!src || !tgt) return null;
          return (
            <line
              key={i}
              x1={src.x} y1={src.y}
              x2={tgt.x} y2={tgt.y}
              stroke={edge.relation === "mutual" ? "rgba(34,211,238,0.3)" : "rgba(148,163,184,0.15)"}
              strokeWidth={edge.relation === "mutual" ? 1.5 : 1}
            />
          );
        })}
        {layoutNodes.map((n) => {
          const isCenter = n.id === centerUserId;
          const isFollowing = n.relation === "following" || n.relation === "mutual";
          const r = isCenter ? 6 : isFollowing ? 4 : 3;
          return (
            <g key={n.id} onClick={() => navigate(`/profile/${n.id}`)} className="cursor-pointer">
              <circle
                cx={n.x}
                cy={n.y}
                r={r + 3}
                fill="transparent"
                className="hover:fill-cyan-500/10 transition-colors"
              />
              <circle
                cx={n.x}
                cy={n.y}
                r={r}
                fill={isCenter ? "#22d3ee" : isFollowing ? "#a78bfa" : "#334155"}
                stroke={isCenter ? "rgba(34,211,238,0.5)" : isFollowing ? "rgba(167,139,250,0.3)" : "rgba(51,65,85,0.5)"}
                strokeWidth={1.5}
              />
              {expanded && (
                <text
                  x={n.x}
                  y={n.y + r + 12}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="8"
                  fontFamily="system-ui"
                >
                  {n.name?.split(" ")[0]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
});
