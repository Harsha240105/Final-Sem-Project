import { useRef, useCallback, useEffect, useState } from "react";
import { CanvasNode } from "../CanvasNode";
import { NodeConnections } from "../NodeConnections";
import { MiniMap } from "../MiniMap";
import { PresenceIndicators } from "../PresenceIndicators";
import { Toolbar } from "../Toolbar";
import { useCanvasStore, getCanvasStore } from "../../store/canvasStore";
import { useCanvasSocket } from "../../hooks/useCanvasSocket";
import { useCanvasDrag } from "../../hooks/useCanvasDrag";
import { calculateZoomLevel, screenToCanvas, createDefaultNode, createDefaultEdge } from "../../utils/canvasUtils";
import * as api from "../../../../shared/services/api";

const GRID_SIZE = 20;

export function CollaborationCanvas({ canvasId, readOnly = false }) {
  const store = useCanvasStore();
  const socketActions = useCanvasSocket(canvasId);
  const { nodes, edges, viewport, selectedNodes, presences } = store.getState();
  const containerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { handleDragStart, handleDragMove, handleDragEnd } = useCanvasDrag(store, socketActions, true);

  const [connectingMode, setConnectingMode] = useState(false);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      const cs = store.getState().connecting;
      setConnectingMode(cs.active);
    });
    return unsub;
  }, [store]);

  useEffect(() => {
    if (!canvasId) return;
    let mounted = true;

    async function loadCanvas() {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        if (!token) { setError("Not authenticated"); setLoading(false); return; }
        const { canvas } = await api.getCanvas(canvasId, token);
        if (mounted) {
          store.loadState(canvas.nodes, canvas.edges, canvas.viewport);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err.message || "Failed to load canvas");
          setLoading(false);
        }
      }
    }
    loadCanvas();
    return () => { mounted = false; };
  }, [canvasId, store]);

  useEffect(() => {
    if (!connectingMode) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        store.setConnecting({ active: false, source: null });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [connectingMode, store]);

  const handleWheel = useCallback(
    (e) => {
      e.preventDefault();
      if (!containerRef.current) return;
      const newZoom = calculateZoomLevel(e.deltaY, viewport.zoom);
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const scale = newZoom / viewport.zoom;
      const newPanX = mouseX - scale * (mouseX - viewport.panX);
      const newPanY = mouseY - scale * (mouseY - viewport.panY);
      store.setViewport({ zoom: newZoom, panX: newPanX, panY: newPanY });
      socketActions?.emitViewport({ zoom: newZoom, panX: newPanX, panY: newPanY });
    },
    [viewport, store, socketActions]
  );

  const handleMouseDown = useCallback(
    (e) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        e.preventDefault();
        store.setIsPanning(true);
        const startX = e.clientX;
        const startY = e.clientY;
        const startPanX = viewport.panX;
        const startPanY = viewport.panY;

        const onMove = (ev) => {
          store.setViewport({
            zoom: viewport.zoom,
            panX: startPanX + (ev.clientX - startX),
            panY: startPanY + (ev.clientY - startY),
          });
        };
        const onUp = () => {
          store.setIsPanning(false);
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return;
      }

      if (e.button === 0 && !e.target.closest("[data-node-id]")) {
        const cs = store.getState().connecting;
        if (cs.active) {
          store.setConnecting({ active: false, source: null });
          return;
        }
        store.clearSelection();
      }
    },
    [viewport, store]
  );

  const handleCanvasMouseMove = useCallback(
    (e) => {
      if (store.getState().isDragging) handleDragMove(e);
    },
    [handleDragMove, store]
  );

  const handleCanvasMouseUp = useCallback(
    (e) => {
      if (store.getState().isDragging) handleDragEnd(e);
    },
    [handleDragEnd, store]
  );

  const handleCanvasDrop = useCallback(
    (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("nodeType");
      if (!type || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const sp = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top, viewport.panX, viewport.panY, viewport.zoom);
      const node = createDefaultNode(type, sp);
      store.addNode(node);
      socketActions?.emitNodeAdd(node);
      api.addCanvasNode(canvasId, node, localStorage.getItem("token")).catch((err) => console.error("[Canvas] Failed to persist node:", err));
    },
    [viewport, store, socketActions, canvasId]
  );

  const handleCanvasDragOver = useCallback((e) => { e.preventDefault(); }, []);

  const handleAddNode = useCallback(
    (type) => {
      const el = containerRef.current;
      if (!el) return;
      const center = screenToCanvas(el.clientWidth / 2, el.clientHeight / 2, viewport.panX, viewport.panY, viewport.zoom);
      const node = createDefaultNode(type, center);
      store.addNode(node);
      socketActions?.emitNodeAdd(node);
      api.addCanvasNode(canvasId, node, localStorage.getItem("token")).catch((err) => console.error("[Canvas] Failed to persist node:", err));
    },
    [viewport, store, socketActions, canvasId]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#060812]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-[#060812]">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#060812]">
      <div
        ref={containerRef}
        className={`absolute inset-0 ${connectingMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onDrop={handleCanvasDrop}
        onDragOver={handleCanvasDragOver}
        style={{ backgroundImage: `radial-gradient(circle, rgba(34,211,238,0.06) 1px, transparent 1px)`, backgroundSize: `${GRID_SIZE * viewport.zoom}px ${GRID_SIZE * viewport.zoom}px` }}
      >
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            transform: `scale(${viewport.zoom}) translate(${viewport.panX / viewport.zoom}px, ${viewport.panY / viewport.zoom}px)`,
            transformOrigin: "0 0",
          }}
        >
          <svg className="absolute inset-0 pointer-events-none" style={{ width: 10000, height: 10000, left: -5000, top: -5000 }}>
            <NodeConnections nodes={nodes} edges={edges} selectedNodes={selectedNodes} />
          </svg>

          {nodes.map((node) => (
            <CanvasNode
              key={node.nodeId}
              node={node}
              isSelected={selectedNodes.has(node.nodeId)}
              onDragStart={(e) => handleDragStart(node.nodeId, e)}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              store={store}
              socketActions={socketActions}
              canvasId={canvasId}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>

      <Toolbar onAddNode={handleAddNode} readOnly={readOnly} />

      <MiniMap
        nodes={nodes}
        edges={edges}
        viewport={viewport}
        containerRef={containerRef}
        onViewportChange={(v) => store.setViewport(v)}
      />

      <PresenceIndicators presences={presences} />
    </div>
  );
}
