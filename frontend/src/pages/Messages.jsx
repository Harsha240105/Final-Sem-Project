import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../hooks/useToast";
import {
  API_BASE_URL as API_URL,
  getConversations,
  getMessages,
  sendMessage,
  deleteMessage,
  getFriendsList,
  getFollowedUsers,
  searchUsersForDM,
} from "../services/api";
import FollowButton from "../components/FollowButton";

const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

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

function Messages() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { socket, onlineUsers } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [followedUsers, setFollowedUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const searchRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getConversations(token);
      setConversations(data?.conversations || []);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFollowed = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getFollowedUsers(token);
      setFollowedUsers(data?.users || []);
    } catch { /* silent */ }
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getFriendsList(token);
      setFriends(data?.friends || []);
    } catch { /* silent */ }
  }, []);

  const loadMessages = useCallback(async (userId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getMessages(userId, token);
      setMessages(data?.messages || []);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    loadConversations();
    loadFollowed();
    loadFriends();
  }, [user?.id, loadConversations, loadFollowed, loadFriends]);

  // Close search on click outside
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.closest(".search-container")) {
        setShowSearch(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      if (msg.sender?._id === activeChat || msg.receiver?._id === activeChat) {
        setMessages((prev) => prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]);
      }
      loadConversations();
    };
    socket.on("new_message", handler);
    return () => socket.off("new_message", handler);
  }, [socket, activeChat, loadConversations]);

  useEffect(() => {
    if (!socket) return;
    const handler = ({ userId: typingUserId, userName }) => {
      setTypingUsers((prev) => ({ ...prev, [typingUserId]: userName }));
    };
    const stopHandler = ({ userId: typingUserId }) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[typingUserId];
        return next;
      });
    };
    socket.on("user_typing", handler);
    socket.on("user_stop_typing", stopHandler);
    return () => {
      socket.off("user_typing", handler);
      socket.off("user_stop_typing", stopHandler);
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Search effect with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const data = await searchUsersForDM(searchQuery.trim(), token);
        setSearchResults(data?.users || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectChat = (userId, userData) => {
    setActiveChat(userId);
    setActiveUser(userData);
    loadMessages(userId);
    setShowSearch(false);
    setSearchQuery("");
  };

  const handleSend = async () => {
    const text = textInput.trim();
    if (!text || !activeChat || sending) return;
    setSending(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await sendMessage(activeChat, text, token);
      if (data?.message) {
        setMessages((prev) => prev.some((m) => m._id === data.message._id) ? prev : [...prev, data.message]);
        loadConversations();
      }
      setTextInput("");
    } catch (err) {
      addToast(err?.response?.data?.error || "Failed to send", "error");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await deleteMessage(messageId, token);
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    } catch (err) {
      addToast("Failed to delete", "error");
    }
  };

  const isOnline = activeUser ? onlineUsers.has(activeChat) : false;
  const isTyping = activeChat ? typingUsers[activeChat] : null;

  const hasMessages = useMemo(() => conversations.filter((c) => c.lastMessage), [conversations]);
  const noMessages = useMemo(() => conversations.filter((c) => !c.lastMessage), [conversations]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-gray-950/90 to-gray-900/80 backdrop-blur-md"
    >
      {/* Left Sidebar - Chat List */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] bg-black/20 flex flex-col">
        {/* Search Bar */}
        <div className="p-3 border-b border-white/[0.06] search-container">
          <div className="relative">
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearch(true);
              }}
              onFocus={() => setShowSearch(true)}
              placeholder="Search users, friends..."
              className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-cyan-500/40 transition"
            />
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Search Results Dropdown */}
          <AnimatePresence>
            {showSearch && searchQuery.trim() && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-3 right-3 top-14 z-50 max-h-60 overflow-y-auto rounded-xl border border-white/[0.08] bg-gray-900 shadow-2xl backdrop-blur-md scrollbar-thin"
              >
                {searching ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="py-6 text-center text-xs text-gray-500">No users found</p>
                ) : (
                  searchResults.map((u) => {
                    const isCurrentUser = u._id === user?.id || u._id === user?._id;
                    return (
                      <div
                        key={u._id}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition"
                      >
                        <button
                          onClick={() => handleSelectChat(u._id, u)}
                          className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        >
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {u.avatar ? <img src={resolveAvatar(u.avatar)} alt="" className="h-full w-full rounded-full object-cover" /> : getInitials(u.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">{u.name}</p>
                            <p className="truncate text-[10px] text-gray-500 capitalize">{u.role} {u.collegeName ? `· ${u.collegeName}` : ""}</p>
                          </div>
                        </button>
                        {!isCurrentUser && (
                          <FollowButton userId={u._id} size="sm" />
                        )}
                      </div>
                    );
                  })
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="space-y-0.5 p-2">
            {hasMessages.length > 0 && (
              <>
                <p className="px-2 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Chats</p>
                {hasMessages.map((conv) => {
                  const convUser = conv.user || {};
                  const cid = convUser._id;
                  const isOnline = onlineUsers.has(cid);
                  const isActive = activeChat === cid;
                  return (
                    <button
                      key={conv._id}
                      onClick={() => handleSelectChat(cid, convUser)}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                        isActive
                          ? "bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_10px_rgba(0,245,255,0.05)]"
                          : "hover:bg-white/[0.03] border border-transparent"
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        {convUser.avatar ? (
                          <img src={resolveAvatar(convUser.avatar)} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40 flex items-center justify-center text-sm font-bold text-white">
                            {getInitials(convUser.name)}
                          </div>
                        )}
                        <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-gray-950 ${isOnline ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" : "bg-gray-600"}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{convUser.name || "Unknown"}</p>
                        <p className="truncate text-xs text-gray-500">{conv.lastMessage?.text || ""}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[10px] text-gray-600">{formatTime(conv.lastMessage?.createdAt)}</span>
                        {conv.unread > 0 && (
                          <span className="flex items-center justify-center h-4 min-w-[16px] rounded-full bg-cyan-500 px-1 text-[9px] font-bold text-white">
                            {conv.unread}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </>
            )}
            {noMessages.length > 0 && (
              <>
                <p className="px-2 py-1 mt-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Following</p>
                {noMessages.map((conv) => {
                  const convUser = conv.user || {};
                  const cid = convUser._id;
                  const isOnline = onlineUsers.has(cid);
                  const isActive = activeChat === cid;
                  return (
                    <div
                      key={conv._id}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                        isActive
                          ? "bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_10px_rgba(0,245,255,0.05)]"
                          : "hover:bg-white/[0.03] border border-transparent"
                      }`}
                    >
                      <button
                        onClick={() => handleSelectChat(cid, convUser)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <div className="relative flex-shrink-0">
                          {convUser.avatar ? (
                            <img src={resolveAvatar(convUser.avatar)} alt="" className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500/40 to-purple-500/40 flex items-center justify-center text-sm font-bold text-white">
                              {getInitials(convUser.name)}
                            </div>
                          )}
                          <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-gray-950 ${isOnline ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" : "bg-gray-600"}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{convUser.name || "Unknown"}</p>
                          <p className="truncate text-xs text-gray-500 italic">Send a message...</p>
                        </div>
                      </button>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <FollowButton userId={cid} size="sm" />
                        {isOnline && <span className="px-1.5 py-0.5 rounded-full bg-green-500/10 text-[8px] text-green-400 font-semibold">Online</span>}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            {hasMessages.length === 0 && noMessages.length === 0 && (
              <p className="py-8 text-center text-xs text-gray-500">No conversations yet. Follow someone to start chatting!</p>
            )}
          </div>
        </div>
      </div>

      {/* Center - Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] bg-black/10">
              <div className="relative">
                <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${isOnline ? "from-green-400 to-cyan-400" : "from-gray-500 to-gray-600"} flex items-center justify-center text-sm font-bold text-white`}>
                  {activeUser?.avatar ? (
                    <img src={resolveAvatar(activeUser.avatar)} alt="" className="h-full w-full rounded-full object-cover" />
                  ) : getInitials(activeUser?.name)}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-gray-950 ${isOnline ? "bg-green-400" : "bg-gray-600"}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-white">{activeUser?.name || "User"}</p>
                <p className="text-[10px] text-gray-500">
                  {isTyping ? (
                    <span className="text-cyan-400 animate-pulse">{isTyping} is typing...</span>
                  ) : isOnline ? (
                    "Online"
                  ) : (
                    "Offline"
                  )}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-gray-500">
                  Send a message to start chatting
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender?._id === user?.id || msg.sender === user?.id;
                  return (
                    <motion.div
                      key={msg._id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div className="group relative max-w-[70%]">
                        {msg.replyTo && (
                          <div className="mb-1 px-3 py-1 rounded-lg bg-white/[0.03] border-l-2 border-cyan-400 text-[10px] text-gray-400">
                            Replying to a message
                          </div>
                        )}
                        <div
                          className={`rounded-2xl px-4 py-2.5 text-sm ${
                            isMine
                              ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/20 text-white"
                              : "bg-white/[0.04] border border-white/[0.06] text-gray-200"
                          }`}
                        >
                          {msg.image && (
                            <img src={resolveAvatar(msg.image)} alt="" className="max-w-full rounded-lg mb-2" loading="lazy" />
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        </div>
                        <div className={`flex items-center gap-2 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                          <span className="text-[10px] text-gray-600">{formatTime(msg.createdAt)}</span>
                          {msg.read && isMine && <span className="text-[10px] text-cyan-400">✓✓</span>}
                          {isMine && (
                            <button
                              onClick={() => handleDeleteMessage(msg._id)}
                              className="opacity-0 group-hover:opacity-100 text-[10px] text-gray-600 hover:text-red-400 transition"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-white/[0.06] p-3 bg-black/10">
              <div className="flex items-end gap-2">
                <textarea
                  value={textInput}
                  onChange={(e) => {
                    setTextInput(e.target.value);
                    if (socket && activeChat) {
                      socket.emit("typing", { receiverId: activeChat });
                      clearTimeout(textInput._typingTimer);
                      textInput._typingTimer = setTimeout(() => {
                        socket.emit("stop_typing", { receiverId: activeChat });
                      }, 1500);
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${activeUser?.name || "user"}...`}
                  rows={1}
                  className="flex-1 rounded-xl border border-white/[0.08] bg-black/30 px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none resize-none focus:border-cyan-500/40 transition min-h-[40px] max-h-[120px]"
                  style={{ height: "auto" }}
                />
                <button
                  onClick={handleSend}
                  disabled={!textInput.trim() || sending}
                  className="flex-shrink-0 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:shadow-[0_0_12px_rgba(0,245,255,0.2)] transition active:scale-95"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-4xl mb-4 opacity-30">💬</div>
              <h3 className="text-lg font-bold text-white">Your Messages</h3>
              <p className="text-sm text-gray-500 mt-1">Select a conversation or search for someone to chat with</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - User Info */}
      {activeUser && (
        <div className="w-64 flex-shrink-0 border-l border-white/[0.06] bg-black/20 p-4 hidden lg:block">
          <div className="flex flex-col items-center text-center mb-6">
            <div className={`h-16 w-16 rounded-full bg-gradient-to-br ${isOnline ? "from-green-400 to-cyan-400" : "from-gray-500 to-gray-600"} p-0.5 mb-3`}>
              <div className="h-full w-full rounded-full bg-gray-900 flex items-center justify-center text-lg font-bold text-white">
                {activeUser?.avatar ? (
                  <img src={resolveAvatar(activeUser.avatar)} alt="" className="h-full w-full rounded-full object-cover" />
                ) : getInitials(activeUser?.name)}
              </div>
            </div>
            <p className="text-sm font-bold text-white">{activeUser?.name}</p>
            <p className="text-[10px] text-gray-500 capitalize">{activeUser?.role || "Student"}</p>
            <div className={`mt-2 flex items-center gap-1.5 text-[10px] ${isOnline ? "text-green-400" : "text-gray-600"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-green-400" : "bg-gray-600"}`} />
              {isOnline ? "Online" : "Offline"}
            </div>
          </div>
          <div className="space-y-2">
            <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Institution</p>
              <p className="text-xs text-white mt-0.5">{activeUser?.collegeName || activeUser?.institutionName || "Not set"}</p>
            </div>
            {isTyping && (
              <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/20 p-3">
                <p className="text-[10px] text-cyan-400 animate-pulse">{isTyping} is typing...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default Messages;
