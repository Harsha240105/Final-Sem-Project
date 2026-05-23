import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/hooks/useAuth";
import { useToast } from "../../shared/hooks/useToast";
import { useSocket } from "../../shared/services/SocketContext";
import {
  getTasksByCommunity,
  createTask,
  joinCommunity as apiJoin,
  leaveCommunity as apiLeave,
  sendCommunityMessage as apiSendMessage,
  sendCommunityVoiceMessage as apiSendVoiceMessage,
  deleteCommunity as apiDeleteCommunity,
} from "../../shared/services/api";
import VoiceRecorder from "../messaging/components/VoiceRecorder";
import { useCommunity } from "./hooks/useCommunity";
import { formatTime, getInitials } from "./utils";
import CommunityHeader from "./components/CommunityHeader";
import CommunityRules from "./components/CommunityRules";
import TaskBoard from "./components/TaskBoard";
import TaskStats from "./components/TaskStats";
import CertificateIssuance from "./components/CertificateIssuance";
import SubmissionPanel from "./components/SubmissionPanel";
import CollaborationRooms from "./components/CollaborationRooms";
import MemberManagement from "./components/MemberManagement";
import ArchiveView from "./components/ArchiveView";
import CommunityTimeline from "./components/CommunityTimeline";
import CompletionControls from "./components/CompletionControls";
import ResourceLibrary from "./components/ResourceLibrary";

function CommunityView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { socket } = useSocket();
  const { community, loading, error, fetch, isAdmin, isMember, isArchived, setCommunity } = useCommunity(id);

  const [tasks, setTasks] = useState([]);
  const [activeSection, setActiveSection] = useState("overview");
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskFiles, setTaskFiles] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [msgText, setMsgText] = useState("");
  const [showVoice, setShowVoice] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getTasksByCommunity(id, token);
      setTasks(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  }, [id]);

  useEffect(() => { if (id) loadTasks(); }, [id, loadTasks]);

  // Socket listener for community updates
  useEffect(() => {
    if (!socket || !id) return;
    socket.emit("join_community", { communityId: id });
    const handler = () => fetch();
    const archiveHandler = ({ communityId }) => {
      if (communityId === id) { fetch(); addToast("Community has been archived", "info"); }
    };
    socket.on("community_updated", handler);
    socket.on("community_archived", archiveHandler);
    return () => {
      socket.emit("leave_community", { communityId: id });
      socket.off("community_updated", handler);
      socket.off("community_archived", archiveHandler);
    };
  }, [socket, id, fetch, addToast]);

  const handleJoin = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await apiJoin(id, token);
      addToast("Joined community", "success");
      fetch();
    } catch { addToast("Failed to join", "error"); }
  };

  const handleLeave = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await apiLeave(id, token);
      addToast("Left community", "success");
      navigate("/communities");
    } catch { addToast("Failed to leave", "error"); }
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const formData = new FormData();
      formData.append("title", taskTitle.trim());
      formData.append("description", taskDesc.trim());
      formData.append("community_id", id);
      taskFiles.forEach(f => formData.append("attachments", f));
      await createTask(formData, token);
      addToast("Task created", "success");
      setTaskTitle(""); setTaskDesc(""); setTaskFiles([]);
      setShowCreateTask(false);
      loadTasks();
    } catch { addToast("Failed to create task", "error"); }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const response = await fetch(
        `${(window.__API_BASE_URL__ || "http://localhost:5001/api").replace(/\/api\/?$/, "")}/api/communities/${id}/comment`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ text: commentText.trim() }),
        }
      );
      if (response.ok) { setCommentText(""); fetch(); }
    } catch { /* silent */ }
  };

  const handleSendMessage = async () => {
    if (!msgText.trim()) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await apiSendMessage(id, msgText.trim(), token);
      setMsgText("");
      fetch();
    } catch { /* silent */ }
  };

  const handleSendVoiceMessage = async (blob, duration) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await apiSendVoiceMessage(id, blob, duration, token);
      setShowVoice(false);
      fetch();
    } catch { /* silent */ }
  };

  const handleUpdateRules = async (rules) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await fetch(
        `${(window.__API_BASE_URL__ || "http://localhost:5001/api").replace(/\/api\/?$/, "")}/api/communities/${id}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ rules }),
        }
      );
      addToast("Rules updated", "success");
      fetch();
    } catch { addToast("Failed to update", "error"); }
  };

  const handleRemoveMember = async (memberId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await fetch(
        `${(window.__API_BASE_URL__ || "http://localhost:5001/api").replace(/\/api\/?$/, "")}/api/communities/${id}/members/${memberId}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      addToast("Member removed", "success");
      fetch();
    } catch { addToast("Failed to remove", "error"); }
  };

  const pendingTask = tasks.find(t => !t.completed_status);
  const completedTaskCount = tasks.filter(t => t.completed_status).length;

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl shimmer-skeleton" />)}
      </div>
    );
  }

  if (error || !community) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 text-center">
        <div className="text-4xl mb-4 opacity-30">🏛️</div>
        <p className="text-lg font-bold text-white">Community not found</p>
        <p className="text-sm text-gray-500 mt-1">{error || "This community doesn't exist or you don't have access"}</p>
        <button onClick={() => navigate("/communities")} className="mt-4 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-400 transition">
          Browse Communities
        </button>
      </div>
    );
  }

  const SECTIONS = [
    { id: "overview", label: "Overview", icon: "📋" },
    { id: "tasks", label: `Tasks (${tasks.length})`, icon: "✅" },
    { id: "stats", label: "Stats", icon: "📊" },
    { id: "collaborations", label: `Collab (${community.collaborations?.length || 0})`, icon: "🤝" },
    { id: "resources", label: `Resources (${community.resources?.length || 0})`, icon: "📚" },
    { id: "members", label: `Members (${community.members?.length || 0})`, icon: "👥" },
    { id: "activity", label: "Activity", icon: "📜" },
    ...(isAdmin ? [{ id: "manage", label: "Manage", icon: "⚙️" }] : []),
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
      <CommunityHeader
        community={community}
        isAdmin={isAdmin}
        isMember={isMember}
        onJoin={handleJoin}
        onLeave={handleLeave}
        onEdit={() => navigate(`/communities/${id}/edit`)}
      />

      {/* Section Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-1 border-b border-white/[0.06]">
        {SECTIONS.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-medium whitespace-nowrap transition ${
              activeSection === s.id
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                : "text-gray-500 hover:text-white border border-transparent"
            }`}
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Archive Banner */}
      <ArchiveView community={community} />

      {/* Overview Section */}
      {activeSection === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
              <p className="text-2xl font-bold text-white">{tasks.length}</p>
              <p className="text-[10px] text-gray-500 mt-1">Total Tasks</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">{completedTaskCount}</p>
              <p className="text-[10px] text-gray-500 mt-1">Completed</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
              <p className="text-2xl font-bold text-white">{community.members?.length || 0}</p>
              <p className="text-[10px] text-gray-500 mt-1">Members</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
              <p className="text-2xl font-bold text-white">{community.collaborations?.length || 0}</p>
              <p className="text-[10px] text-gray-500 mt-1">Collaborations</p>
            </div>
          </div>

          <CommunityRules rules={community.rules} isAdmin={isAdmin} onSave={handleUpdateRules} />

          {/* Community Chat */}
          {!isArchived && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <h3 className="text-sm font-semibold text-white mb-3">💬 Community Chat</h3>
              <div className="max-h-48 overflow-y-auto space-y-1 mb-3 scrollbar-thin">
                {(community.communityMessages || []).slice(-20).map((msg, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="font-medium text-gray-300 shrink-0">{msg.sender?.name || "Unknown"}:</span>
                    {msg.messageType === "voice" && msg.audioUrl ? (
                      <div className="flex items-center gap-2">
                        <audio src={msg.audioUrl.startsWith("http") ? msg.audioUrl : `http://localhost:5001${msg.audioUrl}`} controls className="h-7 max-w-[150px]" preload="none" />
                        {msg.audioDuration ? <span className="text-[9px] text-gray-500 font-mono">{Math.floor(msg.audioDuration / 60)}:{String(msg.audioDuration % 60).padStart(2, "0")}</span> : null}
                      </div>
                    ) : (
                      <span className="text-gray-500">{msg.text}</span>
                    )}
                    <span className="text-[9px] text-gray-700 shrink-0 ml-auto">{formatTime(msg.createdAt)}</span>
                  </div>
                ))}
                {(!community.communityMessages || community.communityMessages.length === 0) && (
                  <p className="text-[10px] text-gray-600 text-center py-2">No messages yet</p>
                )}
              </div>
              {isMember && (
                <>
                  {showVoice ? (
                    <VoiceRecorder onSend={handleSendVoiceMessage} onCancel={() => setShowVoice(false)} />
                  ) : (
                    <div className="flex gap-2">
                      <input
                        value={msgText}
                        onChange={(e) => setMsgText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                        placeholder="Type a message..."
                        className="flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/40"
                      />
                      <button
                        onClick={() => setShowVoice(true)}
                        className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/[0.08] transition"
                        title="Voice message"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z" />
                          <path d="M17 11a1 1 0 0 0-2 0 3 3 0 0 1-6 0 1 1 0 0 0-2 0 5 5 0 0 0 4 4.9V18H8a1 1 0 0 0 0 2h8a1 1 0 0 0 0-2h-3v-2.1a5 5 0 0 0 4-4.9z" />
                        </svg>
                      </button>
                      <button onClick={handleSendMessage} disabled={!msgText.trim()} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-cyan-400 transition">Send</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Comments */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-sm font-semibold text-white mb-3">💭 Comments</h3>
            <div className="space-y-2 mb-3 max-h-48 overflow-y-auto scrollbar-thin">
              {(community.comments || []).slice(-20).map((c, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <div className="h-5 w-5 shrink-0 rounded-full bg-cyan-500/20 flex items-center justify-center text-[8px] font-bold text-white">
                    {getInitials(c.user?.name)}
                  </div>
                  <div>
                    <p><span className="font-medium text-gray-300">{c.user?.name || "Unknown"}</span> <span className="text-gray-500">{c.text}</span></p>
                    <p className="text-[9px] text-gray-700">{formatTime(c.createdAt)}</p>
                  </div>
                </div>
              ))}
              {(!community.comments || community.comments.length === 0) && (
                <p className="text-[10px] text-gray-600 text-center py-2">No comments yet</p>
              )}
            </div>
            {isMember && !isArchived && (
              <div className="flex gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                  placeholder="Add a comment..."
                  className="flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/40"
                />
                <button onClick={handleAddComment} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-400 transition">Post</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tasks Section */}
      {activeSection === "tasks" && (
        <div className="space-y-4">
          {isAdmin && !isArchived && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreateTask(!showCreateTask)}
                className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-400 transition"
              >
                {showCreateTask ? "Cancel" : "+ Create Task"}
              </button>
            </div>
          )}

          {showCreateTask && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
              <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Task title *" className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40" />
              <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Description" className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none resize-none focus:border-cyan-500/40" rows={3} />
              <input type="file" multiple onChange={(e) => setTaskFiles(Array.from(e.target.files))} className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-cyan-500/10 file:text-cyan-400" />
              <div className="flex gap-2">
                <button onClick={handleCreateTask} className="rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-cyan-400 transition">Create</button>
                <button onClick={() => { setShowCreateTask(false); setTaskTitle(""); setTaskDesc(""); setTaskFiles([]); }} className="rounded-lg border border-white/[0.08] px-4 py-1.5 text-xs text-gray-400 hover:text-white transition">Cancel</button>
              </div>
            </div>
          )}

          <TaskBoard tasks={tasks} communityId={id} isAdmin={isAdmin} isArchived={isArchived} onRefresh={loadTasks} />

          {/* Teacher: Issue certificates per task */}
          {isAdmin && !isArchived && tasks.length > 0 && (
            <CertificateIssuance tasks={tasks} communityId={id} onRefresh={loadTasks} />
          )}

          {/* Submissions per task */}
          {tasks.map(task => (
            <SubmissionPanel key={task._id} task={task} communityId={id} isAdmin={isAdmin} isArchived={isArchived} />
          ))}
        </div>
      )}

      {/* Stats Section */}
      {activeSection === "stats" && (
        <TaskStats communityId={id} />
      )}

      {/* Collaborations Section */}
      {activeSection === "collaborations" && (
        <CollaborationRooms community={community} isMember={isMember} isArchived={isArchived} onRefresh={fetch} />
      )}

      {/* Resources Section */}
      {activeSection === "resources" && (
        <ResourceLibrary resources={community.resources || []} communityId={id} isAdmin={isAdmin} isArchived={isArchived} onRefresh={fetch} />
      )}

      {/* Members Section */}
      {activeSection === "members" && (
        <MemberManagement members={community.members || []} isAdmin={isAdmin} isArchived={isArchived} onRemove={handleRemoveMember} />
      )}

      {/* Activity Timeline */}
      {activeSection === "activity" && (
        <CommunityTimeline communityId={id} />
      )}

      {/* Manage Section (Admin only) */}
      {activeSection === "manage" && isAdmin && (
        <div className="space-y-4">
          <CompletionControls community={community} onRefresh={fetch} />
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <h3 className="text-sm font-semibold text-white mb-3">🏛️ Community Settings</h3>
            <p className="text-[10px] text-gray-500 mb-3">Community ID: {community.publicId || community._id}</p>
            <button
              onClick={async () => {
                try {
                  const token = localStorage.getItem("token");
                  if (!token) return;
                  await apiDeleteCommunity(id, token);
                  addToast("Community deleted", "success");
                  navigate("/communities");
                } catch { addToast("Failed to delete", "error"); }
              }}
              className="rounded-lg border border-red-500/20 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10 transition"
            >
              Delete Community
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunityView;
