import { memo, useCallback, useRef, useState } from "react";
import { NODE_TYPE_CONFIG, createDefaultEdge } from "../../utils/canvasUtils";
import { RoomTypeContent } from "../RoomTypes";
import { MessageSquare, Headphones, FolderOpen, ExternalLink, Layout, User, Layers, GripVertical, Trash2, Link2 } from "lucide-react";
import * as api from "../../../../shared/services/api";

const ICON_MAP = {
  MessageSquare, Headphones, FolderOpen, ExternalLink, Layout, User, Layers,
};

function getNodeStyle(type) {
  return NODE_TYPE_CONFIG[type] || NODE_TYPE_CONFIG.text_room;
}

export const CanvasNode = memo(function CanvasNode({
  node,
  isSelected,
  onDragStart,
  store,
  socketActions,
  canvasId,
  readOnly = false,
}) {
  const config = getNodeStyle(node.type);
  const [showMenu, setShowMenu] = useState(false);
  const dragRef = useRef(null);

  const Icon = ICON_MAP[config.icon] || MessageSquare;

  const handleMouseDown = useCallback(
    (e) => {
      if (readOnly) return;
      const state = store.getState();
      if (state.connecting.active) {
        e.preventDefault();
        if (state.connecting.source !== node.nodeId) {
          const edge = createDefaultEdge(state.connecting.source, node.nodeId);
          store.addEdge(edge);
          socketActions?.emitEdgeAdd(edge);
          if (canvasId) {
            api.addCanvasEdge(canvasId, edge, localStorage.getItem("token")).catch(() => {});
          }
        }
        store.setConnecting({ active: false, source: null });
        return;
      }
      if (e.button === 0 && !e.target.closest("[data-no-drag]")) {
        onDragStart(e, false);
      }
    },
    [onDragStart, readOnly, store, socketActions, canvasId, node.nodeId]
  );

  const handleDelete = useCallback(async () => {
    store.removeNode(node.nodeId);
    socketActions?.emitNodeRemove(node.nodeId);
    if (canvasId) {
      api.deleteCanvasNode(canvasId, node.nodeId, localStorage.getItem("token")).catch(() => {});
    }
    setShowMenu(false);
  }, [node.nodeId, store, socketActions, canvasId]);

  const handleConnect = useCallback(() => {
    store.setConnecting({ active: true, source: node.nodeId });
    setShowMenu(false);
  }, [node.nodeId, store]);

  const handleLabelChange = useCallback(
    (e) => {
      const label = e.target.value;
      store.updateNode(node.nodeId, { label });
      socketActions?.emitNodeUpdate(node.nodeId, { label });
    },
    [node.nodeId, store, socketActions]
  );

  if (node.type === "user") {
    return (
      <div
        data-node-id={node.nodeId}
        className={`absolute group transition-shadow duration-150 ${isSelected ? "z-20" : "z-10"}`}
        style={{
          left: node.position.x,
          top: node.position.y,
          width: node.size.width,
          height: node.size.height,
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="relative h-full rounded-xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 border border-slate-600/30 shadow-lg backdrop-blur-sm flex items-center gap-3 px-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {node.label?.split(" ").map((w) => w[0]).join("").slice(0, 2) || "U"}
          </div>
          <span className="text-sm text-slate-200 font-medium truncate flex-1">{node.label}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      data-node-id={node.nodeId}
      className={`absolute group transition-shadow duration-150 ${isSelected ? "z-30 ring-2 ring-cyan-400/50" : "z-10"}`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width: node.size.width,
        height: node.size.height,
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="relative h-full rounded-xl bg-gradient-to-br from-slate-800/90 to-slate-900/90 backdrop-blur-sm overflow-hidden flex flex-col"
        style={{
          borderColor: isSelected ? "#22d3ee" : config.borderColor,
          borderWidth: 1,
          boxShadow: isSelected ? "0 0 20px rgba(34,211,238,0.15)" : "0 4px 16px rgba(0,0,0,0.3)",
        }}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${config.bgGradient} pointer-events-none`} />

        <div className="relative flex items-center justify-between px-3 py-2 border-b border-white/5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Icon size={14} style={{ color: config.color }} />
            {readOnly ? (
              <span className="text-xs font-semibold text-slate-200 truncate">{node.label}</span>
            ) : (
              <input
                value={node.label}
                onChange={handleLabelChange}
                className="text-xs font-semibold text-slate-200 bg-transparent border-none outline-none truncate flex-1 min-w-0"
                placeholder={config.label}
                data-no-drag
              />
            )}
          </div>
          {!readOnly && (
            <div className="relative" data-no-drag>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1 rounded-md hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <GripVertical size={12} />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-32 rounded-lg bg-slate-800 border border-slate-700 shadow-xl z-50 py-1">
                  <button
                    onClick={handleConnect}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-slate-300 hover:bg-cyan-500/10 transition-colors"
                  >
                    <Link2 size={12} /> Connect
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative flex-1 p-3 overflow-hidden">
          <RoomTypeContent node={node} />
        </div>
      </div>
    </div>
  );
});
