import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../shared/hooks/useAuth";
import { useToast } from "../../shared/hooks/useToast";
import {
  getCollabPosts, createCollabPost, addCollabComment,
  requestCollab, updateCollabStatus, updateProjectStatus,
  deleteCollabPost,
  createWorkspace, getWorkspace, sendWorkspaceMessage,
  addWorkspaceTask, updateWorkspaceTask, inviteToWorkspace,
} from "../../shared/services/api";
import ProjectCard from "./components/ProjectCard";
import ProjectFilters from "./components/ProjectFilters";
import CollaborationStatus from "./components/CollaborationStatus";
import RecruitmentPanel from "./components/RecruitmentPanel";
import WorkspacePanel from "./components/WorkspacePanel";
import { POST_TYPE_META, STATUS_META } from "./utils";

function Marketplace() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("feed");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceMsg, setWorkspaceMsg] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [formData, setFormData] = useState({
    title: "", description: "", goals: "", postType: "open_collaboration",
    requiredRoles: [], skills: "", tags: "",
  });

  const fetchPosts = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const params = {};
      if (filters.postType) params.postType = filters.postType;
      if (filters.status) params.status = filters.status;
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

  useEffect(() => {
    setLoading(true);
    fetchPosts();
  }, [fetchPosts]);

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
        title: formData.title.trim(), description: formData.description.trim(),
        goals: formData.goals.trim(), postType: formData.postType,
        requiredRoles, skills, tags,
      }, token);
      addToast("Project created!", "success");
      setShowCreate(false);
      setFormData({ title: "", description: "", goals: "", postType: "open_collaboration", requiredRoles: [], skills: "", tags: "" });
      fetchPosts();
    } catch (err) {
      addToast(err.message || "Failed to create", "error");
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !selectedPost) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const updated = await addCollabComment(selectedPost._id, commentText.trim(), token);
      setCommentText("");
      setSelectedPost(updated);
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
      setWorkspace(null);
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
      setWorkspace(null);
      fetchPosts();
    } catch { addToast("Failed to delete", "error"); }
  };

  const handleCreateWorkspace = async () => {
    if (!selectedPost) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const room = await createWorkspace(selectedPost._id, { name: `${selectedPost.title} Workspace` }, token);
      setWorkspace(room);
      addToast("Workspace created!", "success");
    } catch (err) { addToast(err.message || "Failed to create workspace", "error"); }
  };

  const handleLoadWorkspace = async () => {
    if (!selectedPost) return;
    setWorkspaceLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const room = await getWorkspace(selectedPost._id, token);
      setWorkspace(room);
    } catch { setWorkspace(null); }
    finally { setWorkspaceLoading(false); }
  };

  const handleSendWorkspaceMsg = async () => {
    if (!workspaceMsg.trim() || !selectedPost) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const updated = await sendWorkspaceMessage(selectedPost._id, "general", workspaceMsg.trim(), token);
      setWorkspace(updated);
      setWorkspaceMsg("");
    } catch { addToast("Failed to send", "error"); }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || !selectedPost) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const updated = await addWorkspaceTask(selectedPost._id, { title: newTaskTitle.trim() }, token);
      setWorkspace(updated);
      setNewTaskTitle("");
    } catch { addToast("Failed to add task", "error"); }
  };

  const handleUpdateTask = async (taskId, status) => {
    if (!selectedPost) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const updated = await updateWorkspaceTask(selectedPost._id, taskId, status, token);
      if (updated) {
        const room = await getWorkspace(selectedPost._id, token);
        setWorkspace(room);
      }
    } catch { addToast("Failed to update task", "error"); }
  };

  const openPost = useCallback(async (post) => {
    setSelectedPost(post);
    setWorkspace(null);
    setWorkspaceLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const room = await getWorkspace(post._id, token);
      setWorkspace(room);
    } catch { setWorkspace(null); }
    finally { setWorkspaceLoading(false); }
  }, []);

  // ── Strict client-side filter (safety net) ──
  const filtered = useMemo(() => {
    let result = posts;
    if (filters.postType) {
      result = result.filter(p => p.postType === filters.postType);
    }
    if (filters.status) {
      result = result.filter(p => p.status === filters.status);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.skills?.some(s => s.toLowerCase().includes(q))
      );
    }
    return result;
  }, [posts, filters, search]);

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

  const hasAcceptedCollabs = selectedPost && (selectedPost.collaborators || []).some(c => c.status === "accepted");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Collaboration Hub</h1>
            <p className="text-sm text-slate-400 mt-0.5">Find teammates, join projects, build together</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCreate(!showCreate)} className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-400 transition">
              {showCreate ? "Cancel" : "+ New Project"}
            </button>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="mb-4 rounded-lg border border-slate-700/50 bg-slate-800/30 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} placeholder="Project title *" className="col-span-2 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/40" />
            <textarea value={formData.description} onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))} placeholder="Description *" className="col-span-2 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 outline-none resize-none focus:border-cyan-500/40" rows={3} />
            <textarea value={formData.goals} onChange={e => setFormData(prev => ({ ...prev, goals: e.target.value }))} placeholder="Goals / objectives" className="col-span-2 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 outline-none resize-none focus:border-cyan-500/40" rows={2} />
            <select value={formData.postType} onChange={e => setFormData(prev => ({ ...prev, postType: e.target.value }))} className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/40">
              <option value="looking_for_dev">💻 Looking for Developer</option>
              <option value="looking_for_designer">🎨 Looking for Designer</option>
              <option value="open_collaboration">🤝 Open Collaboration</option>
              <option value="research_project">🔬 Research Project</option>
              <option value="community_recruitment">🌐 Community Recruitment</option>
            </select>
            <input value={formData.skills} onChange={e => setFormData(prev => ({ ...prev, skills: e.target.value }))} placeholder="Skills (comma-separated)" className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/40" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 font-medium">Required Roles</span>
              <button onClick={addRole} className="text-[10px] text-cyan-400 hover:text-cyan-300">+ Add Role</button>
            </div>
            {formData.requiredRoles.map((role, i) => (
              <div key={i} className="flex items-center gap-2 mb-1">
                <input value={role.role} onChange={e => updateRole(i, "role", e.target.value)} placeholder="Role name" className="flex-1 rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/40" />
                <input type="number" min={1} value={role.count} onChange={e => updateRole(i, "count", parseInt(e.target.value) || 1)} className="w-14 rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-1.5 text-xs text-slate-200 outline-none text-center" />
                <button onClick={() => removeRole(i)} className="text-xs text-red-400 hover:text-red-300">✕</button>
              </div>
            ))}
          </div>
          <input value={formData.tags} onChange={e => setFormData(prev => ({ ...prev, tags: e.target.value }))} placeholder="Tags (comma-separated)" className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/40" />
          <div className="flex gap-2">
            <button onClick={handleCreate} className="rounded-lg bg-cyan-500 px-5 py-2 text-sm font-semibold text-white hover:bg-cyan-400 transition">Create Project</button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg border border-slate-700 px-5 py-2 text-sm text-slate-400 hover:text-white transition">Cancel</button>
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => { setView("feed"); setFilters({}); }} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${view === "feed" ? "bg-cyan-500/10 text-cyan-400" : "text-slate-500 hover:text-white"}`}>Feed</button>
        <button onClick={() => setView("my")} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${view === "my" ? "bg-cyan-500/10 text-cyan-400" : "text-slate-500 hover:text-white"}`}>My Projects</button>
      </div>

      <div className="mb-4 space-y-2">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects, skills..." className="w-full rounded-lg border border-slate-700/50 bg-slate-900/30 pl-10 pr-4 py-2 text-sm text-slate-200 outline-none focus:border-cyan-500/40 transition" />
        </div>
        <ProjectFilters filters={filters} onChange={setFilters} />
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-40 rounded-lg bg-slate-800/20 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-700/30 bg-slate-900/20 py-16 text-center">
          <p className="text-base font-semibold text-slate-300">No projects found</p>
          <p className="text-sm text-slate-500 mt-1">Create a project or adjust filters</p>
        </div>
      ) : (
        <>
          {selectedPost && (
            <div className="mb-4 rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white">{selectedPost.title}</h2>
                    <span className="text-xs text-slate-500">{POST_TYPE_META[selectedPost.postType]?.icon} {POST_TYPE_META[selectedPost.postType]?.label || selectedPost.postType}</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{selectedPost.description}</p>
                  {selectedPost.goals && <p className="text-xs text-slate-500 mt-1">{selectedPost.goals}</p>}
                </div>
                <button onClick={() => { setSelectedPost(null); setWorkspace(null); }} className="text-slate-500 hover:text-white ml-3">✕</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <CollaborationStatus post={selectedPost} />
                <RecruitmentPanel post={selectedPost} currentUserId={user?.id} onRequest={() => handleRequest(selectedPost._id)} onAccept={(cid) => handleCollabAction(selectedPost._id, cid, "accepted")} onReject={(cid) => handleCollabAction(selectedPost._id, cid, "rejected")} requesting={requesting} />

                {selectedPost.createdBy?._id === user?.id && (
                  <div className="rounded-lg border border-slate-700/30 bg-slate-900/20 p-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Controls</h4>
                    <div className="space-y-2">
                      <select value={selectedPost.status} onChange={e => handleStatusChange(selectedPost._id, e.target.value)} className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-1.5 text-xs text-slate-200 outline-none">
                        <option value="recruiting">Recruiting</option>
                        <option value="active">Active</option>
                        <option value="reviewing">Reviewing</option>
                        <option value="completed">Completed</option>
                        <option value="archived">Archived</option>
                      </select>
                      {hasAcceptedCollabs && !workspace && (
                        <button onClick={handleCreateWorkspace} className="w-full rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-400 transition">
                          + Create Workspace
                        </button>
                      )}
                      <button onClick={() => handleDelete(selectedPost._id)} className="w-full rounded-lg border border-red-500/20 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition">Delete</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Discussion */}
              <div className="rounded-lg border border-slate-700/30 bg-slate-900/20 p-3 mb-3">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Discussion ({selectedPost.comments?.length || 0})</h4>
                <div className="max-h-32 overflow-y-auto space-y-1.5 mb-2">
                  {(selectedPost.comments || []).slice(-10).map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className="h-4 w-4 shrink-0 rounded-full bg-cyan-500/20 flex items-center justify-center text-[7px] font-bold text-white">{c.author?.name?.[0]?.toUpperCase() || "?"}</div>
                      <div><span className="font-medium text-slate-300">{c.author?.name}: </span><span className="text-slate-500">{c.text}</span></div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleComment(); } }} placeholder="Add a comment..." className="flex-1 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500/40" />
                  <button onClick={handleComment} className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-400 transition">Send</button>
                </div>
              </div>

              {/* Workspace */}
              {workspaceLoading ? (
                <div className="rounded-lg border border-slate-700/30 bg-slate-900/20 p-6 text-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400 mx-auto" />
                </div>
              ) : workspace ? (
                <WorkspacePanel
                  workspace={workspace}
                  workspaceMsg={workspaceMsg}
                  onMsgChange={setWorkspaceMsg}
                  onSendMsg={handleSendWorkspaceMsg}
                  newTaskTitle={newTaskTitle}
                  onTaskTitleChange={setNewTaskTitle}
                  onAddTask={handleAddTask}
                  onUpdateTask={handleUpdateTask}
                  currentUserId={user?.id}
                />
              ) : selectedPost.createdBy?._id === user?.id && hasAcceptedCollabs && (
                <div className="rounded-lg border border-slate-700/30 bg-slate-900/20 p-4 text-center">
                  <p className="text-sm text-slate-400 mb-2">Create a workspace to start collaborating</p>
                  <button onClick={handleCreateWorkspace} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 transition">
                    + Create Workspace
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(post => (
              <ProjectCard key={post._id} post={post} onOpen={openPost} isSelected={selectedPost?._id === post._id} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Marketplace;
