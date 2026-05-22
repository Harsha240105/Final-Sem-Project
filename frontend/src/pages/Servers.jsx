import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../hooks/useToast";
import { useWebRTC } from "../hooks/useWebRTC";
import {
  API_BASE_URL as API_URL,
  getServers, discoverServers, getServer, createServer,
  joinServer, joinServerByCode, leaveServer, deleteServer, addChannel,
  getServerMessages, sendServerMessage, deleteServerMessage,
  getUserStats,
} from "../services/api";
import {
  Hash, Volume2, Radio, Megaphone, Plus, Search, Settings,
  Mic, MicOff, Headphones, HeadphoneOff, Video, VideoOff, MonitorUp, Monitor, PhoneOff,
  Send, SmilePlus, Users, UserPlus, LogOut, X, ChevronDown, ChevronRight,
  MoreHorizontal, MessageSquare, Bell, Shield, Crown, BookOpen,
  Upload, Image, AtSign, Pin, Inbox, Wifi, Maximize2, Minimize2,
} from "lucide-react";
import FollowButton from "../components/FollowButton";

const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

const TEMPLATES = [
  { id: "teacher", name: "Teacher Classroom", icon: "👨‍🏫", preset: "Teacher Classroom",
    description: "Announcements, assignments, live classes & doubt-solving",
    gradient: "from-blue-600/25 to-cyan-600/15", border: "border-blue-500/30",
    channels: [{ name: "announcements", type: "announcements" }, { name: "assignments", type: "text" }, { name: "lectures", type: "text" }, { name: "q-and-a", type: "text" }, { name: "Classroom", type: "stage" }, { name: "Office Hours", type: "voice" }] },
  { id: "study", name: "Study Group", icon: "📚", preset: "Study Group",
    description: "Collaborate on projects, share resources & discuss",
    gradient: "from-green-600/25 to-emerald-600/15", border: "border-green-500/30",
    channels: [{ name: "general", type: "text" }, { name: "resources", type: "text" }, { name: "assignments", type: "text" }, { name: "questions", type: "text" }, { name: "Study Room", type: "voice" }, { name: "Group Discussion", type: "voice" }] },
  { id: "coding", name: "Coding Club", icon: "💻", preset: "Coding Club",
    description: "Code reviews, project collaboration & tech talks",
    gradient: "from-purple-600/25 to-pink-600/15", border: "border-purple-500/30",
    channels: [{ name: "general", type: "text" }, { name: "code-reviews", type: "text" }, { name: "projects", type: "text" }, { name: "help", type: "text" }, { name: "Code Together", type: "voice" }, { name: "Tech Talks", type: "stage" }] },
  { id: "hackathon", name: "Hackathon", icon: "🚀", preset: "Hackathon Team",
    description: "Build, pitch & win — team space for hackathons",
    gradient: "from-orange-600/25 to-yellow-600/15", border: "border-orange-500/30",
    channels: [{ name: "updates", type: "announcements" }, { name: "ideas", type: "text" }, { name: "dev-chat", type: "text" }, { name: "War Room", type: "voice" }, { name: "Pitch Practice", type: "stage" }] },
  { id: "workshop", name: "Workshop Hub", icon: "🔧", preset: "Workshop Hub",
    description: "Materials, recordings & interactive sessions",
    gradient: "from-teal-600/25 to-cyan-600/15", border: "border-teal-500/30",
    channels: [{ name: "general", type: "text" }, { name: "materials", type: "text" }, { name: "feedback", type: "text" }, { name: "Workshop", type: "stage" }, { name: "Discussion Room", type: "voice" }] },
  { id: "nft", name: "NFT Community", icon: "🪙", preset: "NFT/Web3 Club",
    description: "Web3, NFT trading & blockchain projects",
    gradient: "from-indigo-600/25 to-violet-600/15", border: "border-indigo-500/30",
    channels: [{ name: "general", type: "text" }, { name: "trading", type: "text" }, { name: "projects", type: "text" }, { name: "alpha", type: "text" }, { name: "Voice Chat", type: "voice" }, { name: "AMAs", type: "stage" }] },
  { id: "gaming", name: "Gaming Lounge", icon: "🎮", preset: "Gaming Club",
    description: "Game nights, LFG & tournament voice",
    gradient: "from-red-600/25 to-rose-600/15", border: "border-red-500/30",
    channels: [{ name: "general", type: "text" }, { name: "looking-for-group", type: "text" }, { name: "clips", type: "text" }, { name: "Game Chat", type: "voice" }, { name: "Tournament", type: "stage" }] },
  { id: "personal", name: "Personal Space", icon: "👤", preset: "Personal Friends Group",
    description: "Private hangout for you and your friends",
    gradient: "from-gray-600/25 to-slate-600/15", border: "border-gray-500/30",
    channels: [{ name: "general", type: "text" }, { name: "Hangout", type: "voice" }] },
];

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function resolveAvatar(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

function formatTime(date) {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const channelIcon = { text: Hash, voice: Volume2, stage: Radio, announcements: Megaphone };
const channelColor = { text: "text-cyan-400", voice: "text-green-400", stage: "text-purple-400", announcements: "text-yellow-400" };
const channelBg = { text: "bg-cyan-500/10", voice: "bg-green-500/10", stage: "bg-purple-500/10", announcements: "bg-yellow-500/10" };

function getMemberGroups(members = [], moderators = [], ownerId, onlineUsers) {
  const modIds = new Set((moderators || []).map((m) => m._id || m));
  const groups = { owner: [], moderators: [], teachers: [], students: [] };
  (members || []).forEach((member) => {
    const mid = member._id || member;
    if (!mid) return;
    const isOnline = onlineUsers.has(mid);
    const display = typeof member === "object" ? member : { _id: mid, name: "User" };
    const entry = { ...display, _id: mid, isOnline };
    if (mid === ownerId) groups.owner.push(entry);
    else if (modIds.has(mid)) groups.moderators.push(entry);
    else if (display.role === "teacher") groups.teachers.push(entry);
    else groups.students.push(entry);
  });
  return groups;
}

const REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉", "🚀", "👀", "💯"];

function QualityDot({ quality }) {
  const color = quality === "connected" ? "bg-green-400" : quality === "checking" ? "bg-yellow-400" : "bg-red-400";
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} />;
}

function VoiceRoom({
  channelName,
  localStream,
  screenStream,
  remoteStreams,
  screenShareStreams,
  participants,
  cameraEnabled,
  screenSharing,
  speakingUsers,
  voiceMuted,
  voiceDeafened,
  connectionQuality,
  userId,
  userName,
  onMute,
  onDeafen,
  onDisconnect,
  onToggleCamera,
  onToggleScreenShare,
}) {
  const localVideoRef = useRef(null);
  const localScreenRef = useRef(null);
  const remoteScreenRef = useRef(null);
  const fullscreenRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (localScreenRef.current && screenStream) {
      localScreenRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  useEffect(() => {
    if (remoteScreenRef.current && screenShareStreams) {
      const entries = Object.values(screenShareStreams);
      if (entries.length > 0) {
        remoteScreenRef.current.srcObject = entries[0];
      }
    }
  }, [screenShareStreams]);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      fullscreenRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const hasScreenShare = Object.keys(screenShareStreams).length > 0 || screenSharing;
  const isSpeaking = (pid) => speakingUsers.has(pid);

  return (
    <div className="flex-1 flex flex-col bg-[#0a0d1a]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-[#0e1122] min-h-[48px]">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-green-500/15 flex items-center justify-center">
            <Volume2 className="w-3.5 h-3.5 text-green-400" />
          </div>
          <span className="text-sm font-bold text-white">{channelName}</span>
          <span className="text-[10px] text-gray-500">— {participants.length} connected</span>
        </div>
        {hasScreenShare && (
          <button onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition">
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto" ref={fullscreenRef}>
        {hasScreenShare ? (
          <>
            <div className="flex-1 relative rounded-2xl overflow-hidden bg-black/40 border border-white/[0.06] min-h-[300px]">
              {screenSharing && screenStream ? (
                <video ref={localScreenRef} autoPlay playsInline muted
                  className="w-full h-full object-contain" />
              ) : Object.keys(screenShareStreams).length > 0 ? (
                <video ref={remoteScreenRef} autoPlay playsInline muted
                  className="w-full h-full object-contain" />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm gap-2">
                  <MonitorUp className="w-6 h-6" />
                  Waiting for screen share...
                </div>
              )}
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-red-500/80 text-white text-[10px] font-bold flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                Screen Share
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
              <ParticipantCard
                pid="me"
                name={userName || "You"}
                stream={localStream}
                hasVideo={cameraEnabled}
                isMuted={voiceMuted}
                isDeafened={voiceDeafened}
                isLocal
                isSpeaking={isSpeaking("me")}
                quality={connectionQuality["me"]}
              />
              {participants.filter((p) => p.userId !== userId).map((p) => (
                <ParticipantCard
                  key={p.userId}
                  pid={p.userId}
                  name={p.userName}
                  stream={remoteStreams[p.userId]}
                  hasVideo={!!remoteStreams[p.userId]}
                  isSpeaking={isSpeaking(p.userId)}
                  quality={connectionQuality[p.userId]}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-4xl w-full auto-rows-fr">
              <ParticipantCard
                pid="me"
                name={userName || "You"}
                stream={localStream}
                hasVideo={cameraEnabled}
                isMuted={voiceMuted}
                isDeafened={voiceDeafened}
                isLocal
                isSpeaking={isSpeaking("me")}
                quality={connectionQuality["me"]}
              />
              {participants.filter((p) => p.userId !== userId).map((p) => (
                <ParticipantCard
                  key={p.userId}
                  pid={p.userId}
                  name={p.userName}
                  stream={remoteStreams[p.userId]}
                  hasVideo={!!remoteStreams[p.userId]}
                  isSpeaking={isSpeaking(p.userId)}
                  quality={connectionQuality[p.userId]}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.06] px-4 py-3 bg-[#0e1122]">
        <div className="flex items-center justify-center gap-3">
          <button onClick={onMute}
            className={`p-2.5 rounded-xl transition-all ${
              voiceMuted
                ? "bg-red-500/20 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)] ring-1 ring-red-500/30"
                : "bg-[#1a1d2e] text-gray-300 hover:bg-white/[0.08] hover:text-white"
            }`}>
            {voiceMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button onClick={onDeafen}
            className={`p-2.5 rounded-xl transition-all ${
              voiceDeafened
                ? "bg-red-500/20 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)] ring-1 ring-red-500/30"
                : "bg-[#1a1d2e] text-gray-300 hover:bg-white/[0.08] hover:text-white"
            }`}>
            {voiceDeafened ? <HeadphoneOff className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
          </button>
          <button onClick={onToggleCamera}
            className={`p-2.5 rounded-xl transition-all ${
              cameraEnabled
                ? "bg-green-500/15 text-green-400 shadow-[0_0_12px_rgba(74,222,128,0.15)] ring-1 ring-green-500/30"
                : "bg-[#1a1d2e] text-gray-300 hover:bg-white/[0.08] hover:text-white"
            }`}>
            {cameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
          </button>
          <button onClick={onToggleScreenShare}
            className={`p-2.5 rounded-xl transition-all ${
              screenSharing
                ? "bg-green-500/15 text-green-400 shadow-[0_0_12px_rgba(74,222,128,0.15)] ring-1 ring-green-500/30"
                : "bg-[#1a1d2e] text-gray-300 hover:bg-white/[0.08] hover:text-white"
            }`}>
            {screenSharing ? <Monitor className="w-4 h-4" /> : <MonitorUp className="w-4 h-4" />}
          </button>
          <div className="w-px h-8 bg-white/[0.06]" />
          <button onClick={onDisconnect}
            className="p-2.5 rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:shadow-[0_0_12px_rgba(239,68,68,0.2)] transition-all">
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ParticipantCard({ pid, name, stream, hasVideo, isSpeaking: speaking, quality, isLocal, isMuted, isDeafened }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasGlow = speaking;
  const qualityColor = quality === "connected" ? "bg-green-400" : quality === "checking" ? "bg-yellow-400" : "bg-gray-500";

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`relative rounded-2xl overflow-hidden bg-[#121530] border transition-all duration-300 group ${
        hasGlow
          ? "border-green-400/50 shadow-[0_0_30px_rgba(74,222,128,0.3)]"
          : "border-white/[0.04] hover:border-white/[0.08]"
      }`}
    >
      {stream && hasVideo ? (
        <video ref={videoRef} autoPlay playsInline muted={isLocal}
          className="w-full aspect-video object-cover" />
      ) : (
        <div className="w-full aspect-video flex items-center justify-center bg-gradient-to-br from-cyan-500/10 to-purple-500/10">
          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40 flex items-center justify-center text-sm font-bold text-white">
            {getInitials(name)}
          </div>
        </div>
      )}

      {hasGlow && (
        <motion.div
          className="absolute inset-0 rounded-2xl border-2 border-green-400/30 pointer-events-none"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-6">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white truncate">{name}</span>
          {isLocal && <span className="text-[8px] text-cyan-400 font-medium px-1 rounded bg-cyan-500/20">You</span>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={`h-1.5 w-1.5 rounded-full ${qualityColor}`} />
          <span className="text-[9px] text-gray-400">
            {isMuted ? "Muted" : isDeafened ? "Deafened" : speaking ? "Speaking" : "Connected"}
          </span>
          {(isMuted || isDeafened) && (
            <span className="ml-auto">
              {isMuted ? <MicOff className="w-2.5 h-2.5 text-red-400" /> : <HeadphoneOff className="w-2.5 h-2.5 text-orange-400" />}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Servers() {
  const { id: routeServerId } = useParams();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { socket, onlineUsers } = useSocket();
  const navigate = useNavigate();

  const [servers, setServers] = useState([]);
  const [discoverable, setDiscoverable] = useState([]);
  const [activeServer, setActiveServer] = useState(null);
  const [activeChannel, setActiveChannel] = useState("general");
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [createForm, setCreateForm] = useState({ name: "", description: "", isPublic: true });
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [joiningByCode, setJoiningByCode] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState("text");
  const [addingChannel, setAddingChannel] = useState(false);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [voiceChannelName, setVoiceChannelName] = useState(null);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceDeafened, setVoiceDeafened] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [reactions, setReactions] = useState({});
  const [profileMember, setProfileMember] = useState(null);
  const [memberStats, setMemberStats] = useState(null);
  const messagesEndRef = useRef(null);
  const iconInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const webRTC = useWebRTC({
    serverId: activeServer?._id,
    channel: voiceChannelName,
    enabled: voiceConnected,
  });

  const voiceParticipants = useMemo(() => {
    if (!voiceConnected || !activeServer?.members) return [];
    const members = activeServer.members.filter((m) => onlineUsers.has(m._id || m)).slice(0, 4);
    return [
      { _id: "me", name: user?.name || "You", avatar: null, isSpeaking: true, muted: voiceMuted, deafened: voiceDeafened },
      ...members.map((m, i) => ({
        _id: m._id || `p${i}`,
        name: m.name || "User",
        avatar: m.avatar,
        isSpeaking: i === 0,
        muted: i === 1,
        deafened: false,
      })),
    ];
  }, [voiceConnected, activeServer?.members, onlineUsers, user?.name, voiceMuted, voiceDeafened]);

  const fetchServers = useCallback(async () => {
    try {
      const token = localStorage.getItem("token"); if (!token) return;
      const data = await getServers(token); setServers(data?.servers || []);
    } catch { /* silent */ }
  }, []);

  const fetchDiscoverable = useCallback(async () => {
    try {
      const token = localStorage.getItem("token"); if (!token) return;
      const data = await discoverServers(token); setDiscoverable(data?.servers || []);
    } catch { /* silent */ }
  }, []);

  const fetchServer = useCallback(async (serverId) => {
    try {
      const token = localStorage.getItem("token"); if (!token) return;
      const data = await getServer(serverId, token);
      if (data?.server) { setActiveServer(data.server); if (!data.isMember) navigate("/servers"); }
    } catch { navigate("/servers"); }
  }, [navigate]);

  const fetchMessages = useCallback(async (serverId, channel) => {
    try {
      const token = localStorage.getItem("token"); if (!token) return;
      const data = await getServerMessages(serverId, channel, token);
      setMessages(data?.messages || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { setLoading(true); fetchServers(); fetchDiscoverable(); setLoading(false); }, [fetchServers, fetchDiscoverable]);
  useEffect(() => { if (routeServerId) fetchServer(routeServerId); }, [routeServerId, fetchServer]);
  useEffect(() => { if (activeServer?._id && activeChannel) fetchMessages(activeServer._id, activeChannel); }, [activeServer?._id, activeChannel, fetchMessages]);

  useEffect(() => {
    if (!socket || !activeServer?._id) return;
    socket.emit("join_server", { serverId: activeServer._id });
    socket.emit("join_server_channel", { serverId: activeServer._id, channel: activeChannel });
    return () => {
      socket.emit("leave_server_channel", { serverId: activeServer._id, channel: activeChannel });
      socket.emit("leave_server", { serverId: activeServer._id });
    };
  }, [socket, activeServer?._id, activeChannel]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => { if (msg.server === activeServer?._id && msg.channel === activeChannel) setMessages((prev) => [...prev, msg]); };
    socket.on("server_message", handler);
    return () => socket.off("server_message", handler);
  }, [socket, activeServer?._id, activeChannel]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!profileMember?._id) { setMemberStats(null); return; }
    const token = localStorage.getItem("token");
    if (!token) return;
    getUserStats(profileMember._id, token).then(setMemberStats).catch(() => {});
  }, [profileMember?._id]);

  const handleSelectServer = (serverId) => {
    setActiveChannel("general"); setVoiceConnected(false); setVoiceChannelName(null); navigate(`/servers/${serverId}`);
  };
  const handleSelectChannel = (channel) => { setActiveChannel(channel); };

  const openCreateModal = () => {
    setCreateStep(0); setSelectedTemplate(null); setCreateForm({ name: "", description: "", isPublic: true });
    setIconFile(null); setIconPreview(null); setShowCreate(true);
  };
  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template); setCreateForm((prev) => ({ ...prev, name: template ? template.name : "" }));
  };
  const handleIconChange = (e) => {
    const file = e.target.files?.[0]; if (!file) return; setIconFile(file);
    const reader = new FileReader(); reader.onload = (ev) => setIconPreview(ev.target.result); reader.readAsDataURL(file);
  };

  const handleCreateServer = async (e) => {
    e.preventDefault(); const name = createForm.name.trim(); if (!name) return;
    if (cannotCreate) { addToast("Admins and teachers cannot create servers", "error"); setCreating(false); return; }
    setCreating(true);
    try {
      const token = localStorage.getItem("token"); if (!token) return;
      const payload = { ...createForm, name, preset: selectedTemplate?.preset || "" };
      const data = await createServer(payload, token);
      if (data?.server) {
        setServers((prev) => [...prev, data.server]); setShowCreate(false); setCreateStep(0); setSelectedTemplate(null);
        setCreateForm({ name: "", description: "", isPublic: true }); setIconFile(null); setIconPreview(null);
        addToast("Server created!", "success"); navigate(`/servers/${data.server._id}`);
      }
    } catch (err) { addToast(err?.response?.data?.error || "Failed to create server", "error"); }
    finally { setCreating(false); }
  };

  const handleJoinServer = async (serverId) => {
    try {
      const token = localStorage.getItem("token"); if (!token) return;
      await joinServer(serverId, token); addToast("Joined server!", "success");
      fetchServers(); fetchDiscoverable(); navigate(`/servers/${serverId}`);
    } catch (err) { addToast(err?.response?.data?.error || "Failed to join", "error"); }
  };
  const handleJoinByCode = async () => {
    if (!inviteCode.trim()) return;
    setJoiningByCode(true);
    try {
      const token = localStorage.getItem("token"); if (!token) return;
      const res = await joinServerByCode(inviteCode.trim(), token);
      addToast("Joined server!", "success");
      setInviteCode("");
      fetchServers();
      if (res?.server?._id) navigate(`/servers/${res.server._id}`);
    } catch (err) { addToast(err?.response?.data?.error || "Invalid invite code", "error"); }
    finally { setJoiningByCode(false); }
  };
  const handleLeaveServer = async () => {
    if (!activeServer?._id) return;
    try { const token = localStorage.getItem("token"); if (!token) return; await leaveServer(activeServer._id, token); addToast("Left server", "info"); navigate("/servers"); fetchServers(); }
    catch (err) { addToast(err?.response?.data?.error || "Failed to leave", "error"); }
  };
  const handleDeleteServer = async () => {
    if (!activeServer?._id) return; if (!window.confirm("Delete this server permanently?")) return;
    try { const token = localStorage.getItem("token"); if (!token) return; await deleteServer(activeServer._id, token); addToast("Server deleted", "info"); navigate("/servers"); setServers((prev) => prev.filter((s) => s._id !== activeServer._id)); setActiveServer(null); }
    catch (err) { addToast(err?.response?.data?.error || "Failed to delete", "error"); }
  };

  const handleAddChannel = async (e) => {
    e.preventDefault(); if (!newChannelName.trim() || !activeServer?._id) return; setAddingChannel(true);
    try {
      const token = localStorage.getItem("token"); if (!token) return;
      const data = await addChannel(activeServer._id, { name: newChannelName.trim(), type: newChannelType }, token);
      if (data?.server) { setActiveServer(data.server); setNewChannelName(""); setShowAddChannel(false); addToast("Channel created", "success"); }
    } catch (err) { addToast(err?.response?.data?.error || "Failed to create channel", "error"); }
    finally { setAddingChannel(false); }
  };

  const handleSend = async () => {
    const text = textInput.trim(); if (!text || !activeServer?._id || !activeChannel || sending) return; setSending(true);
    try {
      const token = localStorage.getItem("token"); if (!token) return;
      const data = await sendServerMessage(activeServer._id, activeChannel, { text }, token);
      if (data?.message) setMessages((prev) => [...prev, data.message]); setTextInput("");
    } catch (err) { addToast(err?.response?.data?.error || "Failed to send", "error"); }
    finally { setSending(false); }
  };

  const handleDeleteMsg = async (messageId) => {
    if (!activeServer?._id) return;
    try { const token = localStorage.getItem("token"); if (!token) return; await deleteServerMessage(activeServer._id, messageId, token); setMessages((prev) => prev.filter((m) => m._id !== messageId)); }
    catch { addToast("Failed to delete", "error"); }
  };

  const handleVoiceChannelClick = async (chName) => {
    if (voiceConnected && voiceChannelName === chName) {
      webRTC.leaveVoice();
      setVoiceConnected(false); setVoiceChannelName(null);
    } else {
      setVoiceConnected(true); setVoiceChannelName(chName);
      setTimeout(() => webRTC.joinVoice(), 100);
    }
  };
  const handleVoiceDisconnect = () => {
    webRTC.leaveVoice();
    setVoiceConnected(false); setVoiceChannelName(null); setVoiceMuted(false); setVoiceDeafened(false);
  };

  const handleReaction = (msgId, emoji) => {
    setReactions((prev) => {
      const msgReactions = { ...(prev[msgId] || {}) };
      msgReactions[emoji] = (msgReactions[emoji] || 0) + 1;
      return { ...prev, [msgId]: msgReactions };
    });
  };

  const cannotCreate = ["admin", "teacher"].includes(user?.role);
  const isOwner = activeServer?.owner?._id === user?.id || activeServer?.owner === user?.id;
  const showLanding = !routeServerId;
  const textChannels = activeServer?.channels?.filter((ch) => ch.type === "text" || ch.type === "announcements") || [];
  const voiceChannels = activeServer?.channels?.filter((ch) => ch.type === "voice") || [];
  const stageChannels = activeServer?.channels?.filter((ch) => ch.type === "stage") || [];
  const previewChannels = selectedTemplate?.channels || [{ name: "general", type: "text" }];
  const ownerId = activeServer?.owner?._id || activeServer?.owner;
  const memberGroups = activeServer ? getMemberGroups(activeServer.members, activeServer.moderators, ownerId, onlineUsers) : null;
  const activeChannelObj = activeServer?.channels?.find((c) => c.name === activeChannel);
  const onlineCount = activeServer?.members?.filter((m) => onlineUsers.has(m._id || m)).length || 0;

  const voiceMemIds = new Set(voiceParticipants.map((p) => p._id));

  return (
    <div className="flex h-full w-auto -mx-4 md:-mx-8 overflow-hidden bg-[#0a0d1a]">
      {showLanding ? (
        <div className="flex-1 flex flex-col gap-5 p-6">
            <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">Your Servers</h1>
              <p className="text-xs text-gray-500 mt-0.5">{servers.length} server{servers.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { fetchDiscoverable(); setShowDiscover(true); }}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-gray-300 hover:border-cyan-500/30 hover:text-cyan-400 transition">Explore</button>
              {!cannotCreate && (
                <button onClick={openCreateModal}
                  className="rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition">+ Create</button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)}
              placeholder="Enter invite code..."
              className="flex-1 max-w-xs rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2 text-xs text-white outline-none focus:border-cyan-500/40 transition"
              onKeyDown={(e) => { if (e.key === "Enter" && inviteCode.trim()) handleJoinByCode(); }} />
            <button onClick={handleJoinByCode} disabled={joiningByCode || !inviteCode.trim()}
              className="rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition">Join</button>
          </div>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                <span className="text-xs text-gray-500">Loading servers...</span>
              </div>
            </div>
          ) : servers.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.06] bg-black/20 px-6">
              <span className="text-4xl mb-4 opacity-30">
                <MessageSquare className="w-10 h-10 text-gray-600" />
              </span>
              <p className="text-sm text-gray-500 font-medium">No servers yet</p>
              <p className="text-xs text-gray-600 mt-1">{cannotCreate ? "Join a server to start collaborating" : "Create or join a server to start collaborating"}</p>
              <div className="flex gap-3 mt-5">
                {!cannotCreate && (
                  <button onClick={openCreateModal}
                    className="rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition">Create Server</button>
                )}
                <button onClick={() => { fetchDiscoverable(); setShowDiscover(true); }}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-gray-300 hover:border-cyan-500/30 hover:text-cyan-400 transition">Explore Servers</button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {servers.map((s) => (
                <motion.button key={s._id} onClick={() => handleSelectServer(s._id)}
                  whileHover={{ y: -3 }} className="cyber-card text-left overflow-hidden group">
                  <div className="h-20 bg-gradient-to-br from-cyan-500/15 to-purple-500/10 flex items-center justify-center relative">
                    {s.icon ? <img src={resolveAvatar(s.icon)} alt="" className="h-full w-full object-cover" /> : <span className="text-3xl font-bold text-cyan-400/40">{getInitials(s.name)}</span>}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050816]/80 to-transparent" />
                  </div>
                  <div className="p-3.5">
                    <p className="text-sm font-bold text-white truncate">{s.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{s.description || "No description"}</p>
                    <div className="flex items-center gap-3 mt-2.5">
                      <span className="text-[9px] text-gray-600">{s.members?.length || 0} members</span>
                      <span className="text-[9px] text-gray-600">{s.channels?.length || 0} channels</span>
                      {s.preset && <span className="text-[9px] text-cyan-500/60">{s.preset}</span>}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      ) : !activeServer ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
            <span className="text-xs text-gray-500">Loading server...</span>
          </div>
        </div>
      ) : (
        <>
          {sidebarOpen && <div className="fixed inset-0 z-20 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}
          <button onClick={() => setSidebarOpen(true)}
            className="fixed top-4 left-3 z-30 h-8 w-8 rounded-lg bg-gray-950/80 backdrop-blur border border-white/[0.06] flex items-center justify-center text-white lg:hidden">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
          </button>

          {/* ── SERVER ICONS ── */}
          <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:relative z-30 inset-y-0 left-0 w-[68px] flex-shrink-0 border-r border-white/[0.06] bg-[#0b0e1a] flex flex-col items-center pt-3 pb-2 gap-1 overflow-y-auto scrollbar-thin transition-transform duration-200`}>
            {servers.map((s, idx) => (
              <div key={s._id} className="relative group flex flex-col items-center">
                {idx > 0 && s._id === activeServer?._id && servers[idx - 1]?._id !== activeServer?._id && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-white/[0.06]" />
                )}
                <button onClick={() => { handleSelectServer(s._id); setSidebarOpen(false); }}
                  className={`h-[48px] w-[48px] rounded-2xl transition-all duration-200 flex items-center justify-center text-sm font-bold relative ${
                    s._id === activeServer?._id
                      ? "bg-gradient-to-br from-cyan-500 to-purple-500 text-white rounded-[16px] shadow-[0_0_20px_rgba(0,245,255,0.25)]"
                      : "bg-[#1a1d2e] text-gray-400 hover:bg-cyan-500/20 hover:text-cyan-400 hover:rounded-[16px]"
                  }`}>
                  {s.icon ? <img src={resolveAvatar(s.icon)} alt="" className="h-full w-full rounded-[inherit] object-cover" /> : getInitials(s.name)}
                </button>
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-[#1a1d2e] border border-white/[0.08] text-[11px] text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-50 shadow-xl">
                  {s.name}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-[#1a1d2e]" />
                </div>
                {s._id === activeServer?._id && (
                  <div className="absolute -left-[10px] top-1/2 -translate-y-1/2 w-[3px] h-10 rounded-r-full bg-cyan-400 shadow-[0_0_10px_rgba(0,245,255,0.6)]" />
                )}
              </div>
            ))}
            <div className="w-7 h-px bg-white/[0.06] my-1" />
            {!cannotCreate && (
              <button onClick={() => { openCreateModal(); setSidebarOpen(false); }}
                className="h-[48px] w-[48px] rounded-2xl bg-[#1a1d2e] text-gray-500 hover:bg-green-500/20 hover:text-green-400 transition-all flex items-center justify-center text-xl leading-none hover:rounded-[16px]">
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* ── CHANNEL SIDEBAR ── */}
          <div className={`${sidebarOpen ? "translate-x-[68px]" : "-translate-x-full"} lg:translate-x-0 fixed lg:relative z-20 inset-y-0 left-0 w-60 flex-shrink-0 border-r border-white/[0.06] bg-[#0e1122]/90 flex flex-col transition-transform duration-200`}>
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-3 min-h-[52px] bg-[#0e1122] shadow-[0_1px_0_rgba(255,255,255,0.03)]">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden ring-1 ring-white/[0.06]">
                {activeServer.icon ? <img src={resolveAvatar(activeServer.icon)} alt="" className="h-full w-full object-cover" /> : getInitials(activeServer.name)}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-white truncate leading-tight">{activeServer.name}</h2>
                {activeServer.preset && <p className="text-[9px] text-gray-600 truncate leading-tight">{activeServer.preset}</p>}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-[1px] scrollbar-thin">
              {textChannels.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-2 py-2 mt-1">
                    <div className="flex items-center gap-1.5">
                      <ChevronDown className="w-2.5 h-2.5 text-gray-500" />
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Text Channels</p>
                    </div>
                  </div>
                  {textChannels.map((ch) => {
                    const Icon = channelIcon[ch.type] || Hash;
                    return (
                      <button key={ch._id || ch.name} onClick={() => { handleSelectChannel(ch.name); setSidebarOpen(false); }}
                        className={`relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all text-sm group ${
                          activeChannel === ch.name && !voiceConnected
                            ? "bg-cyan-500/10 text-cyan-300" : "text-[#8e9297] hover:bg-white/[0.04] hover:text-gray-200"
                        }`}>
                        {activeChannel === ch.name && !voiceConnected && (
                          <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-cyan-400 shadow-[0_0_6px_rgba(0,245,255,0.4)]" />
                        )}
                        <Icon className={`w-3.5 h-3.5 ${channelColor[ch.type] || "text-gray-400"}`} />
                        <span className="truncate text-[13px]">{ch.name}</span>
                      </button>
                    );
                  })}
                </>
              )}

              {voiceChannels.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-2 py-2 mt-3">
                    <div className="flex items-center gap-1.5">
                      <ChevronDown className="w-2.5 h-2.5 text-gray-500" />
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Voice Channels</p>
                    </div>
                  </div>
                  {voiceChannels.map((ch) => (
                    <button key={ch._id || ch.name} onClick={() => { handleVoiceChannelClick(ch.name); setSidebarOpen(false); }}
                      className={`relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all text-sm group ${
                        voiceConnected && voiceChannelName === ch.name
                          ? "bg-green-500/10 text-green-300" : "text-[#8e9297] hover:bg-white/[0.04] hover:text-gray-200"
                      }`}>
                      {voiceConnected && voiceChannelName === ch.name && (
                        <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.4)]" />
                      )}
                      <Volume2 className={`w-3.5 h-3.5 ${channelColor.voice}`} />
                      <span className="truncate text-[13px]">{ch.name}</span>
                      <span className="ml-auto flex items-center gap-1">
                        {voiceConnected && voiceChannelName === ch.name && (
                          <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                        )}
                        <span className="text-[9px] text-gray-500">
                          {voiceConnected && voiceChannelName === ch.name ? webRTC.participants.length : 0}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}

              {stageChannels.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-2 py-2 mt-3">
                    <div className="flex items-center gap-1.5">
                      <ChevronDown className="w-2.5 h-2.5 text-gray-500" />
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Stage</p>
                    </div>
                  </div>
                  {stageChannels.map((ch) => (
                    <button key={ch._id || ch.name} onClick={() => setSidebarOpen(false)}
                      className="relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all text-sm text-[#8e9297] hover:bg-white/[0.04] hover:text-gray-200 group">
                      <Radio className="w-3.5 h-3.5 text-purple-400" />
                      <span className="truncate text-[13px]">{ch.name}</span>
                    </button>
                  ))}
                </>
              )}

              {isOwner && (
                <div className="mt-3">
                  {showAddChannel ? (
                    <form onSubmit={handleAddChannel} className="px-2 space-y-1.5">
                      <input value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)}
                        placeholder="channel-name" className="w-full rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs text-white outline-none placeholder:text-gray-600" autoFocus />
                      <div className="relative">
                        <select value={newChannelType} onChange={(e) => setNewChannelType(e.target.value)}
                          className="w-full appearance-none rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-xs text-white outline-none cursor-pointer">
                          <option value="text" className="bg-gray-900">Text</option>
                          <option value="voice" className="bg-gray-900">Voice</option>
                          <option value="stage" className="bg-gray-900">Stage</option>
                          <option value="announcements" className="bg-gray-900">Announcements</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={addingChannel || !newChannelName.trim()} className="text-[10px] text-cyan-400 font-semibold">Add</button>
                        <button type="button" onClick={() => { setShowAddChannel(false); setNewChannelName(""); }} className="text-[10px] text-gray-500">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <button onClick={() => setShowAddChannel(true)}
                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-gray-500 hover:text-cyan-400 hover:bg-white/[0.03] transition">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Channel</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── USER PANEL ── */}
            <div className={`border-t px-3 py-2.5 ${voiceConnected ? "border-green-500/20 bg-green-500/[0.03]" : "border-white/[0.06] bg-[#0e1122]"}`}>
              {voiceConnected ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                        {getInitials(user?.name)}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-[#0e1122]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold text-white truncate block leading-tight">{user?.name}</span>
                      <span className="text-[9px] text-green-400 flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                        {voiceChannelName}
                      </span>
                    </div>
                  </div>
                  <div className="h-px bg-green-500/10" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setVoiceMuted(!voiceMuted)}
                        className={`p-1.5 rounded-md transition ${voiceMuted ? "bg-red-500/20 text-red-400" : "bg-white/[0.04] text-[#8e9297] hover:bg-white/[0.08] hover:text-white"}`}>
                        {voiceMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setVoiceDeafened(!voiceDeafened)}
                        className={`p-1.5 rounded-md transition ${voiceDeafened ? "bg-red-500/20 text-red-400" : "bg-white/[0.04] text-[#8e9297] hover:bg-white/[0.08] hover:text-white"}`}>
                        {voiceDeafened ? <HeadphoneOff className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <button onClick={handleVoiceDisconnect} className="p-1.5 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition">
                      <PhoneOff className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="relative shrink-0">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                      {getInitials(user?.name)}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-[#0e1122]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-white truncate block leading-tight">{user?.name}</span>
                    <span className="text-[9px] text-green-400">Online</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 rounded-md bg-white/[0.04] text-[#8e9297] hover:bg-white/[0.08] hover:text-white transition"><Mic className="w-3.5 h-3.5" /></button>
                    <button className="p-1.5 rounded-md bg-white/[0.04] text-[#8e9297] hover:bg-white/[0.08] hover:text-white transition"><Headphones className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── CENTER PANEL ── */}
          {voiceConnected && voiceChannelName ? (
            <VoiceRoom channelName={voiceChannelName}
              participants={webRTC.participants}
              localStream={webRTC.localStream}
              screenStream={webRTC.screenStream}
              remoteStreams={webRTC.remoteStreams}
              screenShareStreams={webRTC.screenShareStreams}
              cameraEnabled={webRTC.cameraEnabled}
              screenSharing={webRTC.screenSharing}
              speakingUsers={webRTC.speakingUsers}
              voiceMuted={voiceMuted} voiceDeafened={voiceDeafened}
              connectionQuality={webRTC.connectionQuality}
              userId={user?.id}
              userName={user?.name}
              onMute={() => setVoiceMuted(!voiceMuted)}
              onDeafen={() => setVoiceDeafened(!voiceDeafened)}
              onDisconnect={handleVoiceDisconnect}
              onToggleCamera={webRTC.toggleCamera}
              onToggleScreenShare={webRTC.screenSharing ? webRTC.stopScreenShare : webRTC.startScreenShare} />
          ) : (
            <div className="flex-1 flex flex-col min-w-0 bg-[#0a0d1a]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-[#0e1122] min-h-[48px] shadow-[0_1px_0_rgba(255,255,255,0.03)]">
                <div className="flex items-center gap-2 min-w-0">
                  {(() => { const Icon = channelIcon[activeChannelObj?.type] || Hash; return <Icon className={`w-4 h-4 ${channelColor[activeChannelObj?.type] || "text-cyan-400"}`} />; })()}
                  <span className="text-sm font-bold text-white truncate">{activeChannel}</span>
                  <span className="hidden sm:inline text-[10px] text-gray-600">—</span>
                  <span className="hidden sm:inline text-[10px] text-gray-600 truncate max-w-[200px]">
                    {activeChannelObj?.type === "announcements" ? "Important announcements" : `Chat about ${activeChannel}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition hidden sm:block">
                    <AtSign className="w-3.5 h-3.5" />
                  </button>
                  <button className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition hidden sm:block">
                    <Search className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setMembersOpen(!membersOpen)}
                    className="lg:hidden text-gray-500 hover:text-cyan-400 transition flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    <span className="text-[10px]">{onlineCount}</span>
                  </button>
                  <button onClick={handleLeaveServer} className="text-[10px] text-gray-500 hover:text-yellow-400 transition">Leave</button>
                  {isOwner && <button onClick={handleDeleteServer} className="text-[10px] text-gray-500 hover:text-red-400 transition">Delete</button>}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin">
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`h-10 w-10 rounded-2xl ${channelBg[activeChannelObj?.type] || "bg-cyan-500/10"} flex items-center justify-center ring-1 ring-white/[0.06]`}>
                      {(() => { const Icon = channelIcon[activeChannelObj?.type] || Hash; return <Icon className={`w-5 h-5 ${channelColor[activeChannelObj?.type] || "text-cyan-400"}`} />; })()}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">
                        Welcome to <span className="text-cyan-400">#{activeChannel}</span>
                      </h3>
                      <p className="text-[11px] text-gray-600">
                        {activeChannelObj?.type === "announcements" ? "Only teachers and moderators can send messages here" : `Start the conversation in #${activeChannel}`}
                      </p>
                    </div>
                  </div>
                </div>
                {messages.length === 0 ? (
                  <div className="px-4">
                    <div className="flex flex-col items-center justify-center py-16 text-xs text-gray-600 gap-2">
                      <MessageSquare className="w-8 h-8 text-gray-700" />
                      <p>No messages yet. Be the first to say something!</p>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 space-y-[2px]">
                    {messages.map((msg) => {
                      const isMine = msg.sender?._id === user?.id || msg.sender === user?.id;
                      const msgRx = reactions[msg._id] || {};
                      return (
                        <div key={msg._id} className="flex items-start gap-3 group hover:bg-white/[0.015] rounded-lg px-2 py-1.5 transition relative">
                          <div className="h-9 w-9 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 ring-2 ring-white/[0.03]">
                            {msg.sender?.avatar ? <img src={resolveAvatar(msg.sender.avatar)} alt="" className="h-full w-full rounded-full object-cover" /> : getInitials(msg.sender?.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold text-white">{msg.sender?.name || "Unknown"}</span>
                              <span className="text-[10px] text-gray-600">{formatTime(msg.createdAt)}</span>
                            </div>
                            <p className="text-sm text-[#dcddde] break-words leading-relaxed">{msg.text}</p>
                            {Object.keys(msgRx).length > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                {Object.entries(msgRx).map(([emoji, count]) => (
                                  <button key={emoji} onClick={() => handleReaction(msg._id, emoji)}
                                    className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 text-[11px] hover:bg-white/[0.08] transition">
                                    <span>{emoji}</span>
                                    <span className="text-[10px] text-gray-400">{count}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 absolute -right-1 top-1.5">
                            <div className="flex items-center gap-0.5 bg-[#1a1d2e] border border-white/[0.06] rounded-lg p-0.5 shadow-lg">
                              {REACTIONS.slice(0, 5).map((emoji) => (
                                <button key={emoji} onClick={() => handleReaction(msg._id, emoji)}
                                  className="p-0.5 text-sm hover:scale-125 transition hover:bg-white/[0.04] rounded">{emoji}</button>
                              ))}
                              <button className="p-0.5 text-gray-500 hover:text-gray-300">
                                <SmilePlus className="w-3 h-3" />
                              </button>
                            </div>
                            {isMine && (
                              <button onClick={() => handleDeleteMsg(msg._id)}
                                className="ml-0.5 p-1 rounded-md bg-[#1a1d2e] border border-white/[0.06] text-gray-500 hover:text-red-400 transition shadow-lg">
                                <X className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-white/[0.06] px-4 py-3 bg-[#0e1122]">
                <div className="flex items-end gap-2 bg-[#1a1d2e] rounded-xl border border-white/[0.06] px-4 py-2 focus-within:border-cyan-500/30 transition">
                  <textarea value={textInput} onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={`Message #${activeChannel}`} rows={1}
                    className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 outline-none resize-none min-h-[22px] max-h-[120px] py-1" />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition">
                      <Upload className="w-4 h-4" />
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden" />
                    <button className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition hidden sm:block">
                      <Image className="w-4 h-4" />
                    </button>
                    <button className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/[0.04] transition">
                      <SmilePlus className="w-4 h-4" />
                    </button>
                    <button onClick={handleSend} disabled={!textInput.trim() || sending}
                      className="p-1.5 rounded-md text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition disabled:opacity-30">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── MEMBERS PANEL ── */}
          <div className={`${membersOpen ? "translate-x-0" : "translate-x-full"} lg:translate-x-0 fixed lg:relative z-20 inset-y-0 right-0 w-60 flex-shrink-0 border-l border-white/[0.06] bg-[#0e1122]/90 flex flex-col transition-transform duration-200`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] min-h-[48px]">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Online — {onlineCount}</p>
              <div className="flex items-center gap-1">
                {activeServer?.inviteCode && (
                  <button onClick={() => {
                    const link = `${window.location.origin}/join-server?code=${activeServer.inviteCode}`;
                    navigator.clipboard?.writeText(link);
                    addToast("Invite link copied!", "success");
                  }} className="text-gray-500 hover:text-cyan-400 transition" title="Copy invite link">
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setMembersOpen(false)} className="lg:hidden text-gray-500 hover:text-white text-xs"><X className="w-3 h-3" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 scrollbar-thin">
              {voiceConnected && webRTC.participants.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest px-2 py-1">In Voice — {webRTC.participants.length}</p>
                  <div className="space-y-[1px]">
                    {[
                      { userId: "me", userName: user?.name || "You" },
                      ...webRTC.participants.filter((p) => p.userId !== user?.id),
                    ].map((p) => {
                      const isSpeaking = webRTC.speakingUsers.has(p.userId);
                      const isMutedLocal = p.userId === "me" && voiceMuted;
                      return (
                        <div key={p.userId} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 bg-green-500/[0.03] border border-green-500/10">
                          <div className="relative shrink-0">
                            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white ring-2 ${
                              isSpeaking ? "ring-green-400" : "ring-green-500/20"
                            }`}>
                              <div className="h-full w-full rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40 flex items-center justify-center text-[9px] font-bold">
                                {getInitials(p.userName)}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-[#dcddde] truncate">{p.userName}</span>
                          <span className="ml-auto">
                            {isMutedLocal ? <MicOff className="w-2.5 h-2.5 text-red-400" /> : isSpeaking ? <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" /> : null}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {memberGroups?.owner?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 py-1">Owner — {memberGroups.owner.length}</p>
                  <div className="space-y-[1px]">
                    {memberGroups.owner.map((m) => (
                      <div key={m._id} onClick={() => setProfileMember(m)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-white/[0.03] transition cursor-pointer">
                        <div className="relative shrink-0">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-yellow-500/40 to-orange-500/40 flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-yellow-500/20">
                            {m.avatar ? <img src={resolveAvatar(m.avatar)} alt="" className="h-full w-full rounded-full object-cover" /> : getInitials(m.name)}
                          </div>
                          {m.isOnline && <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 border-2 border-[#0e1122]" />}
                        </div>
                        <span className="text-xs text-[#dcddde] truncate">{m.name}</span>
                        <Crown className="w-3 h-3 text-yellow-500/60 ml-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {memberGroups?.moderators?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 py-1">Moderators — {memberGroups.moderators.length}</p>
                  <div className="space-y-[1px]">
                    {memberGroups.moderators.map((m) => (
                      <div key={m._id} onClick={() => setProfileMember(m)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-white/[0.03] transition cursor-pointer">
                        <div className="relative shrink-0">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500/40 to-cyan-500/40 flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-blue-500/20">
                            {m.avatar ? <img src={resolveAvatar(m.avatar)} alt="" className="h-full w-full rounded-full object-cover" /> : getInitials(m.name)}
                          </div>
                          {m.isOnline && <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 border-2 border-[#0e1122]" />}
                        </div>
                        <span className="text-xs text-[#dcddde] truncate">{m.name}</span>
                        <Shield className="w-3 h-3 text-blue-500/60 ml-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {memberGroups?.teachers?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 py-1">Teachers — {memberGroups.teachers.length}</p>
                  <div className="space-y-[1px]">
                    {memberGroups.teachers.map((m) => (
                      <div key={m._id} onClick={() => setProfileMember(m)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-white/[0.03] transition cursor-pointer">
                        <div className="relative shrink-0">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-purple-500/40 to-pink-500/40 flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-purple-500/20">
                            {m.avatar ? <img src={resolveAvatar(m.avatar)} alt="" className="h-full w-full rounded-full object-cover" /> : getInitials(m.name)}
                          </div>
                          {m.isOnline && <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 border-2 border-[#0e1122]" />}
                        </div>
                        <span className="text-xs text-[#dcddde] truncate">{m.name}</span>
                        <span className="text-[8px] text-purple-400 font-medium ml-auto">Teacher</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {memberGroups?.students?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-2 py-1">Students — {memberGroups.students.length}</p>
                  <div className="space-y-[1px]">
                    {memberGroups.students.map((m) => (
                      <div key={m._id} onClick={() => setProfileMember(m)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-white/[0.03] transition cursor-pointer">
                        <div className="relative shrink-0">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-white/[0.04]">
                            {m.avatar ? <img src={resolveAvatar(m.avatar)} alt="" className="h-full w-full rounded-full object-cover" /> : getInitials(m.name)}
                          </div>
                          {m.isOnline && <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-400 border-2 border-[#0e1122]" />}
                        </div>
                        <span className="text-xs text-[#dcddde] truncate">{m.name}</span>
                        <BookOpen className="w-3 h-3 text-cyan-500/40 ml-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(!memberGroups || Object.values(memberGroups).every((g) => g.length === 0)) && (
                <div className="flex items-center justify-center py-8 text-xs text-gray-600">No members</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── MOBILE VOICE BAR ── */}
      <AnimatePresence>
        {voiceConnected && voiceChannelName && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-40 bg-[#0e1122]/95 backdrop-blur-md border-t border-green-500/20 px-4 py-2.5 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-[9px] font-bold text-white" />
              <div>
                <span className="text-xs font-semibold text-white block leading-tight">{user?.name}</span>
                <span className="text-[9px] text-green-400">{voiceChannelName}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setVoiceMuted(!voiceMuted)}
                className={`p-1.5 rounded-md transition ${voiceMuted ? "bg-red-500/20 text-red-400" : "bg-white/[0.06] text-white"}`}>
                {voiceMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => setVoiceDeafened(!voiceDeafened)}
                className={`p-1.5 rounded-md transition ${voiceDeafened ? "bg-red-500/20 text-red-400" : "bg-white/[0.06] text-white"}`}>
                {voiceDeafened ? <HeadphoneOff className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
              </button>
              <button onClick={handleVoiceDisconnect} className="p-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition text-xs font-semibold px-2">Disconnect</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CREATE MODAL ── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8 overflow-y-auto"
            onClick={() => setShowCreate(false)}>
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="w-full max-w-[700px] rounded-2xl bg-[#0e1122]/95 backdrop-blur-md border border-white/[0.08] shadow-2xl shadow-cyan-500/5 overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5 px-6 pt-5 pb-2">
                {[{ n: 0, label: "Template" }, { n: 1, label: "Details" }].map((step) => (
                  <div key={step.n} className="flex items-center gap-1.5">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      createStep >= step.n ? "bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-[0_0_8px_rgba(0,245,255,0.3)]" : "bg-white/[0.06] text-gray-600"
                    }`}>{createStep > step.n ? "✓" : step.n + 1}</div>
                    <span className={`text-[10px] font-medium ${createStep >= step.n ? "text-gray-300" : "text-gray-600"}`}>{step.label}</span>
                    {step.n === 0 && <div className="w-8 h-px bg-white/[0.06] mx-1" />}
                  </div>
                ))}
              </div>
              {createStep === 0 ? (
                <div className="px-6 py-4">
                  <h2 className="text-lg font-bold text-white">Create Your Server</h2>
                  <p className="text-xs text-gray-500 mt-0.5 mb-4">Pick a template to auto-create channels, or start from scratch</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
                    {TEMPLATES.map((t) => {
                      const selected = selectedTemplate?.id === t.id;
                      return (
                        <motion.button key={t.id} type="button" whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.98 }}
                          onClick={() => handleSelectTemplate(selected ? null : t)}
                          className={`relative rounded-xl border p-3 text-left transition-all ${selected ? `bg-gradient-to-br ${t.gradient} border-cyan-400 shadow-[0_0_16px_rgba(0,245,255,0.15)]` : `bg-white/[0.03] ${t.border} hover:bg-white/[0.06]`}`}>
                          {selected && <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-cyan-400 flex items-center justify-center"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg></div>}
                          <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${t.gradient} flex items-center justify-center text-lg mb-2`}>{t.icon}</div>
                          <p className="text-xs font-bold text-white truncate">{t.name}</p>
                          <p className="text-[9px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{t.description}</p>
                          <p className="text-[8px] text-gray-600 mt-1.5">{t.channels.length} channels</p>
                        </motion.button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/[0.06]">
                    <button type="button" onClick={() => { setSelectedTemplate(null); setCreateForm((prev) => ({ ...prev, name: "" })); }}
                      className={`rounded-lg border px-4 py-2 text-xs font-semibold transition ${!selectedTemplate ? "border-cyan-500/40 text-cyan-400 bg-cyan-500/10" : "border-white/10 text-gray-400 hover:text-white"}`}>Custom Server</button>
                    <div className="flex-1" />
                    <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition">Cancel</button>
                    <button type="button" onClick={() => setCreateStep(1)} className="rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition">Next</button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateServer} className="px-6 py-4">
                  <h2 className="text-lg font-bold text-white">Customize Your Server</h2>
                  <p className="text-xs text-gray-500 mt-0.5 mb-4">{selectedTemplate ? `Based on "${selectedTemplate.name}" template` : "Create a custom server"}</p>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <button type="button" onClick={() => iconInputRef.current?.click()}
                        className="relative h-16 w-16 rounded-2xl bg-white/[0.04] border border-dashed border-white/[0.12] flex items-center justify-center overflow-hidden hover:border-cyan-500/40 transition-all group cursor-pointer">
                        {iconPreview ? <img src={iconPreview} alt="" className="h-full w-full object-cover" /> : <Upload className="w-6 h-6 text-gray-600 group-hover:text-gray-400 transition" />}
                      </button>
                      <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={handleIconChange} />
                      <div><p className="text-xs text-gray-400 font-medium">Server Icon</p><p className="text-[10px] text-gray-600">Click to upload (optional)</p></div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">Server Name</label>
                      <input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                        className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500/40 focus:bg-white/[0.06]" placeholder="Enter server name" required />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">Description</label>
                      <textarea value={createForm.description} onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                        className="mt-1 w-full rounded-lg bg-white/[0.04] border border-white/[0.06] px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500/40 focus:bg-white/[0.06] resize-none" rows={2} placeholder="What's your server about?" />
                    </div>
                    <label className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 cursor-pointer hover:bg-white/[0.05] transition">
                      <div className={`relative h-5 w-9 rounded-full transition-colors ${createForm.isPublic ? "bg-cyan-500" : "bg-gray-700"}`}>
                        <input type="checkbox" checked={createForm.isPublic} onChange={(e) => setCreateForm((p) => ({ ...p, isPublic: e.target.checked }))} className="sr-only" />
                        <div className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${createForm.isPublic ? "translate-x-4" : ""}`} />
                      </div>
                      <div className="flex-1"><p className="text-sm font-medium text-white">Public Server</p><p className="text-[10px] text-gray-500">Anyone can discover and join</p></div>
                    </label>
                    {selectedTemplate && (
                      <div>
                        <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 mb-2">Channels to be created ({previewChannels.length})</p>
                        <div className="flex flex-wrap gap-1.5">
                          {previewChannels.map((ch) => {
                            const Icon = channelIcon[ch.type] || Hash;
                            return (
                              <span key={ch.name} className={`inline-flex items-center gap-1 rounded-md border border-white/[0.06] px-2 py-1 text-[10px] ${channelColor[ch.type] || "text-gray-400"} bg-white/[0.02]`}>
                                <Icon className="w-3 h-3" /> {ch.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-5 pt-4 border-t border-white/[0.06]">
                    <button type="button" onClick={() => setCreateStep(0)} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition">Back</button>
                    <div className="flex-1" />
                    <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition">Cancel</button>
                    <button type="submit" disabled={creating || !createForm.name.trim()}
                      className="rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition disabled:opacity-50">
                      {creating ? "Creating..." : "Create Server"}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DISCOVER MODAL ── */}
      <AnimatePresence>
        {showDiscover && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setShowDiscover(false)}>
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-[#0e1122]/95 backdrop-blur-md border border-white/[0.08] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-white mb-4">Explore Servers</h2>
              {discoverable.length === 0 ? (
                <p className="text-sm text-gray-500 py-8 text-center">No public servers to discover</p>
              ) : (
                <div className="space-y-3">
                  {discoverable.map((s) => (
                    <div key={s._id} className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 hover:bg-white/[0.05] transition">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center text-sm font-bold text-white shrink-0">
                        {s.icon ? <img src={resolveAvatar(s.icon)} alt="" className="h-full w-full rounded-lg object-cover" /> : getInitials(s.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{s.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">{s.description || "No description"}</p>
                        <p className="text-[9px] text-gray-600">{s.members?.length || 0} members</p>
                      </div>
                      <button onClick={() => handleJoinServer(s._id)}
                        className="rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-3 py-1.5 text-[10px] font-semibold text-white shrink-0 hover:shadow-[0_0_12px_rgba(0,245,255,0.2)] transition">Join</button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PROFILE MODAL ── */}
      <AnimatePresence>
        {profileMember && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setProfileMember(null)}>
            <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="w-full max-w-sm rounded-2xl bg-[#0e1122]/95 backdrop-blur-md border border-white/[0.08] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex flex-col items-center text-center">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-2xl font-bold text-white ring-4 ring-white/[0.06] mb-4">
                  {profileMember.avatar
                    ? <img src={resolveAvatar(profileMember.avatar)} alt="" className="h-full w-full rounded-full object-cover" />
                    : getInitials(profileMember.name)}
                </div>
                {profileMember.isOnline && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-green-400 mb-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Online
                  </span>
                )}
                <h3 className="text-lg font-bold text-white">{profileMember.name || "Unknown"}</h3>
                <p className="text-xs text-gray-500 font-mono mt-1">
                  {profileMember._id ? profileMember._id.slice(0, 8) + "..." : ""}
                </p>
                {profileMember.role && (
                  <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-semibold capitalize ${
                    profileMember.role === "teacher" ? "border-purple-500/30 bg-purple-500/10 text-purple-400" :
                    profileMember.role === "admin" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                    "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                  }`}>
                    {profileMember.role}
                  </span>
                )}
                {profileMember._id !== user?._id && profileMember._id !== user?.id && (
                  <div className="mt-4">
                    <FollowButton userId={profileMember._id} size="sm" />
                  </div>
                )}
              </div>
              <div className="mt-6 space-y-3">
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 mb-1">About</p>
                  <p className="text-xs text-gray-400">{profileMember.bio || "No bio set"}</p>
                </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
              <p className="text-lg font-bold text-cyan-400">{memberStats?.certificateCount ?? 0}</p>
              <p className="text-[9px] text-gray-500">Certificates</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
              <p className="text-lg font-bold text-purple-400">{memberStats?.communityCount ?? 0}</p>
              <p className="text-[9px] text-gray-500">Communities</p>
            </div>
          </div>
              </div>
              <button onClick={() => setProfileMember(null)}
                className="mt-5 w-full rounded-xl border border-white/[0.08] px-4 py-2.5 text-xs font-semibold text-gray-400 hover:text-white hover:border-white/20 transition">
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Servers;
