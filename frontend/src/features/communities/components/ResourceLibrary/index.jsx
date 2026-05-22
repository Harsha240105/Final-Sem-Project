import { useState, memo } from "react";
import { addCommunityResource, deleteCommunityResource } from "../../../../shared/services/api";
import { useToast } from "../../../../shared/hooks/useToast";
import { resolvePath } from "../../utils";

const RESOURCE_ICONS = {
  file: "📎",
  link: "🔗",
  video: "🎬",
  document: "📄",
};

function ResourceLibrary({ resources = [], communityId, isAdmin, isArchived, onRefresh }) {
  const { addToast } = useToast();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [resourceType, setResourceType] = useState("file");
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState("");

  const handleAdd = async () => {
    if (!title.trim()) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("description", desc.trim());
      formData.append("type", resourceType);
      if (file) formData.append("file", file);
      if (url.trim()) formData.append("url", url.trim());
      await addCommunityResource(communityId, formData, token);
      addToast("Resource added", "success");
      setTitle(""); setDesc(""); setFile(null); setUrl(""); setAdding(false);
      onRefresh?.();
    } catch {
      addToast("Failed to add", "error");
    }
  };

  const handleDelete = async (resourceId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await deleteCommunityResource(communityId, resourceId, token);
      addToast("Resource deleted", "success");
      onRefresh?.();
    } catch {
      addToast("Failed to delete", "error");
    }
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">📚 Resources</h3>
        {isAdmin && !isArchived && (
          <button onClick={() => setAdding(!adding)} className="text-[10px] text-cyan-400 hover:text-cyan-300 transition">
            {adding ? "Cancel" : "+ Add"}
          </button>
        )}
      </div>

      {adding && (
        <div className="space-y-2 mb-4 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title *" className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/40" />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/40" />
          <select value={resourceType} onChange={(e) => setResourceType(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/40">
            <option value="file">File</option>
            <option value="link">Link</option>
            <option value="video">Video</option>
            <option value="document">Document</option>
          </select>
          {resourceType !== "link" && (
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="w-full text-xs text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-cyan-500/10 file:text-cyan-400" />
          )}
          {(resourceType === "link" || resourceType === "video") && (
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/40" />
          )}
          <button onClick={handleAdd} className="rounded-lg bg-cyan-500 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-400 transition">Add</button>
        </div>
      )}

      {resources.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-4">No resources yet</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 max-h-60 overflow-y-auto scrollbar-thin">
          {resources.map((r, i) => (
            <div key={r._id || i} className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2 hover:bg-white/[0.04] transition">
              <span className="text-sm shrink-0">{RESOURCE_ICONS[r.type] || "📎"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white truncate">{r.title}</p>
                {r.description && <p className="text-[10px] text-gray-500 truncate">{r.description}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {r.url && (
                  <a href={resolvePath(r.url)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:text-cyan-300">Open</a>
                )}
                {isAdmin && !isArchived && (
                  <button onClick={() => handleDelete(r._id)} className="text-[10px] text-gray-600 hover:text-red-400">✕</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default memo(ResourceLibrary);
