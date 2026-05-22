import { useRef, useCallback, useState } from "react";

export function createCanvasStore() {
  const state = {
    nodes: [],
    edges: [],
    viewport: { zoom: 1, panX: 0, panY: 0 },
    selectedNodes: new Set(),
    selectedEdges: new Set(),
    hoveredNode: null,
    isDragging: false,
    isPanning: false,
    dragNodeId: null,
    connecting: { active: false, source: null },
    presences: new Map(),
    clipboard: null,
    history: { past: [], future: [] },
  };

  const listeners = new Set();

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function notify() {
    listeners.forEach((fn) => fn());
  }

  function getState() {
    return state;
  }

  function pushHistory() {
    state.history.past.push({
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
    });
    if (state.history.past.length > 50) state.history.past.shift();
    state.history.future = [];
  }

  function undo() {
    if (!state.history.past.length) return;
    state.history.future.push({
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
    });
    const prev = state.history.past.pop();
    state.nodes = prev.nodes;
    state.edges = prev.edges;
    notify();
  }

  function redo() {
    if (!state.history.future.length) return;
    state.history.past.push({
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
    });
    const next = state.history.future.pop();
    state.nodes = next.nodes;
    state.edges = next.edges;
    notify();
  }

  const actions = {
    setNodes: (nodes) => {
      pushHistory();
      state.nodes = nodes;
      notify();
    },
    setEdges: (edges) => {
      pushHistory();
      state.edges = edges;
      notify();
    },
    setViewport: (viewport) => {
      state.viewport = viewport;
      notify();
    },
    addNode: (node) => {
      pushHistory();
      state.nodes.push(node);
      notify();
      return node;
    },
    updateNode: (nodeId, updates) => {
      const idx = state.nodes.findIndex((n) => n.nodeId === nodeId);
      if (idx === -1) return;
      state.nodes[idx] = { ...state.nodes[idx], ...updates, updatedAt: new Date().toISOString() };
      notify();
    },
    removeNode: (nodeId) => {
      pushHistory();
      state.nodes = state.nodes.filter((n) => n.nodeId !== nodeId);
      state.edges = state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      );
      state.selectedNodes.delete(nodeId);
      notify();
    },
    addEdge: (edge) => {
      pushHistory();
      state.edges.push(edge);
      notify();
      return edge;
    },
    removeEdge: (edgeId) => {
      pushHistory();
      state.edges = state.edges.filter((e) => e.edgeId !== edgeId);
      state.selectedEdges.delete(edgeId);
      notify();
    },
    moveNode: (nodeId, position) => {
      const node = state.nodes.find((n) => n.nodeId === nodeId);
      if (node) {
        node.position = position;
        notify();
      }
    },
    selectNode: (nodeId, multi = false) => {
      if (!multi) state.selectedNodes.clear();
      if (state.selectedNodes.has(nodeId)) state.selectedNodes.delete(nodeId);
      else state.selectedNodes.add(nodeId);
      notify();
    },
    clearSelection: () => {
      state.selectedNodes.clear();
      state.selectedEdges.clear();
      notify();
    },
    setHoveredNode: (nodeId) => {
      state.hoveredNode = nodeId;
      notify();
    },
    setIsDragging: (v) => {
      state.isDragging = v;
      notify();
    },
    setIsPanning: (v) => {
      state.isPanning = v;
      notify();
    },
    setDragNodeId: (id) => {
      state.dragNodeId = id;
    },
    setConnecting: (v) => {
      state.connecting = v;
      notify();
    },
    setPresences: (presences) => {
      state.presences = presences;
      notify();
    },
    updatePresence: (userId, data) => {
      state.presences.set(userId, { ...data, lastSeen: Date.now() });
      notify();
    },
    removePresence: (userId) => {
      state.presences.delete(userId);
      notify();
    },
    loadState: (nodes, edges, viewport) => {
      state.nodes = nodes || [];
      state.edges = edges || [];
      state.viewport = viewport || { zoom: 1, panX: 0, panY: 0 };
      state.history = { past: [], future: [] };
      notify();
    },
    undo,
    redo,
    getState,
    subscribe,
  };

  return actions;
}

let storeInstance = null;

export function getCanvasStore() {
  if (!storeInstance) storeInstance = createCanvasStore();
  return storeInstance;
}

export function useCanvasStore(store = null) {
  const s = store || getCanvasStore();
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick((t) => t + 1), []);

  useState(() => {
    const unsub = s.subscribe(forceUpdate);
    return unsub;
  });

  return s;
}
