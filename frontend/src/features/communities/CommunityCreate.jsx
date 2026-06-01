import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/hooks/useAuth";
import { useToast } from "../../shared/hooks/useToast";
import { createCommunityForm } from "../../shared/services/api";

const CATEGORIES = ["Academic", "Technology", "Arts", "Science", "Sports", "Cultural", "Social", "Career", "Other"];

function CommunityCreate() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [privacy, setPrivacy] = useState("open");
  const [communityType, setCommunityType] = useState("");
  const [rules, setRules] = useState("");
  const [colorAccent, setColorAccent] = useState("");
  const [tagsText, setTagsText] = useState("");
  const [linkedSubjectsText, setLinkedSubjectsText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canCreate = user && (user.role === "teacher" || user.role === "community_manager");

  if (!canCreate) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="text-5xl mb-4 opacity-40">🔒</div>
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-sm text-gray-400 mt-2">Only teachers and community managers can create communities.</p>
        <button onClick={() => navigate("/communities")}
          className="mt-6 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-400 transition">
          Back to Communities
        </button>
      </motion.div>
    );
  }

  const handleCreate = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    if (!description.trim()) { setError("Description is required"); return; }
    setError("");
    setSaving(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const formData = new FormData();
      formData.append("name", name.trim());
      formData.append("description", description.trim());
      formData.append("category", category);
      formData.append("privacy", privacy);
      formData.append("communityType", communityType.trim());
      formData.append("rules", rules.trim());
      formData.append("colorAccent", colorAccent.trim());
      formData.append("tags", JSON.stringify(tagsText.split(",").map(t => t.trim()).filter(Boolean)));
      formData.append("linkedSubjects", JSON.stringify(linkedSubjectsText.split(",").map(s => s.trim()).filter(Boolean)));

      if (imageFile) formData.append("image", imageFile);
      if (logoFile) formData.append("logo", logoFile);

      await createCommunityForm(formData, token);
      addToast("Community created!", "success");
      window.dispatchEvent(new Event("communities-updated"));
      navigate("/communities");
    } catch (err) {
      console.error("Create community error:", err);
      addToast(err?.response?.data?.error || "Failed to create community", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6">
        <button onClick={() => navigate("/communities")}
          className="text-xs text-gray-500 hover:text-white transition mb-3 flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Communities
        </button>
        <h1 className="text-2xl font-bold text-white">Create Community</h1>
        <p className="text-sm text-gray-500 mt-1">Set up a new community for collaboration</p>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-6 space-y-4">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]"
            placeholder="Community name" />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            className="w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none resize-none transition focus:bg-white/[0.06]"
            placeholder="Community description" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06] appearance-none cursor-pointer">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Privacy</label>
            <select value={privacy} onChange={(e) => setPrivacy(e.target.value)}
              className="w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06] appearance-none cursor-pointer">
              <option value="open">Open</option>
              <option value="approval">Approval Required</option>
              <option value="invite">Invite Only</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Community Type</label>
            <input value={communityType} onChange={(e) => setCommunityType(e.target.value)}
              className="w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]"
              placeholder="e.g. Study Group" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Color Accent</label>
            <input value={colorAccent} onChange={(e) => setColorAccent(e.target.value)}
              className="w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]"
              placeholder="e.g. #7B61FF" />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Tags (comma-separated)</label>
          <input value={tagsText} onChange={(e) => setTagsText(e.target.value)}
            className="w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]"
            placeholder="tag1, tag2, tag3" />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Linked Subjects (comma-separated)</label>
          <input value={linkedSubjectsText} onChange={(e) => setLinkedSubjectsText(e.target.value)}
            className="w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]"
            placeholder="subject1, subject2" />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Rules</label>
          <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={3}
            className="w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none resize-none transition focus:bg-white/[0.06]"
            placeholder="Community rules..." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Banner Image</label>
            <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-cyan-500/10 file:text-cyan-400" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Logo</label>
            <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-cyan-500/10 file:text-cyan-400" />
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => navigate("/communities")}
            className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-gray-300 transition hover:bg-white/[0.04]">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Community"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default CommunityCreate;
