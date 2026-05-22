import { useEffect, useRef, useCallback } from "react";
import { useSocket } from "../../../shared/services/SocketContext";
import { getCanvasStore } from "../store/canvasStore";

export function useCanvasSocket(canvasId) {
  const socket = useSocket();
  const store = useRef(null);
  const joined = useRef(false);

  useEffect(() => {
    store.current = getCanvasStore();
  }, []);

  useEffect(() => {
    if (!socket || !canvasId || joined.current) return;

    socket.emit("canvas:join", { canvasId });
    joined.current = true;

    const handleNodeMoved = ({ nodeId, position, userId }) => {
      const s = store.current;
      if (s && userId !== socket.userId) {
        s.moveNode(nodeId, position);
      }
    };

    const handleNodeAdded = ({ node }) => {
      store.current?.addNode(node);
    };

    const handleNodeRemoved = ({ nodeId }) => {
      store.current?.removeNode(nodeId);
    };

    const handleNodeUpdated = ({ nodeId, data }) => {
      store.current?.updateNode(nodeId, data);
    };

    const handleEdgeAdded = ({ edge }) => {
      store.current?.addEdge(edge);
    };

    const handleEdgeRemoved = ({ edgeId }) => {
      store.current?.removeEdge(edgeId);
    };

    const handlePresence = ({ userId, userName, action }) => {
      const s = store.current;
      if (action === "joined") {
        s?.updatePresence(userId, { userName, online: true });
      } else {
        s?.removePresence(userId);
      }
    };

    socket.on("canvas:node-moved", handleNodeMoved);
    socket.on("canvas:node-added", handleNodeAdded);
    socket.on("canvas:node-removed", handleNodeRemoved);
    socket.on("canvas:node-updated", handleNodeUpdated);
    socket.on("canvas:edge-added", handleEdgeAdded);
    socket.on("canvas:edge-removed", handleEdgeRemoved);
    socket.on("canvas:presence", handlePresence);

    return () => {
      if (socket && canvasId) {
        socket.emit("canvas:leave", { canvasId });
        joined.current = false;
      }
      socket?.off("canvas:node-moved", handleNodeMoved);
      socket?.off("canvas:node-added", handleNodeAdded);
      socket?.off("canvas:node-removed", handleNodeRemoved);
      socket?.off("canvas:node-updated", handleNodeUpdated);
      socket?.off("canvas:edge-added", handleEdgeAdded);
      socket?.off("canvas:edge-removed", handleEdgeRemoved);
      socket?.off("canvas:presence", handlePresence);
    };
  }, [socket, canvasId]);

  const emitNodeMove = useCallback(
    (nodeId, position) => {
      if (!socket || !canvasId) return;
      socket.emit("canvas:node-move", { canvasId, nodeId, position });
    },
    [socket, canvasId]
  );

  const emitNodeAdd = useCallback(
    (node) => {
      if (!socket || !canvasId) return;
      socket.emit("canvas:node-add", { canvasId, node });
    },
    [socket, canvasId]
  );

  const emitNodeRemove = useCallback(
    (nodeId) => {
      if (!socket || !canvasId) return;
      socket.emit("canvas:node-remove", { canvasId, nodeId });
    },
    [socket, canvasId]
  );

  const emitNodeUpdate = useCallback(
    (nodeId, data) => {
      if (!socket || !canvasId) return;
      socket.emit("canvas:node-update", { canvasId, nodeId, data });
    },
    [socket, canvasId]
  );

  const emitEdgeAdd = useCallback(
    (edge) => {
      if (!socket || !canvasId) return;
      socket.emit("canvas:edge-add", { canvasId, edge });
    },
    [socket, canvasId]
  );

  const emitEdgeRemove = useCallback(
    (edgeId) => {
      if (!socket || !canvasId) return;
      socket.emit("canvas:edge-remove", { canvasId, edgeId });
    },
    [socket, canvasId]
  );

  const emitViewport = useCallback(
    (viewport) => {
      if (!socket || !canvasId) return;
      socket.emit("canvas:viewport", { canvasId, viewport });
    },
    [socket, canvasId]
  );

  return {
    emitNodeMove,
    emitNodeAdd,
    emitNodeRemove,
    emitNodeUpdate,
    emitEdgeAdd,
    emitEdgeRemove,
    emitViewport,
  };
}
