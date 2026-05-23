import { useRef, useEffect, useState, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Maximize2, Minimize2, ZoomIn, ZoomOut } from "lucide-react";

function forceLayoutSimulation(nodes, edges, width, height) {
  const positioned = nodes.map((n, i) => ({
    ...n,
    x: width / 2 + (Math.random() - 0.5) * width * 0.5,
    y: height / 2 + (Math.random() - 0.5) * height * 0.5,
    vx: 0,
    vy: 0,
  }));

  const nodeMap = {};
  positioned.forEach((n) => { nodeMap[n.id] = n; });

  const iterations = 120;
  const repulsion = 800;
  const attraction = 0.005;
  const damping = 0.85;
  const minDist = 30;

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;

    for (let i = 0; i < positioned.length; i++) {
      positioned[i].vx = 0;
      positioned[i].vy = 0;
    }

    for (let i = 0; i < positioned.length; i++) {
      for (let j = i + 1; j < positioned.length; j++) {
        const dx = positioned[j].x - positioned[i].x;
        const dy = positioned[j].y - positioned[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        positioned[i].vx -= fx;
        positioned[i].vy -= fy;
        positioned[j].vx += fx;
        positioned[j].vy += fy;
      }
    }

    const centerX = width / 2;
    const centerY = height / 2;
    for (const n of positioned) {
      const dx = centerX - n.x;
      const dy = centerY - n.y;
      n.vx += dx * attraction;
      n.vy += dy * attraction;
    }

    if (edges) {
      for (const edge of edges) {
        const src = nodeMap[edge.source];
        const tgt = nodeMap[edge.target];
        if (!src || !tgt) continue;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), minDist);
        const force = (dist - 80) * 0.01;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        src.vx += fx;
        src.vy += fy;
        tgt.vx -= fx;
        tgt.vy -= fy;
      }
    }

    for (const n of positioned) {
      n.vx *= damping;
      n.vy *= damping;
      n.x += n.vx * cooling;
      n.y += n.vy * cooling;
      n.x = Math.max(20, Math.min(width - 20, n.x));
      n.y = Math.max(20, Math.min(height - 20, n.y));
    }
  }

  return positioned;
}

function getNodeColor(n, centerUserId) {
  if (n.id === centerUserId) return { fill: "#22d3ee", stroke: "rgba(34,211,238,0.6)", glow: "0 0 12px rgba(34,211,238,0.4)" };
  if (n.relation === "mutual") return { fill: "#c084fc", stroke: "rgba(192,132,252,0.5)", glow: "0 0 10px rgba(192,132,252,0.3)" };
  if (n.relation === "following") return { fill: "#a78bfa", stroke: "rgba(167,139,250,0.4)", glow: "0 0 8px rgba(167,139,250,0.2)" };
  if (n.relation === "follower") return { fill: "#34d399", stroke: "rgba(52,211,153,0.4)", glow: "0 0 8px rgba(52,211,153,0.2)" };
  return { fill: "#475569", stroke: "rgba(71,85,105,0.4)", glow: "none" };
}

function getNodeSize(n, centerUserId) {
  if (n.id === centerUserId) return 8;
  if (n.relation === "mutual") return 6;
  if (n.relation === "following" || n.relation === "follower") return 5;
  return 4;
}

export const NetworkGraph = memo(function NetworkGraph({ nodes: rawNodes, edges: rawEdges, centerUserId }) {
  const svgRef = useRef(null);
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [animPhase, setAnimPhase] = useState(0);

  const baseWidth = expanded ? 600 : 320;
  const baseHeight = expanded ? 500 : 260;
  const width = baseWidth * zoom;
  const height = baseHeight * zoom;

  useEffect(() => {
    if (rawNodes?.length) {
      const timer = setTimeout(() => setAnimPhase(1), 100);
      return () => clearTimeout(timer);
    }
  }, [rawNodes?.length]);

  if (!rawNodes || rawNodes.length === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
        <p className="text-sm text-slate-500">No network connections yet</p>
      </div>
    );
  }

  const layoutNodes = forceLayoutSimulation(rawNodes, rawEdges || [], baseWidth, baseHeight);
  const nodeMap = {};
  layoutNodes.forEach((n) => { nodeMap[n.id] = n; });

  const legend = [
    { color: "#22d3ee", label: "You" },
    { color: "#c084fc", label: "Mutual" },
    { color: "#a78bfa", label: "Following" },
    { color: "#34d399", label: "Follower" },
    { color: "#475569", label: "Other" },
  ];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-gradient-to-br from-slate-900/50 to-slate-950/50 overflow-hidden transition-all duration-300">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-sm font-semibold text-white">Network Graph</span>
          <span className="text-[10px] text-slate-500 ml-1">({rawNodes.length} nodes)</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
            className="p-1 rounded-md hover:bg-white/5 text-slate-400 hover:text-cyan-400 transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.2))}
            className="p-1 rounded-md hover:bg-white/5 text-slate-400 hover:text-cyan-400 transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded-md hover:bg-white/5 text-slate-400 hover:text-cyan-400 transition-colors"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          viewBox={`0 0 ${baseWidth} ${baseHeight}`}
          className="w-full"
          style={{ height: expanded ? 500 : 260 }}
        >
          <defs>
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(34,211,238,0.15)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0)" />
            </radialGradient>
            {(rawEdges || []).map((edge, i) => {
              const src = nodeMap[edge.source];
              const tgt = nodeMap[edge.target];
              if (!src || !tgt) return null;
              return (
                <linearGradient key={`grad-${i}`} id={`edgeGrad-${i}`} x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y} gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={getNodeColor(src, centerUserId).fill} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={getNodeColor(tgt, centerUserId).fill} stopOpacity={0.4} />
                </linearGradient>
              );
            })}
          </defs>

          {/* Background dots */}
          {Array.from({ length: 20 }).map((_, i) => (
            <circle
              key={`bg-${i}`}
              cx={Math.random() * baseWidth}
              cy={Math.random() * baseHeight}
              r={1}
              fill="rgba(148,163,184,0.08)"
            />
          ))}

          {/* Edges */}
          {(rawEdges || []).map((edge, i) => {
            const src = nodeMap[edge.source];
            const tgt = nodeMap[edge.target];
            if (!src || !tgt) return null;
            return (
              <line
                key={i}
                x1={src.x}
                y1={src.y}
                x2={tgt.x}
                y2={tgt.y}
                stroke={`url(#edgeGrad-${i})`}
                strokeWidth={edge.relation === "mutual" ? 2 : 1}
                className="transition-all duration-500"
                style={{ opacity: animPhase * 0.6 }}
              />
            );
          })}

          {/* Nodes */}
          {layoutNodes.map((n, i) => {
            const isCenter = n.id === centerUserId;
            const colors = getNodeColor(n, centerUserId);
            const r = getNodeSize(n, centerUserId);
            const isHovered = hoveredNode === n.id;
            const delay = i * 30;

            return (
              <g
                key={n.id}
                onClick={() => navigate(`/profile/${n.id}`)}
                onMouseEnter={() => setHoveredNode(n.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
                style={{ transition: "transform 0.2s" }}
              >
                {/* Glow circle */}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r + 10}
                  fill="url(#nodeGlow)"
                  style={{
                    opacity: isHovered ? 1 : 0,
                    transition: "opacity 0.3s",
                  }}
                />
                {/* Hit area */}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r + 6}
                  fill="transparent"
                />
                {/* Main circle */}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={isHovered ? r + 2 : r}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  style={{
                    filter: isHovered ? `drop-shadow(${colors.glow})` : "none",
                    opacity: animPhase,
                    transition: `all 0.4s ease ${delay}ms`,
                    transformOrigin: `${n.x}px ${n.y}px`,
                  }}
                />
                {/* Label on hover */}
                {isHovered && (
                  <>
                    <rect
                      x={n.x - n.name.length * 3.5 - 6}
                      y={n.y + r + 8}
                      width={n.name.length * 7 + 12}
                      height={16}
                      rx={4}
                      fill="rgba(15,23,42,0.9)"
                      stroke="rgba(148,163,184,0.2)"
                      strokeWidth={0.5}
                    />
                    <text
                      x={n.x}
                      y={n.y + r + 19}
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="9"
                      fontFamily="system-ui"
                      fontWeight="500"
                    >
                      {n.name}
                    </text>
                  </>
                )}
                {/* Always show label for center node */}
                {isCenter && !isHovered && (
                  <text
                    x={n.x}
                    y={n.y + r + 12}
                    textAnchor="middle"
                    fill="#22d3ee"
                    fontSize="7"
                    fontFamily="system-ui"
                    fontWeight="600"
                    style={{ opacity: animPhase * 0.8 }}
                  >
                    {n.name?.split(" ")[0]}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-2">
          {legend.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/40 backdrop-blur-sm">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[9px] text-slate-400">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});