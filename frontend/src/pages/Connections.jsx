import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Web3Graph from "../components/network/Web3Graph";
import { processGraphData } from "../components/network/graphUtils";
import GraphControls from "../components/network/GraphControls";
import NodeInfoPanel from "../components/network/NodeInfoPanel";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../context/SocketContext";
import {
  getConnectionsOverview,
  expandNetwork,
} from "../services/api";

const EMPTY_OVERVIEW = {
  stats: { followers: 0, following: 0, mutual: 0 },
  graph: { centerUserId: null, nodes: [], edges: [] },
};

function getInitials(name) {
  if (!name) return "?";
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function NodeTooltip({ node, x, y }) {
  if (!node) return null;
  const relationLabel = {
    self: "You",
    mutual: "Mutual",
    following: "Following",
    follower: "Follower",
  }[node.relation] || "User";

  const relationColorClass = {
    self: "border-purple-500/40 bg-purple-500/10 text-purple-300",
    mutual: "border-green-500/40 bg-green-500/10 text-green-300",
    following: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300",
    follower: "border-pink-500/40 bg-pink-500/10 text-pink-300",
  }[node.relation] || "border-gray-500/40 bg-gray-500/10 text-gray-300";

  return (
    <div
      className="pointer-events-none fixed z-50"
      style={{ left: x + 14, top: y - 10, transform: "translateY(-50%)" }}
    >
      <div className="rounded-xl border border-white/[0.12] bg-gray-900/90 px-4 py-3 shadow-2xl backdrop-blur-md min-w-[180px]">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="relative flex-shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 text-xs font-bold text-white ring-1 ring-white/20">
              {getInitials(node.name)}
            </div>
            {node.online && (
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-gray-900" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{node.name}</p>
            <p className="truncate text-[10px] text-gray-400">{node.collegeName || node.institutionName || ""}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${relationColorClass}`}>
            {relationLabel}
          </span>
          <span className="rounded-md border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300 capitalize">
            {node.role || "student"}
          </span>
          {(node.nftCount || 0) > 0 && (
            <span className="rounded-md border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              NFT
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Connections() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const graphRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [isExpanding, setIsExpanding] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [graphDimensions, setGraphDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  const loadConnectionsOverview = useCallback(async (search) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      setConnectionsLoading(true);
      const data = await getConnectionsOverview(token, search || "");
      setOverview(data || EMPTY_OVERVIEW);
    } catch (err) {
      console.error("Failed to load connections:", err);
    } finally {
      setConnectionsLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await loadConnectionsOverview();
  }, [loadConnectionsOverview]);

  useEffect(() => {
    if (!user?.id) return;
    loadConnectionsOverview();
  }, [user?.id, loadConnectionsOverview]);

  useEffect(() => {
    const handleResize = () => {
      setGraphDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleFollowCreated = () => refreshAll();
    const handleFollowRemoved = () => refreshAll();
    socket.on("followCreated", handleFollowCreated);
    socket.on("followRemoved", handleFollowRemoved);
    return () => {
      socket.off("followCreated", handleFollowCreated);
      socket.off("followRemoved", handleFollowRemoved);
    };
  }, [socket, refreshAll]);

  const graphData = useMemo(() => {
    const graph = overview?.graph || EMPTY_OVERVIEW.graph;
    return processGraphData(graph);
  }, [overview]);

  const graphDataWithFallback = useMemo(() => {
    if (graphData.nodes.length >= 2) return graphData;
    return {
      nodes: [
        { id: "fallback-self", name: "You (Demo)", role: "student", relation: "self", color: "#06b6d4", size: 12, stats: { followers: 0, following: 0 }, communityCount: 0, nftCount: 0 },
        { id: "fallback-user1", name: "Demo User", role: "teacher", relation: "following", color: "#6366f1", size: 8, stats: { followers: 12, following: 5 }, communityCount: 2, nftCount: 1 },
      ],
      links: [{ source: "fallback-self", target: "fallback-user1", type: "following" }],
    };
  }, [graphData]);

  const handleNodeClick = useCallback((node) => {
    if (node.relation !== "self") {
      setSelectedNode(node);
    } else {
      setSelectedNode(null);
    }
  }, []);

  const handleBackgroundClick = useCallback(() => setSelectedNode(null), []);

  const handleExpandNode = useCallback(async (node) => {
    if (!node || node.relation === "self") return;
    if (expandedNodes.has(node.id)) return;
    if (node.id && node.id.startsWith("fallback-")) return;
    try {
      setIsExpanding(true);
      const token = localStorage.getItem("token");
      if (!token) return;
      const result = await expandNetwork(node.id, token, 1, 30);
      if (result?.nodes?.length > 0) {
        setExpandedNodes((prev) => new Set(prev).add(node.id));
        setOverview((prev) => {
          if (!prev) return prev;
          const existingNodeIds = new Set((prev.graph?.nodes || []).map((n) => n.id));
          const newNodes = result.nodes.filter((n) => !existingNodeIds.has(n.id));
          const existingEdgeKeys = new Set(
            (prev.graph?.edges || []).map((e) => `${e.source}-${e.target}`)
          );
          const newEdges = (result.edges || []).filter(
            (e) => !existingEdgeKeys.has(`${e.source}-${e.target}`)
          );
          if (!newNodes.length && !newEdges.length) return prev;
          return {
            ...prev,
            graph: {
              ...prev.graph,
              nodes: [...(prev.graph?.nodes || []), ...newNodes],
              edges: [...(prev.graph?.edges || []), ...newEdges],
            },
          };
        });
      }
    } catch (err) {
      console.error("Expand network error:", err);
    } finally {
      setIsExpanding(false);
    }
  }, [expandedNodes]);

  const handleNodeDoubleClick = useCallback((node) => {
    if (node && node.id && node.relation !== "self" && !node.id.startsWith("fallback-")) {
      navigate(`/profile/${node.id}`);
    }
  }, [navigate]);

  const handleNodeHover = useCallback((node) => {
    setHoveredNode(node || null);
    document.body.style.cursor = node ? "pointer" : "default";
  }, []);

  useEffect(() => {
    const handler = (e) => setTooltipPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  const handleZoomIn = useCallback(() => {
    const g = graphRef.current;
    if (!g) return;
    const c = g.zoom();
    g.zoom(Math.min(c * 1.3, 4), 400);
  }, []);

  const handleZoomOut = useCallback(() => {
    const g = graphRef.current;
    if (!g) return;
    const c = g.zoom();
    g.zoom(Math.max(c / 1.3, 0.3), 400);
  }, []);

  const handleCenter = useCallback(() => {
    const g = graphRef.current;
    if (!g) return;
    g.centerAt(0, 0, 400);
    g.zoom(2, 400);
  }, []);

  const handleReset = useCallback(() => {
    graphRef.current?.zoomToFit(400, 80);
  }, []);

  const handleExpandAll = useCallback(async () => {
    const toExpand = (graphData.nodes || []).filter(
      (n) => n.relation !== "self" && !expandedNodes.has(n.id) && !n.id.startsWith("fallback-")
    );
    for (const node of toExpand) {
      await handleExpandNode(node);
    }
  }, [graphData, expandedNodes, handleExpandNode]);

  const nodeCount = Math.max(0, (overview.graph.nodes || []).length);

  return (
    <div className="fixed inset-0 z-10 flex flex-col bg-[#050510]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(6,182,212,0.04)_0%,_transparent_70%)] pointer-events-none" />

      <header className="relative z-30 flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-white tracking-tight">Connections</h1>
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-gray-500">
            <span className="text-cyan-400/80">{overview.stats.followers || 0} followers</span>
            <span className="text-gray-600">·</span>
            <span className="text-purple-400/80">{overview.stats.following || 0} following</span>
            <span className="text-gray-600">·</span>
            <span className="text-green-400/80">{overview.stats.mutual || 0} mutual</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-gray-600">
            {nodeCount} node{nodeCount !== 1 ? "s" : ""} · click to expand · double-click for profile
          </p>
        </div>
      </header>

      <div className="relative flex-1">
        {connectionsLoading && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#050510]/60">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
          </div>
        )}

        <NodeInfoPanel
          selectedNode={selectedNode}
          stats={overview.stats}
          onClose={() => setSelectedNode(null)}
        />

        <Web3Graph
          ref={graphRef}
          graphData={graphDataWithFallback}
          width={graphDimensions.width}
          height={graphDimensions.height - 61}
          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          onBackgroundClick={handleBackgroundClick}
          onExpandNode={handleExpandNode}
          autoRotate={autoRotate}
          onNodeDoubleClick={handleNodeDoubleClick}
          className="absolute inset-0"
        />

        {hoveredNode && (
          <NodeTooltip node={hoveredNode} x={tooltipPos.x} y={tooltipPos.y} />
        )}

        <GraphControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onCenter={handleCenter}
          onReset={handleReset}
          onToggleFullscreen={() => {
            if (!document.fullscreenElement) {
              document.documentElement.requestFullscreen();
            } else {
              document.exitFullscreen();
            }
          }}
          onExpandAll={handleExpandAll}
          isExpanding={isExpanding}
          autoRotate={autoRotate}
          onToggleAutoRotate={() => setAutoRotate((p) => !p)}
          nodeCount={nodeCount}
        />
      </div>
    </div>
  );
}
