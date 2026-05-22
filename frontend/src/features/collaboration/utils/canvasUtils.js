export const NODE_TYPES = {
  TEXT_ROOM: "text_room",
  VOICE_ROOM: "voice_room",
  FILE_ROOM: "file_room",
  PUBLISHING_ROOM: "publishing_room",
  WORKSPACE: "workspace",
  USER: "user",
  CLUSTER: "cluster",
};

export const NODE_TYPE_CONFIG = {
  text_room: {
    label: "Text Room",
    icon: "MessageSquare",
    color: "#22d3ee",
    defaultSize: { width: 220, height: 160 },
    bgGradient: "from-cyan-500/10 to-blue-500/5",
    borderColor: "border-cyan-500/30",
  },
  voice_room: {
    label: "Voice Room",
    icon: "Headphones",
    color: "#a78bfa",
    defaultSize: { width: 220, height: 140 },
    bgGradient: "from-purple-500/10 to-indigo-500/5",
    borderColor: "border-purple-500/30",
  },
  file_room: {
    label: "File Room",
    icon: "FolderOpen",
    color: "#34d399",
    defaultSize: { width: 220, height: 140 },
    bgGradient: "from-emerald-500/10 to-teal-500/5",
    borderColor: "border-emerald-500/30",
  },
  publishing_room: {
    label: "Publishing Room",
    icon: "ExternalLink",
    color: "#fb923c",
    defaultSize: { width: 240, height: 160 },
    bgGradient: "from-orange-500/10 to-amber-500/5",
    borderColor: "border-orange-500/30",
  },
  workspace: {
    label: "Workspace",
    icon: "Layout",
    color: "#60a5fa",
    defaultSize: { width: 280, height: 200 },
    bgGradient: "from-blue-500/10 to-sky-500/5",
    borderColor: "border-blue-500/30",
  },
  user: {
    label: "User",
    icon: "User",
    color: "#e2e8f0",
    defaultSize: { width: 160, height: 60 },
    bgGradient: "from-slate-500/10 to-gray-500/5",
    borderColor: "border-slate-500/30",
  },
  cluster: {
    label: "Cluster",
    icon: "Layers",
    color: "#f472b6",
    defaultSize: { width: 360, height: 280 },
    bgGradient: "from-pink-500/10 to-rose-500/5",
    borderColor: "border-pink-500/30",
  },
};

export function generateNodeId() {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateEdgeId() {
  return `edge_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createDefaultNode(type, position = { x: 0, y: 0 }, label = "") {
  const config = NODE_TYPE_CONFIG[type] || NODE_TYPE_CONFIG.text_room;
  return {
    nodeId: generateNodeId(),
    type,
    label: label || config.label,
    position: { ...position },
    size: { ...config.defaultSize },
    parentId: null,
    metadata: {},
    style: { color: config.color, icon: config.icon },
  };
}

export function getNodeCenter(node) {
  return {
    x: node.position.x + node.size.width / 2,
    y: node.position.y + node.size.height / 2,
  };
}

export function isPointInNode(px, py, node) {
  return (
    px >= node.position.x &&
    px <= node.position.x + node.size.width &&
    py >= node.position.y &&
    py <= node.position.y + node.size.height
  );
}

export function getConnectedNodes(nodeId, edges, nodes) {
  const connectedEdgeIds = new Set();
  const connectedNodeIds = new Set();

  edges.forEach((edge) => {
    if (edge.source === nodeId) {
      connectedEdgeIds.add(edge.edgeId);
      connectedNodeIds.add(edge.target);
    }
    if (edge.target === nodeId) {
      connectedEdgeIds.add(edge.edgeId);
      connectedNodeIds.add(edge.source);
    }
  });

  return {
    edgeIds: [...connectedEdgeIds],
    nodes: nodes.filter((n) => connectedNodeIds.has(n.nodeId)),
  };
}

export function snapToGrid(value, gridSize = 20) {
  return Math.round(value / gridSize) * gridSize;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function calculateZoomLevel(wheelDelta, currentZoom) {
  const delta = wheelDelta > 0 ? 0.1 : -0.1;
  const newZoom = currentZoom + delta;
  return clamp(newZoom, 0.1, 3);
}

export function screenToCanvas(screenX, screenY, panX, panY, zoom) {
  return {
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom,
  };
}
