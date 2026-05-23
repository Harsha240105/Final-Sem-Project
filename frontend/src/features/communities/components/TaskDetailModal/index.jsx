import { useState, useEffect, useCallback, useRef } from "react";
import {
  sendTaskChatMessage,
  getTaskChatMessages,
  uploadMultipleTaskFiles,
} from "../../../../shared/services/api";

function TaskDetailModal({ task: initialTask, communityId, onClose, onRefresh }) {
  const [task, setTask] = useState(initialTask);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sendingChat, setSendingChat] = useState(false);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  const currentUserId = (() => {
    try { const t = localStorage.getItem("token"); if (!t) return null; return JSON.parse(atob(t.split(".")[1])).id; } catch { return null; }
  })();

  const loadChat = useCallback(async () => {
    try {
      const token = localStorage.getItem("token"); if (!token) return;
      const data = await getTaskChatMessages(task._id, token);
      if (data?.chatMessages) setChatMessages(data.chatMessages);
    } catch {}
  }, [task._id]);

  useEffect(() => { loadChat(); }, [loadChat]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const handleSendChat = async () => {
    const trimmed = chatText.trim();
    if (!trimmed) return;
    setSendingChat(true);
    try {
      const token = localStorage.getItem("token"); if (!token) return;
      const data = await sendTaskChatMessage(task._id, trimmed, token);
      if (data?.chatMessages) setChatMessages(data.chatMessages);
      setChatText("");
      onRefresh?.();
    } catch {} finally { setSendingChat(false); }
  };

  const handleUploadFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true); setProgress(0);
    try {
      const token = localStorage.getItem("token"); if (!token) return;
      const data = await uploadMultipleTaskFiles(task._id, files, token, setProgress);
      if (data?.files) {
        setTask(prev => ({ ...prev, attachments: [...(prev.attachments || []), ...data.files] }));
        onRefresh?.();
      }
    } catch {} finally { setUploading(false); }
  };

  const handleDrop = (e) => { e.preventDefault(); handleUploadFiles(e.dataTransfer.files); };
  const handleDragOver = (e) => e.preventDefault();
  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="flex flex-col lg:flex-row w-full max-w-5xl h-[85vh] rounded-2xl border border-white/[0.08] bg-[#0a0a0f] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* ── Left: Task info + Chat ── */}
        <div className="flex flex-col flex-1 min-w-0 border-r border-white/[0.06]">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
            <button onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.06] transition text-sm">✕</button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white truncate">{task.title}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold ${
                  task.completed_status ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20" : "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                }`}>{task.completed_status ? "Completed" : "Pending"}</span>
              </div>
              {task.description && <p className="text-[11px] text-gray-500 truncate mt-0.5">{task.description}</p>}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-thin">
            {/* Upload zone */}
            <div
              onDrop={handleDrop} onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="relative rounded-xl border-2 border-dashed border-white/[0.06] hover:border-cyan-500/30 bg-white/[0.01] p-5 text-center cursor-pointer transition group"
            >
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { handleUploadFiles(e.target.files); e.target.value = ""; }} />
              {uploading ? (
                <div className="space-y-2">
                  <p className="text-sm text-cyan-400">Uploading... {progress}%</p>
                  <div className="mx-auto max-w-xs h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-2xl mb-1.5 opacity-30 group-hover:opacity-50 transition">📁</div>
                  <p className="text-sm text-gray-400 group-hover:text-gray-300 transition">Drop files here or click to upload</p>
                  <p className="text-[9px] text-gray-600 mt-1">Any file type · no size limit · multiple files supported</p>
                </>
              )}
            </div>

            {/* Attachments */}
            {task.attachments?.length > 0 && (
              <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">Attachments ({task.attachments.length})</p>
                <div className="flex flex-wrap gap-1.5">
                  {task.attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-lg bg-white/[0.03] border border-white/[0.04] px-2.5 py-1.5">
                      <span className="text-[11px]">📄</span>
                      <span className="text-[10px] text-gray-300 max-w-[120px] truncate">{att.fileName}</span>
                      {att.size && <span className="text-[8px] text-gray-600 font-mono">{(att.size / 1024).toFixed(0)}KB</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chat */}
            <div>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">💬 Discussion</p>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] overflow-hidden">
                <div className="h-52 overflow-y-auto p-3 space-y-2 scrollbar-thin">
                  {chatMessages.length === 0 && <p className="text-[10px] text-gray-600 text-center py-6">No messages yet. Start the discussion!</p>}
                  {chatMessages.map((msg, i) => {
                    const isMe = String(msg.user?._id || msg.user) === currentUserId;
                    return (
                      <div key={i} className={`flex items-start gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                        <div className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-[8px] font-bold ${
                          isMe ? "bg-cyan-500/15 text-cyan-400" : "bg-purple-500/15 text-purple-400"
                        }`}>{msg.user?.name?.[0] || "?"}</div>
                        <div className={`max-w-[75%] ${isMe ? "items-end" : ""}`}>
                          <div className={`rounded-xl px-3 py-1.5 text-xs leading-relaxed ${
                            isMe ? "bg-cyan-500/15 text-cyan-100 rounded-tr-sm" : "bg-white/[0.04] text-gray-200 rounded-tl-sm"
                          }`}>{msg.message}</div>
                          <p className="text-[8px] text-gray-700 mt-0.5">{formatTime(msg.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
                <div className="flex gap-2 border-t border-white/[0.06] p-3 bg-white/[0.01]">
                  <input value={chatText} onChange={(e) => setChatText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }} placeholder="Type a message..." className="flex-1 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-cyan-500/40" />
                  <button onClick={handleSendChat} disabled={!chatText.trim() || sendingChat} className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-cyan-400 transition">{sendingChat ? "..." : "Send"}</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Analytics sidebar ── */}
        <div className="w-full lg:w-72 shrink-0 overflow-y-auto p-5 scrollbar-thin space-y-4">
          <p className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">📊 Analytics</p>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/10 p-2.5 text-center">
              <p className="text-lg font-bold text-cyan-400">—</p>
              <p className="text-[7px] text-gray-500 uppercase tracking-wider mt-0.5">Total Tasks</p>
            </div>
            <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-2.5 text-center">
              <p className="text-lg font-bold text-emerald-400">—</p>
              <p className="text-[7px] text-gray-500 uppercase tracking-wider mt-0.5">Completed</p>
            </div>
            <div className="rounded-lg bg-purple-500/5 border border-purple-500/10 p-2.5 text-center">
              <p className="text-lg font-bold text-purple-400">—</p>
              <p className="text-[7px] text-gray-500 uppercase tracking-wider mt-0.5">Submissions</p>
            </div>
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/10 p-2.5 text-center">
              <p className="text-lg font-bold text-amber-400">—</p>
              <p className="text-[7px] text-gray-500 uppercase tracking-wider mt-0.5">Members</p>
            </div>
          </div>

          {/* Simple bar chart */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-3.5">
            <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-3 font-semibold">Progress</p>
            <div className="flex items-end justify-around h-24">
              {[
                { label: "Done", color: "#22d3ee", value: task.completed_status ? 80 : 20 },
                { label: "Sub", color: "#a78bfa", value: 40 },
                { label: "Files", color: "#34d399", value: task.attachments?.length ? Math.min(task.attachments.length * 15, 100) : 10 },
              ].map((bar, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="w-10 rounded-md transition-all duration-500" style={{ height: `${bar.value}%`, backgroundColor: bar.color, opacity: 0.4 }} />
                  <span className="text-[7px] text-gray-600 uppercase">{bar.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Task meta */}
          <div className="space-y-1.5 text-[10px]">
            <div className="flex justify-between rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
              <span className="text-gray-500">Created</span>
              <span className="text-gray-300">{task.createdAt ? new Date(task.createdAt).toLocaleDateString() : "-"}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
              <span className="text-gray-500">Completed</span>
              <span className="text-gray-300">{task.completed_status && task.updatedAt ? new Date(task.updatedAt).toLocaleDateString() : "-"}</span>
            </div>
            <div className="flex justify-between rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
              <span className="text-gray-500">Status</span>
              <span className={`font-semibold ${task.completed_status ? "text-emerald-400" : "text-amber-400"}`}>{task.completed_status ? "Completed" : "Pending"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TaskDetailModal;