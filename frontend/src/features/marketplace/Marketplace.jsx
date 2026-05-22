import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../shared/hooks/useAuth";
import { useToast } from "../../shared/hooks/useToast";
import {
  getCollabPosts,
  createCollabPost,
  addCollabComment,
  requestCollab,
  updateCollabStatus,
  updateProjectStatus,
  publishCollabShowcase,
  getMyCollabPosts,
  getMyCollabRequests,
  deleteCollabPost,
} from "../../shared/services/api";
import ProjectCard from "./components/ProjectCard";
import ProjectFilters from "./components/ProjectFilters";
import CollaborationStatus from "./components/CollaborationStatus";
import RecruitmentPanel from "./components/RecruitmentPanel";
import { POST_TYPE_META, STATUS_META } from "./utils";

const POST_TYPE_OPTIONS = [
  { value: "looking_for_dev", label: "Looking for Developer", icon: "💻" },
  { value: "looking_for_designer", label: "Looking for Designer", icon: "🎨" },
  { value: "open_collaboration", label: "Open Collaboration", icon: "🤝" },
  { value: "research_project", label: "Research Project", icon: "🔬" },
  { value: "community_recruitment", label: "Community Recruitment", icon: "🌐" },
];

function Marketplace() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("feed");
  const [filters, setFilters] = useState({});
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    goals: "",
    postType: "open_collaboration",
    requiredRoles: [],
    skills: "",
    tags: "",
  });

  const fetchPosts = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const params = { ...filters };
      if (view === "my") params.my = "true";
      const data = await getCollabPosts(token, params);
      setPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
      addToast("Failed to load projects", "error");
    } finally {
      setLoading(false);
    }
  }, [filters, view, addToast]);

  const fetchMyPosts = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getMyCollabPosts(token);
      setPosts(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    if (view === "feed" || view === "my") {
      if (view === "my") fetchMyPosts().finally(() => setLoading(false));
      else fetchPosts();
    }
  }, [view, fetchPosts, fetchMyPosts]);

  useEffect(() => {
    const handler = () => fetchPosts();
    window.addEventListener("collab-updated", handler);
    return () => window.removeEventListener("collab-updated", handler);
  }, [fetchPosts]);

  const handleCreate = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      addToast("Title and description are required", "error");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const skills = formData.skills ? formData.skills.split(",").map(s => s.trim()).filter(Boolean) : [];
      const tags = formData.tags ? formData.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      const requiredRoles = formData.requiredRoles.filter(r => r.role?.trim());
      await createCollabPost({
        title: formData.title.trim(),
        description: formData.description.trim(),
        goals: formData.goals.trim(),
        postType: formData.postType,
        requiredRoles,
        skills,
        tags,
      }, token);
      addToast("Project created!", "success");
      setShowCreate(false);
      setFormData({ title: "", description: "", goals: "", postType: "open_collaboration", requiredRoles: [], skills: "", tags: "" });
      fetchPosts();
    } catch (err) {
      addToast(err.message || "Failed to create", "error");
    }
  };

  const handleComment = async (postId) => {
    if (!commentText.trim()) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const updated = await addCollabComment(postId, commentText.trim(), token);
      setCommentText("");
      if (selectedPost?._id === postId) setSelectedPost(updated);
      window.dispatchEvent(new Event("collab-updated"));
    } catch { addToast("Failed to comment", "error"); }
  };

  const handleRequest = async (postId) => {
    setRequesting(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const updated = await requestCollab(postId, token);
      if (selectedPost?._id === postId) setSelectedPost(updated);
      addToast("Request sent!", "success");
      fetchPosts();
    } catch (err) { addToast(err.message || "Failed to request", "error"); }
    finally { setRequesting(false); }
  };

  const handleCollabAction = async (postId, collabId, action) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const updated = await updateCollabStatus(postId, collabId, action, token);
      if (selectedPost?._id === postId) setSelectedPost(updated);
      fetchPosts();
    } catch { addToast("Failed to update", "error"); }
  };

  const handleStatusChange = async (postId, status) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const updated = await updateProjectStatus(postId, status, token);
      if (selectedPost?._id === postId) setSelectedPost(updated);
      fetchPosts();
    } catch { addToast("Failed to update status", "error"); }
  };

  const handleDelete = async (postId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await deleteCollabPost(postId, token);
      addToast("Post deleted", "success");
      setSelectedPost(null);
      fetchPosts();
    } catch { addToast("Failed to delete", "error"); }
  };

  const addRole = () => {
    setFormData(prev => ({ ...prev, requiredRoles: [...prev.requiredRoles, { role: "", count: 1, skills: [], filled: false }] }));
  };

  const updateRole = (index, field, value) => {
    const roles = [...formData.requiredRoles];
    roles[index] = { ...roles[index], [field]: value };
    setFormData(prev => ({ ...prev, requiredRoles: roles }));
  };

  const removeRole = (index) => {
    setFormData(prev => ({ ...prev, requiredRoles: prev.requiredRoles.filter((_, i) => i !== index) }));
  };

  const filtered = posts.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.title?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q) || p.skills?.some(s => s.toLowerCase().includes(q));
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Collaboration Hub</h1>
            <p className="text-sm text-gray-500 mt-1">Find teammates, join projects, build together</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="shrink-0 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white hover:shadow-lg hover:shadow-cyan-500/20 transition">
            {showCreate ? "Cancel" : "+ New Project"}
          </button>
        </div>
      </motion.div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="Project title *" className="col-span-2 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40" />
                <textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Description *" className="col-span-2 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none resize-none focus:border-cyan-500/40" rows={3} />
                <textarea value={formData.goals} onChange={e => setFormData(prev => ({ ...prev, goals: e.target.value }))} placeholder="Goals / objectives" className="col-span-2 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none resize-none focus:border-cyan-500/40" rows={2} />
                <select value={formData.postType} onChange={e => setFormData(prev => ({ ...prev, postType: e.target.value }))} className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40">
                  {POST_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}
                </select>
                <input value={formData.skills} onChange={e => setFormData(prev => ({ ...prev, skills: e.target.value }))} placeholder="Skills (comma-separated)" className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40" />
              </div>

              {/* Roles */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-gray-500 font-medium">Required Roles</span>
                  <button onClick={addRole} className="text-[10px] text-cyan-400 hover:text-cyan-300">+ Add Role</button>
                </div>
                {formData.requiredRoles.map((role, i) => (
                  <div key={i} className="flex items-center gap-2 mb-1">
                    <input value={role.role} onChange={e => updateRole(i, "role", e.target.value)} placeholder="Role name" className="flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500/40" />
                    <input type="number" min={1} value={role.count} onChange={e => updateRole(i, "count", parseInt(e.target.value) || 1)} className="w-14 rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5 text-xs text-white outline-none focus:border-cyan-500/40 text-center" />
                    <button onClick={() => removeRole(i)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                  </div>
                ))}
              </div>

              <input value={formData.tags} onChange={e => setFormData(prev => ({ ...prev, tags: e.target.value }))} placeholder="Tags (comma-separated)" className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40" />

              <div className="flex gap-2">
                <button onClick={handleCreate} className="rounded-lg bg-cyan-500 px-5 py-2 text-sm font-semibold text-white hover:bg-cyan-400 transition">Create Project</button>
                <button onClick={() => setShowCreate(false)} className="rounded-lg border border-white/[0.08] px-5 py-2 text-sm text-gray-400 hover:text-white transition">Cancel</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View Tabs */}
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => setView("feed")} className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition ${view === "feed" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-gray-500 hover:text-white border border-transparent"}`}>📋 Feed</button>
        <button onClick={() => setView("my")} className={`rounded-lg px-3 py-1.5 text-[10px] font-medium transition ${view === "my" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" : "text-gray-500 hover:text-white border border-transparent"}`}>👤 My Projects</button>
      </div>

      {/* Search + Filters */}
      <div className="mb-4 space-y-2">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects, skills, or teams..." className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-cyan-500/40 transition" />
        </div>
        <ProjectFilters filters={filters} onChange={setFilters} />
      </div>

      {/* Loading / Empty / Grid */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-44 rounded-xl shimmer-skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02] py-16 text-center">
          <div className="text-4xl mb-3 opacity-30">🤝</div>
          <p className="text-lg font-bold text-white">No projects found</p>
          <p className="text-sm text-gray-500 mt-1">Create a project or adjust filters</p>
        </motion.div>
      ) : (
        <>
          {/* Detail panel */}
          <AnimatePresence>
            {selectedPost && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedPost.title}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedPost.description}</p>
                    {selectedPost.goals && <p className="text-[10px] text-gray-600 mt-1">{selectedPost.goals}</p>}
                  </div>
                  <button onClick={() => setSelectedPost(null)} className="text-gray-600 hover:text-white text-lg">✕</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <CollaborationStatus post={selectedPost} />
                  <RecruitmentPanel post={selectedPost} currentUserId={user?.id} onRequest={() => handleRequest(selectedPost._id)} onAccept={(cid) => handleCollabAction(selectedPost._id, cid, "accepted")} onReject={(cid) => handleCollabAction(selectedPost._id, cid, "rejected")} requesting={requesting} />

                  {/* Owner controls */}
                  {selectedPost.createdBy?._id === user?.id && (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Controls</h4>
                      <div className="space-y-1.5">
                        <select value={selectedPost.status} onChange={e => handleStatusChange(selectedPost._id, e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1.5 text-[10px] text-white outline-none">
                          <option value="recruiting">Recruiting</option>
                          <option value="active">Active</option>
                          <option value="reviewing">Reviewing</option>
                          <option value="completed">Completed</option>
                          <option value="archived">Archived</option>
                        </select>
                        <button onClick={() => handleDelete(selectedPost._id)} className="w-full rounded-lg border border-red-500/20 px-3 py-1.5 text-[9px] text-red-400 hover:bg-red-500/10 transition">Delete Post</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Comments */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Discussion ({selectedPost.comments?.length || 0})</h4>
                  <div className="max-h-32 overflow-y-auto space-y-1.5 mb-2 scrollbar-thin">
                    {(selectedPost.comments || []).slice(-10).map((c, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <div className="h-4 w-4 shrink-0 rounded-full bg-cyan-500/20 flex items-center justify-center text-[7px] font-bold text-white">{c.author?.name?.[0]?.toUpperCase() || "?"}</div>
                        <div><span className="font-medium text-gray-300">{c.author?.name}: </span><span className="text-gray-500">{c.text}</span></div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleComment(selectedPost._id); } }} placeholder="Add a comment..." className="flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/40" />
                    <button onClick={() => handleComment(selectedPost._id)} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-400 transition">Send</button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {filtered.map(post => (
                <ProjectCard key={post._id} post={post} onOpen={setSelectedPost} />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

export default Marketplace;
