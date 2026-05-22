import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/hooks/useAuth";
import { useSocket } from "../../shared/services/SocketContext";
import { useToast } from "../../shared/hooks/useToast";
import {
  getConversations,
  getMessages,
  sendMessage,
  deleteMessage,
  editMessage,
  togglePinMessage,
  getFriendsList,
  getFollowedUsers,
  searchUsersForDM,
  getPinnedMessages,
} from "../../shared/services/api";
import FollowButton from "../../shared/components/FollowButton";
import MessageList from "./components/MessageList";
import MessageInput from "./components/MessageInput";
import PinnedMessages from "./components/PinnedMessages";
import TypingIndicator from "./components/TypingIndicator";
import { useMessagingSocket } from "./hooks/useMessagingSocket";
import { getInitials, formatTime, resolveAvatar } from "./utils";

function Messages() {
  const { userId: routeUserId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { socket, onlineUsers } = useSocket();
  const { typingUsers, emitTyping } = useMessagingSocket(socket);

  const [conversations, setConversations] = useState([]);
  const [followedUsers, setFollowedUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [showPinned, setShowPinned] = useState(false);
  const searchRef = useRef(null);

  const currentUserId = user?.id || user?._id;

  // Load from route param
  useEffect(() => {
    if (routeUserId && conversations.length > 0) {
      const conv = conversations.find((c) => String(c._id || c.user?._id) === routeUserId);
      if (conv) {
        handleSelectChat(routeUserId, conv.user || conv);
      } else {
        loadUserAndSelect(routeUserId);
      }
    }
  }, [routeUserId, conversations]);

  const loadUserAndSelect = async (uid) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const { searchUsersForDM } = await import("../../shared/services/api");
      const data = await searchUsersForDM("", token);
      const found = data?.users?.find((u) => u._id === uid);
      if (found) {
        setActiveChat(uid);
        setActiveUser(found);
        loadMessages(uid);
      }
    } catch { /* silent */ }
  };

  const loadConversations = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getConversations(token);
      setConversations(data?.conversations || []);
    } catch { /* silent */ }
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
    } catch { /* silent */ }
  }, []);

  const loadPinned = useCallback(async (userId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getPinnedMessages(userId, token);
      setPinnedMessages(data?.messages || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    loadConversations();
    loadFollowed();
    loadFriends();
  }, [currentUserId, loadConversations, loadFollowed, loadFriends]);

  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.closest(".search-container")) {
        setShowSearch(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Socket listeners for new messages
  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      if (msg.sender?._id === activeChat || msg.receiver?._id === activeChat) {
        setMessages((prev) => prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]);
      }
      loadConversations();
    };
    const editHandler = (msg) => {
      setMessages((prev) => prev.map((m) => m._id === msg._id ? { ...m, ...msg } : m));
    };
    const deleteHandler = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    };
    const reactionHandler = ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, reactions } : m));
    };
    const pinHandler = ({ messageId, pinned }) => {
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, pinned } : m));
      if (activeChat) loadPinned(activeChat);
    };
    socket.on("new_message", handler);
    socket.on("message_edited", editHandler);
    socket.on("message_deleted", deleteHandler);
    socket.on("reaction_updated", reactionHandler);
    socket.on("pin_toggled", pinHandler);
    return () => {
      socket.off("new_message", handler);
      socket.off("message_edited", editHandler);
      socket.off("message_deleted", deleteHandler);
      socket.off("reaction_updated", reactionHandler);
      socket.off("pin_toggled", pinHandler);
    };
  }, [socket, activeChat, loadConversations, loadPinned]);

  // Search effect
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
    loadPinned(userId);
    setShowSearch(false);
    setSearchQuery("");
    setReplyTo(null);
    setShowPinned(false);
    navigate(`/messages/${userId}`, { replace: true });
  };

  const handleSend = async (text) => {
    if (!text || !activeChat) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await sendMessage(activeChat, text, token, {
        replyTo: replyTo?._id || null,
      });
      if (data?.message) {
        setMessages((prev) => prev.some((m) => m._id === data.message._id) ? prev : [...prev, data.message]);
        loadConversations();
      }
      setReplyTo(null);
    } catch (err) {
      addToast(err?.response?.data?.error || "Failed to send", "error");
    }
  };

  const handleDelete = async (messageId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await deleteMessage(messageId, token);
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    } catch {
      addToast("Failed to delete", "error");
    }
  };

  const handleEdit = async (messageId, text) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await editMessage(messageId, text, token);
    } catch {
      addToast("Failed to edit", "error");
    }
  };

  const handlePin = async (messageId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await togglePinMessage(messageId, token);
    } catch {
      addToast("Failed to pin", "error");
    }
  };

  const handleUnpin = async (messageId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await togglePinMessage(messageId, token);
      if (activeChat) loadPinned(activeChat);
    } catch {
      addToast("Failed to unpin", "error");
    }
  };

  const isOnline = activeUser ? onlineUsers.has(activeChat) : false;
  const isTyping = activeChat ? typingUsers[activeChat] : null;

  const hasMessages = useMemo(() => conversations.filter((c) => c.lastMessage), [conversations]);
  const noMessages = useMemo(() => conversations.filter((c) => !c.lastMessage), [conversations]);

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-white/[0.06] bg-gray-950/90">
      {/* Left Sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] bg-black/20 flex flex-col">
        <div className="p-3 border-b border-white/[0.06] search-container">
          <div className="relative">
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
              onFocus={() => setShowSearch(true)}
              placeholder="Search users, friends..."
              className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-cyan-500/40 transition"
            />
            <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {showSearch && searchQuery.trim() && (
            <div className="absolute left-3 right-3 top-14 z-50 max-h-60 overflow-y-auto rounded-xl border border-white/[0.08] bg-gray-900 shadow-2xl scrollbar-thin">
              {searching ? (
                <div className="flex items-center justify-center py-6">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-500">No users found</p>
              ) : (
                searchResults.map((u) => (
                  <div key={u._id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition">
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
                    <FollowButton userId={u._id} size="sm" />
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Pinned toggle */}
        {pinnedMessages.length > 0 && (
          <button
            onClick={() => setShowPinned(!showPinned)}
            className="flex items-center gap-2 px-4 py-2 text-[10px] text-gray-500 hover:text-yellow-400 hover:bg-white/[0.02] transition"
          >
            <span>📌</span>
            <span>Pinned messages ({pinnedMessages.length})</span>
            <span className="ml-auto">{showPinned ? "▲" : "▼"}</span>
          </button>
        )}

        {showPinned && pinnedMessages.length > 0 && (
          <div className="border-b border-white/[0.06] bg-yellow-500/5 max-h-40 overflow-y-auto">
            {pinnedMessages.map((msg) => (
              <div key={msg._id} className="flex items-center gap-2 px-4 py-2 hover:bg-white/[0.02]">
                <span className="text-[10px] text-yellow-500">📌</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-300 truncate">{msg.text || "[attachment]"}</p>
                  <p className="text-[8px] text-gray-600">{msg.sender?.name}</p>
                </div>
                <button onClick={() => handleUnpin(msg._id)} className="text-[8px] text-gray-600 hover:text-red-400">✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="space-y-0.5 p-2">
            {hasMessages.length > 0 && (
              <>
                <p className="px-2 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Chats</p>
                {hasMessages.map((conv) => {
                  const convUser = conv.user || {};
                  const cid = convUser._id;
                  const convOnline = onlineUsers.has(cid);
                  const isActive = activeChat === cid;
                  return (
                    <button
                      key={conv._id}
                      onClick={() => handleSelectChat(cid, convUser)}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                        isActive
                          ? "bg-cyan-500/10 border border-cyan-500/20"
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
                        <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-gray-950 ${convOnline ? "bg-green-400" : "bg-gray-600"}`} />
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
                  const convOnline = onlineUsers.has(cid);
                  const isActive = activeChat === cid;
                  return (
                    <div
                      key={conv._id}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                        isActive
                          ? "bg-cyan-500/10 border border-cyan-500/20"
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
                          <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-gray-950 ${convOnline ? "bg-green-400" : "bg-gray-600"}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">{convUser.name || "Unknown"}</p>
                          <p className="truncate text-xs text-gray-500 italic">Send a message...</p>
                        </div>
                      </button>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <FollowButton userId={cid} size="sm" />
                        {convOnline && <span className="px-1.5 py-0.5 rounded-full bg-green-500/10 text-[8px] text-green-400 font-semibold">Online</span>}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            {hasMessages.length === 0 && noMessages.length === 0 && (
              <p className="py-8 text-center text-xs text-gray-500">No conversations yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Center - Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 relative">
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
                    <span className="text-cyan-400">{isTyping} is typing...</span>
                  ) : isOnline ? (
                    "Online"
                  ) : (
                    "Offline"
                  )}
                </p>
              </div>
            </div>

            {/* Pinned bar */}
            {pinnedMessages.length > 0 && !showPinned && (
              <div className="border-b border-white/[0.06] bg-yellow-500/5">
                <div className="flex items-center gap-2 px-4 py-1.5">
                  <span className="text-yellow-500 text-xs">📌</span>
                  <span className="text-[10px] text-gray-400">{pinnedMessages.length} pinned</span>
                  <button onClick={() => setShowPinned(true)} className="text-[10px] text-cyan-400 hover:text-cyan-300 ml-auto">Show</button>
                </div>
              </div>
            )}

            <MessageList
              messages={messages}
              currentUserId={currentUserId}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onReply={setReplyTo}
              onPin={handlePin}
            />

            <TypingIndicator typingUsers={typingUsers} activeChat={activeChat} />

            <MessageInput
              activeChat={activeChat}
              activeUser={activeUser}
              onSend={handleSend}
              socket={socket}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
            />
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
                <p className="text-[10px] text-cyan-400">{isTyping} is typing...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Messages;
