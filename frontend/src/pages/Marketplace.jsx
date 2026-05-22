import PropTypes from "prop-types";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { useToast } from "../hooks/useToast";
import { API_BASE_URL as API_URL, deleteMarketplacePost, rewardNFTAndClose } from "../services/api";
import FollowButton from "../components/FollowButton";
import ProfileLink from "../components/ProfileLink";
import ParticleField from "../components/ParticleField";
import RevealOnScroll from "../components/RevealOnScroll";

/* ── helpers ─────────────────────────────────────────── */
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const TYPE_CONFIG = {
  Job: { icon: "💼", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  Event: { icon: "📅", color: "text-blue-400", bg: "bg-blue-500/10" },
  Project: { icon: "🚀", color: "text-purple-400", bg: "bg-purple-500/10" },
};

/* ── Avatar ──────────────────────────────────────────── */
function Avatar({ name, size = "sm" }) {
  const sizes = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm" };
  const colors = ["from-purple-500 to-indigo-500", "from-emerald-500 to-teal-500", "from-blue-500 to-cyan-500", "from-pink-500 to-rose-500", "from-amber-500 to-orange-500"];
  const idx = name ? name.charCodeAt(0) % colors.length : 0;
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center font-bold text-white shrink-0`}>
      {getInitials(name)}
    </div>
  );
}
Avatar.propTypes = { name: PropTypes.string, size: PropTypes.string };

/* ── Comment ─────────────────────────────────────────── */
function Comment({ comment }) {
  return (
    <div className="flex gap-3 py-2.5 first:pt-0">
      <ProfileLink userId={comment.author?._id}>
        <Avatar name={comment.author?.name} size="xs" />
      </ProfileLink>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <ProfileLink userId={comment.author?._id} className="text-xs font-semibold text-white">
            {comment.author?.name || "Anonymous"}
          </ProfileLink>
          <span className="text-[11px] text-gray-600">{timeAgo(comment.createdAt)}</span>
        </div>
        <p className="mt-0.5 text-sm text-gray-400 leading-relaxed break-words">{comment.text}</p>
      </div>
    </div>
  );
}
Comment.propTypes = { comment: PropTypes.object.isRequired };

/* ── Post Card ───────────────────────────────────────── */
function PostCard({ item, onComment, onCollab, onDelete, onRewardNFT, currentUserId }) {
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rewarding, setRewarding] = useState(false);
  const inputRef = useRef(null);

  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.Job;
  const isOwner = currentUserId && item.createdBy?._id === currentUserId;
  const hasCollabed = item.collaborators?.some((c) => c.user?._id === currentUserId);
  const isClosed = item.status === "closed";
  const canManage = isOwner && !isClosed;

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommenting(true);
    await onComment(item._id, commentText.trim());
    setCommentText("");
    setCommenting(false);
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    setDeleting(true);
    await onDelete(item._id);
    setDeleting(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="group border-b border-white/[0.06] last:border-b-0"
    >
      {/* Main row */}
      <div className="flex gap-3 px-1 py-4">
        <ProfileLink userId={item.createdBy?._id}>
          <Avatar name={item.createdBy?.name} size="md" />
        </ProfileLink>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <ProfileLink userId={item.createdBy?._id} className="text-sm font-semibold text-white">
              {item.createdBy?.name || "Anonymous"}
            </ProfileLink>
            <span className="text-[11px] text-gray-600">{timeAgo(item.createdAt)}</span>
            <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
              {cfg.icon} {item.type}
            </span>
            {item.community && <span className="text-[10px] text-gray-600">in {item.community}</span>}
            {isClosed && (
              <span className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                🔒 Closed {item.nftIssued && "· NFT Issued"}
              </span>
            )}
            {canManage && (
              <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => {
                    if (!window.confirm("Issue NFT rewards and close this post?")) return;
                    setRewarding(true);
                    onRewardNFT(item._id).finally(() => setRewarding(false));
                  }}
                  disabled={rewarding}
                  className="text-[11px] text-amber-400 hover:text-amber-300 transition disabled:opacity-50"
                  title="Reward NFT & Close"
                >
                  {rewarding ? "..." : "🏆 Reward"}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-[11px] text-gray-600 hover:text-red-400 transition disabled:opacity-50"
                  title="Delete post permanently"
                >
                  {deleting ? "..." : "✕ Delete"}
                </button>
              </div>
            )}
          </div>

          <h3
            className="mt-1 text-base font-bold text-white leading-snug cursor-pointer hover:text-purple-300 transition-colors"
            onClick={() => setExpanded(!expanded)}
          >
            {item.title}
          </h3>

          <p className={`mt-1.5 text-sm text-gray-400 leading-relaxed whitespace-pre-wrap ${!expanded && item.description.length > 200 ? "line-clamp-3" : ""}`}>
            {item.description}
          </p>
          {item.description.length > 200 && (
            <button onClick={() => setExpanded(!expanded)} className="mt-0.5 text-xs font-medium text-purple-400 hover:text-purple-300 transition">
              {expanded ? "Show less" : "Read more"}
            </button>
          )}

          {/* Tags */}
          {item.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {item.tags.map((tag, i) => (
                <span key={i} className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] text-gray-500">{tag}</span>
              ))}
            </div>
          )}

          {/* Follow creator */}
          {item.createdBy?._id && item.createdBy._id !== currentUserId && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] text-gray-600">Creator</span>
              <FollowButton
                userId={item.createdBy._id}
                size="sm"
              />
            </div>
          )}

          {/* Actions bar */}
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={() => { setExpanded(!expanded); setTimeout(() => inputRef.current?.focus(), 150); }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
              </svg>
              {item.comments?.length || 0}
            </button>

            <span className="flex items-center gap-1 text-xs text-gray-500">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              {item.collaborators?.length || 0}
            </span>

            {item.status === "open" && <span className="text-[10px] text-emerald-400 font-medium">Open</span>}
            {item.status === "active" && <span className="text-[10px] text-blue-400 font-medium">Active</span>}
            {item.status === "closed" && <span className="text-[10px] text-red-400 font-medium">Closed</span>}

            {/* Collab stacked avatars */}
            {item.collaborators?.length > 0 && (
              <div className="flex -space-x-1.5 ml-auto">
                {item.collaborators.slice(0, 3).map((c, i) => (
                  <div key={i} title={`${c.user?.name} (${c.status})`}>
                    <Avatar name={c.user?.name} size="xs" />
                  </div>
                ))}
                {item.collaborators.length > 3 && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-[9px] font-bold text-gray-400">
                    +{item.collaborators.length - 3}
                  </span>
                )}
              </div>
            )}

            {!isOwner && currentUserId && !isClosed && (
              <button
                disabled={hasCollabed}
                onClick={() => onCollab(item._id)}
                className={`ml-auto rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  hasCollabed
                    ? "text-gray-600 cursor-default"
                    : "bg-purple-500/15 text-purple-300 hover:bg-purple-500/25"
                }`}
              >
                {hasCollabed ? "✓ Requested" : "Collaborate"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comments (expanded) */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-14 pr-1 pb-4 space-y-1">
              {item.comments?.length > 0 && (
                <div className="max-h-56 overflow-y-auto divide-y divide-white/[0.04] custom-scrollbar">
                  {item.comments.map((c, i) => <Comment key={c._id || i} comment={c} />)}
                </div>
              )}
              {currentUserId && (
                <form onSubmit={handleComment} className="flex items-center gap-2 pt-2">
                  <input
                    ref={inputRef}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    className="flex-1 rounded-md bg-white/[0.04] px-3 py-1.5 text-sm text-white placeholder:text-gray-600 outline-none transition focus:bg-white/[0.07]"
                  />
                  <button
                    type="submit"
                    disabled={commenting || !commentText.trim()}
                    className="rounded-md bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.12] disabled:opacity-40"
                  >
                    {commenting ? "..." : "Post"}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
PostCard.propTypes = {
  item: PropTypes.object.isRequired,
  onComment: PropTypes.func.isRequired,
  onCollab: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onRewardNFT: PropTypes.func.isRequired,
  currentUserId: PropTypes.string,
};

/* ── Skeleton ────────────────────────────────────────── */
function PostSkeleton() {
  return (
    <div className="flex gap-3 py-4 animate-pulse">
      <div className="h-10 w-10 rounded-full bg-gray-800/50" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-32 rounded bg-gray-800/40" />
        <div className="h-4 w-3/4 rounded bg-gray-800/40" />
        <div className="h-3 w-full rounded bg-gray-800/30" />
        <div className="h-3 w-5/6 rounded bg-gray-800/30" />
      </div>
    </div>
  );
}

/* ── Create Post Form ────────────────────────────────── */
function CreatePostForm({ onSubmit, submitting }) {
  const [form, setForm] = useState({ title: "", description: "", type: "Project", community: "", tags: "" });
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
    setForm({ title: "", description: "", type: "Project", community: "", tags: "" });
    setFocused(false);
  };

  return (
    <div className={`rounded-lg transition-all duration-200 ${focused ? "bg-white/[0.04]" : ""}`}>
      <form onSubmit={handleSubmit}>
        {!focused ? (
          <button
            type="button"
            onClick={() => setFocused(true)}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition hover:bg-white/[0.04]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/15 text-purple-400 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
            </span>
            <span className="text-sm text-gray-500">Create a new post...</span>
          </button>
        ) : (
          <div className="px-3 pt-3">
            <input
              value={form.title}
              autoFocus
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Post title"
              className="w-full bg-transparent text-sm font-medium text-white placeholder:text-gray-500 outline-none"
            />
          </div>
        )}

        <AnimatePresence>
          {focused && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3 space-y-3">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  placeholder="Describe what you're looking for..."
                  className="w-full rounded-md bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none transition focus:bg-white/[0.06] resize-none"
                />

                <div className="flex flex-wrap gap-3">
                  <div className="flex gap-1">
                    {["Job", "Event", "Project"].map((t) => {
                      const c = TYPE_CONFIG[t];
                      const active = form.type === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, type: t }))}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                            active ? `${c.bg} ${c.color}` : "text-gray-500 hover:text-gray-300"
                          }`}
                        >
                          {c.icon} {t}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    value={form.community}
                    onChange={(e) => setForm((p) => ({ ...p, community: e.target.value }))}
                    placeholder="Community"
                    className="rounded-md bg-white/[0.04] px-2.5 py-1 text-xs text-white placeholder:text-gray-600 outline-none w-28"
                  />
                  <input
                    value={form.tags}
                    onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))}
                    placeholder="Tags (comma separated)"
                    className="rounded-md bg-white/[0.04] px-2.5 py-1 text-xs text-white placeholder:text-gray-600 outline-none flex-1 min-w-[120px]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setFocused(false); setForm({ title: "", description: "", type: "Project", community: "", tags: "" }); }}
                    className="rounded-md px-3 py-1.5 text-xs text-gray-400 transition hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !form.title.trim() || !form.description.trim()}
                    className="rounded-md bg-purple-500 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-purple-400 disabled:opacity-40"
                  >
                    {submitting ? "Publishing..." : "Publish"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
CreatePostForm.propTypes = { onSubmit: PropTypes.func.isRequired, submitting: PropTypes.bool };

/* ── Filter Tabs ─────────────────────────────────────── */
function FilterBar({ active, onChange, counts }) {
  const filters = [
    { key: "all", label: "All" },
    { key: "Project", label: "Projects" },
    { key: "Job", label: "Jobs" },
    { key: "Event", label: "Events" },
  ];
  return (
    <div className="flex items-center gap-1">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            active === f.key
              ? "bg-white/[0.1] text-white"
              : "text-gray-500 hover:text-gray-300"
          }`}
        >
          {f.label}
          <span className="ml-1 text-[10px] text-gray-600">{counts[f.key] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
FilterBar.propTypes = { active: PropTypes.string, onChange: PropTypes.func, counts: PropTypes.object };

/* ── Main Marketplace Page ───────────────────────────── */
function Marketplace({ role }) {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [view, setView] = useState("global"); // "global" | "local"

  const getCurrentUserId = useCallback(() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.id || null;
    } catch { return null; }
  }, []);

  const currentUserId = getCurrentUserId();
  const canPost = role === "student" || role === "admin" || role === "teacher";

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/marketplace?limit=60`, { timeout: 12000 });
      setItems(res.data);
    } catch (err) {
      console.error("Failed to fetch marketplace posts:", err);
      addToast("Failed to load listings", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) { addToast("You must be logged in", "error"); return null; }
    return { Authorization: `Bearer ${token}` };
  }, [addToast]);

  const handleCreatePost = async (form) => {
    if (!form.title.trim() || !form.description.trim()) {
      addToast("Title and description are required", "error");
      return;
    }
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      setSubmitting(true);
      await axios.post(`${API_URL}/marketplace`, {
        title: form.title, description: form.description, type: form.type, community: form.community, tags: form.tags,
      }, { headers });
      addToast("Published successfully!", "success");
      await fetchPosts();
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to post", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleComment = async (postId, text) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await axios.post(`${API_URL}/marketplace/${postId}/comment`, { text }, { headers });
      setItems((prev) => prev.map((p) => (p._id === postId ? res.data : p)));
      addToast("Comment added", "success");
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to comment", "error");
    }
  };

  const handleCollab = async (postId) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await axios.post(`${API_URL}/marketplace/${postId}/collab`, {}, { headers });
      setItems((prev) => prev.map((p) => (p._id === postId ? res.data : p)));
      addToast("Collaboration requested!", "success");
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to request", "error");
    }
  };

  const handleDelete = async (postId) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const token = localStorage.getItem("token");
      await deleteMarketplacePost(postId, token);
      setItems((prev) => prev.filter((p) => p._id !== postId));
      addToast("Post deleted permanently", "success");
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to delete", "error");
    }
  };

  const handleRewardNFT = async (postId) => {
    const token = localStorage.getItem("token");
    if (!token) { addToast("You must be logged in", "error"); return; }
    try {
      const result = await rewardNFTAndClose(postId, token);
      setItems((prev) => prev.map((p) => (p._id === postId ? result.post : p)));
      addToast(result.message, "success");
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to issue rewards", "error");
    }
  };

  const viewItems = view === "local"
    ? items.filter((item) =>
        item.createdBy?._id === currentUserId ||
        item.collaborators?.some((c) => c.user?._id === currentUserId) ||
        item.participants?.some((p) => (p._id || p) === currentUserId)
      )
    : items;

  const filtered = viewItems.filter((item) => {
    const matchType = filter === "all" || item.type === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q) || item.tags?.some((t) => t.toLowerCase().includes(q)) || item.community?.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const counts = {
    all: viewItems.length,
    Project: viewItems.filter((i) => i.type === "Project").length,
    Job: viewItems.filter((i) => i.type === "Job").length,
    Event: viewItems.filter((i) => i.type === "Event").length,
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
  };
  const staggerItem = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <>
      <ParticleField count={20} color="purple" speed={0.7} />
      <motion.div
        className="mx-auto max-w-3xl relative z-10"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
      >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketplace</h1>
          <p className="mt-1 text-sm text-gray-500">Share projects, find collaborators, post opportunities</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-white/[0.04] p-0.5">
            <button
              onClick={() => setView("global")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                view === "global" ? "bg-white/[0.1] text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              🌐 Global
            </button>
            <button
              onClick={() => setView("local")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                view === "local" ? "bg-white/[0.1] text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              📌 My Posts
            </button>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {viewItems.length} posts
          </span>
        </div>
      </motion.div>

      {/* Create Post */}
      {canPost && <CreatePostForm onSubmit={handleCreatePost} submitting={submitting} />}

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between my-5">
        <FilterBar active={filter} onChange={setFilter} counts={counts} />
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-md bg-white/[0.04] py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-gray-600 outline-none transition focus:bg-white/[0.07] sm:w-48"
          />
        </div>
      </div>

      {/* Feed */}
      <div className="divide-y divide-white/[0.06]">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-gray-500">
              {search || filter !== "all" ? "No matching posts found" : "No posts yet — be the first to publish!"}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((item) => (
              <PostCard
                key={item._id}
                item={item}
                onComment={handleComment}
                onCollab={handleCollab}
                onDelete={handleDelete}
                onRewardNFT={handleRewardNFT}
                currentUserId={currentUserId}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
    </>
  );
}

Marketplace.propTypes = {
  role: PropTypes.string.isRequired,
};

export default Marketplace;
