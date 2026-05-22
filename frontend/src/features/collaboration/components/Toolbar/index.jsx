import { memo, useState, useCallback } from "react";
import { getCanvasStore } from "../../store/canvasStore";
import { MessageSquare, Headphones, FolderOpen, ExternalLink, Layout, Undo2, Redo2, ZoomIn, ZoomOut, Plus, Hand } from "lucide-react";

const NODE_ACTIONS = [
  { type: "text_room", icon: MessageSquare, label: "Text Room", color: "text-cyan-400" },
  { type: "voice_room", icon: Headphones, label: "Voice Room", color: "text-purple-400" },
  { type: "file_room", icon: FolderOpen, label: "File Room", color: "text-emerald-400" },
  { type: "publishing_room", icon: ExternalLink, label: "Publishing", color: "text-orange-400" },
  { type: "workspace", icon: Layout, label: "Workspace", color: "text-blue-400" },
];

export const Toolbar = memo(function Toolbar({ onAddNode, readOnly = false }) {
  const [expanded, setExpanded] = useState(false);

  const handleUndo = useCallback(() => {
    getCanvasStore().undo();
  }, []);

  const handleRedo = useCallback(() => {
    getCanvasStore().redo();
  }, []);

  const handleZoomIn = useCallback(() => {
    const store = getCanvasStore();
    const vp = store.getState().viewport;
    const newZoom = Math.min(vp.zoom + 0.2, 3);
    store.setViewport({ ...vp, zoom: newZoom });
  }, []);

  const handleZoomOut = useCallback(() => {
    const store = getCanvasStore();
    const vp = store.getState().viewport;
    const newZoom = Math.max(vp.zoom - 0.2, 0.1);
    store.setViewport({ ...vp, zoom: newZoom });
  }, []);

  const handleDragNode = useCallback(
    (type) => (e) => {
      e.dataTransfer.setData("nodeType", type);
      e.dataTransfer.effectAllowed = "copy";
    },
    []
  );

  if (readOnly) return null;

  return (
    <div className="absolute top-4 left-4 z-40 flex flex-col gap-2">
      <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900/90 backdrop-blur-md border border-slate-700/50 shadow-xl">
        <button
          onClick={handleZoomIn}
          className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-cyan-400 transition-colors"
          title="Zoom in"
        >
          <ZoomIn size={14} />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-cyan-400 transition-colors"
          title="Zoom out"
        >
          <ZoomOut size={14} />
        </button>
        <div className="w-px h-4 bg-slate-700/50 mx-1" />
        <button
          onClick={handleUndo}
          className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-cyan-400 transition-colors"
          title="Undo"
        >
          <Undo2 size={14} />
        </button>
        <button
          onClick={handleRedo}
          className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-cyan-400 transition-colors"
          title="Redo"
        >
          <Redo2 size={14} />
        </button>
        <div className="w-px h-4 bg-slate-700/50 mx-1" />
        <div className="relative">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-cyan-400 transition-colors"
            title="Add node"
          >
            <Plus size={14} />
          </button>
          {expanded && (
            <div className="absolute left-0 top-full mt-1 w-40 rounded-lg bg-slate-800 border border-slate-700 shadow-xl z-50 py-1">
              {NODE_ACTIONS.map((action) => (
                <button
                  key={action.type}
                  onClick={() => { onAddNode(action.type); setExpanded(false); }}
                  onDragStart={handleDragNode(action.type)}
                  draggable
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-300 hover:bg-cyan-500/10 transition-colors"
                >
                  <action.icon size={14} className={action.color} />
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
