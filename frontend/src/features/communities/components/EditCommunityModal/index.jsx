import { useState } from "react";
import { motion } from "framer-motion";
import { useToast } from "../../../../shared/hooks/useToast";
import { updateCommunity } from "../../../../shared/services/api";

const CATEGORIES = ["Academic", "Technology", "Arts", "Science", "Sports", "Cultural", "Social", "Career", "Other"];

export default function EditCommunityModal({ community, onClose, onSaved }) {
  const { addToast } = useToast();
  const [name, setName] = useState(community.name || "");
  const [description, setDescription] = useState(community.description || "");
  const [category, setCategory] = useState(community.category || "Other");
  const [privacy, setPrivacy] = useState(community.privacy || "open");
  const [communityType, setCommunityType] = useState(community.communityType || "");
  const [rules, setRules] = useState(community.rules || "");
  const [colorAccent, setColorAccent] = useState(community.colorAccent || "");
  const [tagsText, setTagsText] = useState((community.tags || []).join(", "));
  const [linkedSubjectsText, setLinkedSubjectsText] = useState((community.linkedSubjects || []).join(", "));
  const [imageFile, setImageFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
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

      await updateCommunity(community._id, formData, token);
      addToast("Community updated!", "success");
      onSaved();
    } catch (err) {
      console.error("Edit community error:", err);
      addToast(err?.response?.data?.error || "Failed to update community", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 px-4 py-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg rounded-xl border border-white/[0.08] bg-gray-950 p-6 shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">Edit Community</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40" placeholder="Community name" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none resize-none focus:border-cyan-500/40" placeholder="Community description" />
          </div>

          {/* Category + Privacy row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Privacy</label>
              <select value={privacy} onChange={(e) => setPrivacy(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40">
                <option value="open">Open</option>
                <option value="approval">Approval Required</option>
                <option value="invite">Invite Only</option>
              </select>
            </div>
          </div>

          {/* Community Type + Color Accent row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Community Type</label>
              <input value={communityType} onChange={(e) => setCommunityType(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40" placeholder="e.g. Study Group" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Color Accent</label>
              <input value={colorAccent} onChange={(e) => setColorAccent(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40" placeholder="e.g. #7B61FF" />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Tags (comma-separated)</label>
            <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40" placeholder="tag1, tag2, tag3" />
          </div>

          {/* Linked Subjects */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Linked Subjects (comma-separated)</label>
            <input value={linkedSubjectsText} onChange={(e) => setLinkedSubjectsText(e.target.value)} className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500/40" placeholder="subject1, subject2" />
          </div>

          {/* Rules */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Rules</label>
            <textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={3} className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white outline-none resize-none focus:border-cyan-500/40" placeholder="Community rules..." />
          </div>

          {/* Image + Logo uploads row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Banner Image</label>
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="w-full text-xs text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-cyan-500/10 file:text-cyan-400" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Logo</label>
              <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="w-full text-xs text-gray-400 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-cyan-500/10 file:text-cyan-400" />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm text-gray-300 transition hover:bg-white/[0.04]">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-cyan-500/20 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}