import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CollaborationCanvas } from "../components/CollaborationCanvas";
import { NODE_TYPE_CONFIG } from "../utils/canvasUtils";
import * as api from "../../../shared/services/api";
import { Plus, Layout, ArrowLeft, Grid3X3, Trash2 } from "lucide-react";

function CanvasList({ onSelect }) {
  const [canvases, setCanvases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    loadCanvases();
  }, []);

  async function loadCanvases() {
    try {
      const token = localStorage.getItem("token");
      const data = await api.getMyCanvases(token);
      setCanvases(data.canvases || []);
    } catch (err) {
      console.error("Failed to load canvases:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleCreate = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const { canvas } = await api.createCanvas({
        name: newName || "My Collaboration Canvas",
        description: "",
      }, token);
      setCanvases((prev) => [canvas, ...prev]);
      setShowCreate(false);
      setNewName("");
      onSelect(canvas._id);
    } catch (err) {
      console.error("Failed to create canvas:", err);
    }
  }, [newName, onSelect]);

  const handleDelete = useCallback(async (canvasId, e) => {
    e.stopPropagation();
    if (!confirm("Delete this canvas?")) return;
    try {
      const token = localStorage.getItem("token");
      await api.deleteCanvas(canvasId, token);
      setCanvases((prev) => prev.filter((c) => c._id !== canvasId));
    } catch (err) {
      console.error("Failed to delete canvas:", err);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-6" style={{ backgroundColor: "#060812" }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Collaboration Canvas</h1>
          <p className="text-sm text-slate-400 mt-1">
            Visualize your teams, projects, and workspaces
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-medium hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/20"
        >
          <Plus size={16} />
          New Canvas
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 p-4 rounded-xl bg-slate-800/50 border border-cyan-500/20">
          <div className="flex items-center gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Canvas name..."
              className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-500/50 transition-colors"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <button
              onClick={handleCreate}
              className="px-4 py-2 rounded-lg bg-cyan-500 text-white text-sm font-medium hover:bg-cyan-400 transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {canvases.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10 flex items-center justify-center">
            <Layout size={32} className="text-cyan-400/60" />
          </div>
          <p className="text-slate-400 text-sm">No canvases yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {canvases.map((canvas) => (
            <button
              key={canvas._id}
              onClick={() => onSelect(canvas._id)}
              className="group text-left p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 hover:border-cyan-500/30 transition-all hover:shadow-lg hover:shadow-cyan-500/5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-500/10 flex items-center justify-center">
                  <Grid3X3 size={18} className="text-cyan-400" />
                </div>
                <button
                  onClick={(e) => handleDelete(canvas._id, e)}
                  className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1 truncate">
                {canvas.name}
              </h3>
              <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                {canvas.description || "No description"}
              </p>
              <div className="flex items-center gap-3 text-[10px] text-slate-500">
                <span>{(canvas.nodes?.length || 0)} nodes</span>
                <span>{canvas.collaborators?.length || 0} collaborators</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CanvasView({ canvasId, onBack }) {
  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: "#060812" }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-slate-900/50 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Canvas</span>
        </div>
      </div>
      <div className="flex-1 relative">
        <CollaborationCanvas canvasId={canvasId} />
      </div>
    </div>
  );
}

export default function CollaborationHub() {
  const { canvasId } = useParams();
  const navigate = useNavigate();
  const [activeCanvasId, setActiveCanvasId] = useState(canvasId || null);

  const handleSelect = useCallback((id) => {
    setActiveCanvasId(id);
    navigate(`/collaboration/${id}`, { replace: true });
  }, [navigate]);

  const handleBack = useCallback(() => {
    setActiveCanvasId(null);
    navigate("/collaboration", { replace: true });
  }, [navigate]);

  useEffect(() => {
    if (canvasId) setActiveCanvasId(canvasId);
  }, [canvasId]);

  return (
    <div className="h-full">
      {activeCanvasId ? (
        <CanvasView canvasId={activeCanvasId} onBack={handleBack} />
      ) : (
        <CanvasList onSelect={handleSelect} />
      )}
    </div>
  );
}
