import { useState, useEffect, useCallback, useRef } from "react";
import {
  sendTaskChatMessage,
  getTaskChatMessages,
  uploadMultipleTaskFiles,
  getCommunityStats,
} from "../../../../shared/services/api";

function TaskDetailModal({ task: initialTask, communityId, onClose, onRefresh }) {
  const [task, setTask] = useState(initialTask);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState(null);
  const [sendingChat, setSendingChat] = useState(false);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  const currentUserId = (() => {
    try {
      const t = localStorage.getItem("token");
      if (!t) return null;
      return JSON.parse(atob(t.split(".")[1])).id;
    } catch { return null; }
  })();

  const loadChat = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getTaskChatMessages(task._id, token);
      if (data?.chatMessages) setChatMessages(data.chatMessages);
    } catch {}
  }, [task._id]);

  const loadStats = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getCommunityStats(communityId, token);
      if (data) setStats(data);
    } catch {}
  }, [communityId]);

  useEffect(() => { loadChat(); }, [loadChat]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const handleSendChat = async () => {
    const trimmed = chatText.trim();
    if (!trimmed) return;
    setSendingChat(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await sendTaskChatMessage(task._id, trimmed, token);
      if (data?.chatMessages) setChatMessages(data.chatMessages);
      setChatText("");
      onRefresh?.();
    } catch {} finally { setSendingChat(false); }
  };

  const handleUploadFiles = async (files) => {
    if (!files?.length) return;
    setUploading(true);
    setProgress(0);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await uploadMultipleTaskFiles(task._id, files, token, setProgress);
      if (data?.files) {
        setTask(prev => ({
          ...prev,
          attachments: [...(prev.attachments || []), ...data.files],
        }));
        onRefresh?.();
      }
    } catch {} finally { setUploading(false); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleUploadFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e) => e.preventDefault();

  const maxFiles = Math.max(stats?.totalTasks || 1, 1);
  const maxSubs = Math.max(stats?.totalSubmissions || 1, 1);

  const formatDur = (d) => new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Left panel - Task info + Upload + Chat */}
        <div className="flex flex-col flex-1 overflow-hidden border-r border-white/[0.06]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-black/20">
            <div className="flex items-center gap-4 min-w-0">
              <button onClick={onClose} className="text-gray-500 hover:text-white transition text-lg">✕</button>
              <div>
                <p className="text-sm font-bold text-white truncate">{task.title}</p>
                {task.description && <p className="text-[11px] text-gray-500 truncate">{task.description}</p>}
              </div>
            </div>
            <span className={`rounded-full px-3 py-1 text-[10px] font-bold shrink-0 ${
              task.completed_status
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                : "bg-amber-500/10 border border-amber-500/20 text-amber-300"
            }`}>
              {task.completed_status ? "Completed" : "Pending"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
            {/* Upload Section */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="rounded-xl border-2 border-dashed border-white/[0.08] hover:border-cyan-500/30 bg-white/[0.02] p-6 text-center cursor-pointer transition group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => { handleUploadFiles(e.target.files); e.target.value = ""; }}
                className="hidden"
              />
              <div className="text-2xl mb-2 opacity-40 group-hover:opacity-60 transition">📁</div>
              <p className="text-sm text-gray-400 group-hover:text-gray-300 transition">
                {uploading ? `Uploading... ${progress}%` : "Drop files here or click to upload"}
              </p>
              <p className="text-[10px] text-gray-600 mt-1">Any file type, no size limit</p>
              {uploading && (
                <div className="mt-3 mx-auto max-w-xs h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>

            {/* Attachments list */}
            {task.attachments?.length > 0 && (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">
                  Attachments ({task.attachments.length})
                </p>
                <div className="grid gap-1.5">
                  {task.attachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.04] px-3 py-2">
                      <span className="text-sm">📄</span>
                      <span className="text-xs text-gray-300 truncate flex-1">{att.fileName}</span>
                      <span className="text-[9px] text-gray-600 font-mono">
                        {att.size ? `${(att.size / 1024).toFixed(1)} KB` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chat Section */}
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-semibold">💬 Task Chat</p>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="h-48 overflow-y-auto p-3 space-y-2 scrollbar-thin">
                  {chatMessages.length === 0 && (
                    <p className="text-[10px] text-gray-600 text-center py-4">No messages yet</p>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex items-start gap-2 ${String(msg.user?._id || msg.user) === currentUserId ? "flex-row-reverse" : ""}`}>
                      <div className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-[8px] font-bold ${
                        String(msg.user?._id || msg.user) === currentUserId
                          ? "bg-cyan-500/20 text-cyan-400"
                          : "bg-purple-500/20 text-purple-400"
                      }`}>
                        {(msg.user?.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className={`max-w-[75%] ${String(msg.user?._id || msg.user) === currentUserId ? "items-end" : ""}`}>
                        <div className={`rounded-xl px-3 py-1.5 text-xs ${
                          String(msg.user?._id || msg.user) === currentUserId
                            ? "bg-cyan-500/20 text-cyan-100"
                            : "bg-white/[0.04] text-gray-200"
                        }`}>
                          {msg.message}
                        </div>
                        <p className="text-[9px] text-gray-700 mt-0.5">{formatDur(msg.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="flex gap-2 border-t border-white/[0.06] p-3">
                  <input
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-cyan-500/40"
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={!chatText.trim() || sendingChat}
                    className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 hover:bg-cyan-400 transition"
                  >
                    {sendingChat ? "..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel - Chart */}
        <div className="w-full lg:w-80 shrink-0 overflow-y-auto p-6 scrollbar-thin">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-4 font-semibold">📊 Analytics</p>

          {stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/10 p-3 text-center">
                  <p className="text-lg font-bold text-cyan-400">{stats.totalTasks}</p>
                  <p className="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">Total</p>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/10 p-3 text-center">
                  <p className="text-lg font-bold text-emerald-400">{stats.completedTasks}</p>
                  <p className="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">Done</p>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-purple-500/10 to-violet-500/5 border border-purple-500/10 p-3 text-center">
                  <p className="text-lg font-bold text-purple-400">{stats.totalSubmissions}</p>
                  <p className="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">Subs</p>
                </div>
                <div className="rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/10 p-3 text-center">
                  <p className="text-lg font-bold text-amber-400">{stats.approvedSubmissions}</p>
                  <p className="text-[8px] text-gray-500 uppercase tracking-wider mt-0.5">Approved</p>
                </div>
              </div>

              {/* SVG Bar Chart */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3 font-semibold">Completion Progress</p>
                <div className="relative h-32">
                  <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="taskGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.1" />
                      </linearGradient>
                    </defs>
                    {/* Grid lines */}
                    <line x1="0" y1="80" x2="200" y2="80" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                    <line x1="0" y1="50" x2="200" y2="50" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                    <line x1="0" y1="20" x2="200" y2="20" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                    {/* Bar: Completion rate */}
                    <rect x="20" y={80 - ((stats.completedTasks / maxFiles) * 60)} width="30" height={(stats.completedTasks / maxFiles) * 60} rx="3" fill="url(#taskGrad)" />
                    <text x="35" y="95" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8">Done</text>
                    {/* Bar: Submission rate */}
                    <rect x="70" y={80 - ((stats.totalSubmissions / Math.max(stats.totalSubmissions, 1)) * 50)} width="30" height={(stats.totalSubmissions / Math.max(stats.totalSubmissions, 1)) * 50} rx="3" fill="rgba(167,139,250,0.3)" />
                    <text x="85" y="95" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8">Subs</text>
                    {/* Bar: Approval rate */}
                    <rect x="120" y={80 - ((stats.approvedSubmissions / maxSubs) * 70)} width="30" height={(stats.approvedSubmissions / maxSubs) * 70} rx="3" fill="rgba(52,211,153,0.3)" />
                    <text x="135" y="95" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8">Approved</text>
                    {/* Bar: Members */}
                    <rect x="170" y={80 - ((stats.totalMembers / Math.max(stats.totalMembers, 1)) * 40)} width="20" height={(stats.totalMembers / Math.max(stats.totalMembers, 1)) * 40} rx="3" fill="rgba(245,158,11,0.3)" />
                    <text x="180" y="95" textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="8">Members</text>
                  </svg>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500">
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-2">
                  <p className="text-gray-300 font-semibold">{stats.totalMembers}</p>
                  <p>Members</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-2">
                  <p className="text-gray-300 font-semibold">{stats.totalCollaborations}</p>
                  <p>Collaborations</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-2">
                  <span className={`font-semibold ${stats.status === "active" ? "text-green-400" : "text-red-400"}`}>{stats.status}</span>
                  <p>Status</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] p-2">
                  <p className="text-gray-300 font-semibold">{stats.completionType || "-"}</p>
                  <p>Type</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-8 rounded-lg shimmer-skeleton" />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaskDetailModal;