import { useState, useCallback, useEffect } from "react";
import { useToast } from "../../../../shared/hooks/useToast";
import { formatTime } from "../../utils";
import { createCommunityCollab, joinCommunityCollab, getCollabMessages } from "../../../../shared/services/api";

function CollaborationRooms({ community, isMember, isArchived, onRefresh }) {
  const { addToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activeCollab, setActiveCollab] = useState(null);
  const [collabMessages, setCollabMessages] = useState([]);
  const [collabText, setCollabText] = useState("");

  const collaborations = community?.collaborations || [];

  const loadCollabMessages = useCallback(async (collabId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token || !community?._id) return;
      const res = await getCollabMessages(community._id, collabId, token);
      setCollabMessages(res?.messages || []);
    } catch { /* silent */ }
  }, [community?._id]);

  useEffect(() => {
    if (activeCollab) loadCollabMessages(activeCollab);
  }, [activeCollab, loadCollabMessages]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await createCommunityCollab(
        community._id,
        { projectTitle: title.trim(), description: description.trim() },
        token
      );
      addToast("Collaboration created", "success");
      setTitle("");
      setDescription("");
      setCreating(false);
      onRefresh?.();
    } catch {
      addToast("Failed to create", "error");
    }
  };

  const handleJoin = async (collabId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await joinCommunityCollab(community._id, collabId, token);
      addToast("Joined collaboration", "success");
      onRefresh?.();
    } catch {
      addToast("Failed to join", "error");
    }
  };

  const handleSendMessage = async (collabId) => {
    if (!collabText.trim()) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const { default: api } = await import("../../../../shared/services/api");
      await api.sendCollabMessage(community._id, collabId, { text: collabText.trim() }, token);
      setCollabText("");
      loadCollabMessages(collabId);
    } catch { /* silent */ }
  };

  if (collaborations.length === 0 && !isMember) return null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">🤝 Collaborations</h3>
        {isMember && !isArchived && (
          <button onClick={() => setCreating(!creating)} className="text-[10px] text-cyan-400 hover:text-cyan-300 transition">
            {creating ? "Cancel" : "+ New"}
          </button>
        )}
      </div>

      {creating && (
        <div className="space-y-2 mb-4 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Project title"
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/40"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-1.5 text-xs text-white outline-none resize-none focus:border-cyan-500/40"
            rows={2}
          />
          <button onClick={handleCreate} className="rounded-lg bg-cyan-500 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-400 transition">
            Create
          </button>
        </div>
      )}

      {collaborations.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-4">No collaboration rooms yet</p>
      ) : (
        <div className="space-y-2">
          {collaborations.map(collab => {
            const isInCollab = (collab.members || []).some(m => {
              const token = localStorage.getItem("token");
              try {
                if (!token) return false;
                const payload = JSON.parse(atob(token.split(".")[1]));
                return String(m._id || m) === payload.id;
              } catch { return false; }
            });

            return (
              <div key={collab.publicId || collab._id} className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <button
                  onClick={() => setActiveCollab(activeCollab === collab.publicId ? null : collab.publicId)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/[0.02] transition"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-white truncate">{collab.projectTitle}</p>
                    <p className="text-[10px] text-gray-500">{collab.members?.length || 0} members</p>
                  </div>
                  {!isInCollab && isMember && !isArchived && (
                    <button onClick={(e) => { e.stopPropagation(); handleJoin(collab.publicId); }} className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-400 hover:bg-cyan-500/30 ml-2">
                      Join
                    </button>
                  )}
                </button>

                {activeCollab === collab.publicId && (
                  <div className="border-t border-white/[0.06]">
                    {collab.description && (
                      <p className="px-3 py-1.5 text-[10px] text-gray-400">{collab.description}</p>
                    )}

                    {/* Messages */}
                    <div className="max-h-40 overflow-y-auto px-3 py-1 space-y-1">
                      {collabMessages.length === 0 ? (
                        <p className="text-[10px] text-gray-600 text-center py-2">No messages yet</p>
                      ) : (
                        collabMessages.map((msg, i) => (
                          <div key={i} className="text-[10px]">
                            <span className="font-medium text-gray-300">{msg.sender?.name || "Unknown"}: </span>
                            <span className="text-gray-500">{msg.text}</span>
                          </div>
                        ))
                      )}
                    </div>

                    {isInCollab && !isArchived && (
                      <div className="flex items-center gap-1 p-2 border-t border-white/[0.06]">
                        <input
                          value={collabText}
                          onChange={(e) => setCollabText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(collab.publicId); } }}
                          placeholder="Type a message..."
                          className="flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1 text-[10px] text-white outline-none focus:border-cyan-500/40"
                        />
                        <button onClick={() => handleSendMessage(collab.publicId)} className="text-[10px] text-cyan-400 hover:text-cyan-300 px-1">Send</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CollaborationRooms;
