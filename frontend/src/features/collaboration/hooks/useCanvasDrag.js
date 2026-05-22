import { useRef, useCallback } from "react";
import { snapToGrid } from "../utils/canvasUtils";

export function useCanvasDrag(canvasStore, socketActions, gridSnap = true) {
  const dragState = useRef(null);

  const handleDragStart = useCallback(
    (nodeId, e, multi = false) => {
      e.stopPropagation();
      const node = canvasStore.getState().nodes.find((n) => n.nodeId === nodeId);
      if (!node) return;

      if (!multi) {
        canvasStore.clearSelection();
      }
      canvasStore.selectNode(nodeId, true);
      canvasStore.setIsDragging(true);

      dragState.current = {
        nodeId,
        startX: e.clientX,
        startY: e.clientY,
        nodeStartX: node.position.x,
        nodeStartY: node.position.y,
        selectedIds: [...canvasStore.getState().selectedNodes],
        selectedStartPositions: canvasStore.getState().nodes
          .filter((n) => canvasStore.getState().selectedNodes.has(n.nodeId))
          .map((n) => ({ nodeId: n.nodeId, x: n.position.x, y: n.position.y })),
      };
    },
    [canvasStore]
  );

  const handleDragMove = useCallback(
    (e) => {
      const ds = dragState.current;
      if (!ds) return;

      const dx = (e.clientX - ds.startX) / canvasStore.getState().viewport.zoom;
      const dy = (e.clientY - ds.startY) / canvasStore.getState().viewport.zoom;

      for (const { nodeId, x, y } of ds.selectedStartPositions) {
        const newX = gridSnap ? snapToGrid(x + dx) : x + dx;
        const newY = gridSnap ? snapToGrid(y + dy) : y + dy;
        canvasStore.moveNode(nodeId, { x: newX, y: newY });
      }
    },
    [canvasStore, gridSnap]
  );

  const handleDragEnd = useCallback(
    (e) => {
      const ds = dragState.current;
      if (!ds) return;

      canvasStore.setIsDragging(false);

      const dx = (e.clientX - ds.startX) / canvasStore.getState().viewport.zoom;
      const dy = (e.clientY - ds.startY) / canvasStore.getState().viewport.zoom;

      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        for (const { nodeId, x, y } of ds.selectedStartPositions) {
          const newX = gridSnap ? snapToGrid(x + dx) : x + dx;
          const newY = gridSnap ? snapToGrid(y + dy) : y + dy;
          if (socketActions) {
            socketActions.emitNodeMove(nodeId, { x: newX, y: newY });
          }
        }
      }

      dragState.current = null;
    },
    [canvasStore, socketActions, gridSnap]
  );

  return { handleDragStart, handleDragMove, handleDragEnd };
}
