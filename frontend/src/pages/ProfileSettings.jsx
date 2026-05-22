import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { API_BASE_URL as API_URL, updateProfile, checkUsername, deleteAccount } from "../services/api";

const BASE_URL = API_URL.replace("/api", "");

function ProfileSettings() {
  const { user, login } = useAuth();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    name: "",
    username: "",
    displayName: "",
    bio: "",
    collegeName: "",
    phone: "",
    collegeEmail: "",
    registrationNumber: "",
  });
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);
  const avatarRef = useRef(null);
  const bannerRef = useRef(null);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        username: user.username || "",
        displayName: user.displayName || "",
        bio: user.bio || "",
        collegeName: user.collegeName || "",
        phone: user.phone || user.phoneNumber || "",
        collegeEmail: user.collegeEmail || user.gmail || "",
        registrationNumber: user.registrationNumber || "",
      });
    }
  }, [user]);

  let usernameTimer = useRef(null);
  const handleUsernameChange = (value) => {
    setForm((p) => ({ ...p, username: value }));
    setUsernameAvailable(null);
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    const v = value.trim().toLowerCase();
    if (v.length < 3 || v.length > 20) return;
    setUsernameChecking(true);
    usernameTimer.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await checkUsername(v, token);
        setUsernameAvailable(res.available);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setUsernameChecking(false);
      }
    }, 400);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "username") {
      handleUsernameChange(value);
    } else {
      setForm((p) => ({ ...p, [name]: value }));
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await axios.post(`${API_URL}/user/avatar`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      addToast("Avatar updated!", "success");
    } catch (err) {
      addToast(err?.response?.data?.error || "Failed to upload avatar", "error");
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const fd = new FormData();
      fd.append("banner", file);
      const res = await axios.put(`${API_URL}/user/banner`, fd, {
        headers: { Authorization: `Bearer ${token}` },
      });
      addToast("Banner updated!", "success");
    } catch (err) {
      addToast(err?.response?.data?.error || "Failed to upload banner", "error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) { addToast("Session expired", "error"); return; }
      const res = await updateProfile(form, token);
      if (res.token) {
        localStorage.setItem("token", res.token);
        login(res.token, null);
      }
      addToast("Profile updated!", "success");
    } catch (err) {
      const msg = err?.response?.data?.error || "Failed to update profile";
      addToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-2xl space-y-6 pb-12">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-extrabold text-white">Profile Settings</h1>
        <span className="rounded-full bg-cyan-500/10 border border-cyan-500/20 px-3 py-0.5 text-[10px] text-cyan-400 font-semibold">
          Edit Profile
        </span>
      </div>

      {/* Banner & Avatar */}
      <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent overflow-hidden">
        <div
          className="h-32 bg-gradient-to-r from-purple-600/30 via-indigo-600/20 to-blue-600/30 relative cursor-pointer group"
          onClick={() => bannerRef.current?.click()}
        >
          {bannerPreview && (
            <img src={bannerPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
            <span className="text-xs text-white font-semibold">Change Banner</span>
          </div>
          <input ref={bannerRef} type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
        </div>
        <div className="px-6 pb-6 -mt-10 relative z-10 flex items-end gap-4">
          <div
            className="h-20 w-20 rounded-2xl overflow-hidden ring-4 ring-gray-950 bg-gradient-to-br from-purple-500 to-indigo-500 cursor-pointer group relative flex-shrink-0"
            onClick={() => avatarRef.current?.click()}
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
            ) : user?.avatar ? (
              <img src={`${BASE_URL}${user.avatar}`} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-extrabold text-white">
                {user?.name?.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2)}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition">
              <span className="text-[9px] text-white font-semibold">Edit</span>
            </div>
          </div>
          <div className="pb-1">
            <p className="text-lg font-bold text-white">{form.displayName || form.name || "Your Name"}</p>
            <p className="text-xs text-gray-400">{form.username ? `@${form.username}` : "Set a username"}</p>
          </div>
          <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
        </div>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Full Name</label>
            <input name="name" value={form.name} onChange={handleChange}
              className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:bg-white/[0.06]" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Display Name</label>
            <input name="displayName" value={form.displayName} onChange={handleChange}
              className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:bg-white/[0.06]" />
          </div>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Username</label>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">@</span>
            <input name="username" value={form.username} onChange={handleChange}
              placeholder="username"
              className="w-full rounded-lg bg-white/[0.04] pl-7 pr-10 py-2.5 text-sm text-white outline-none focus:bg-white/[0.06]" />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {usernameChecking && <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />}
              {usernameAvailable === true && <span className="text-emerald-400 text-xs">✓ Available</span>}
              {usernameAvailable === false && <span className="text-red-400 text-xs">✕ Taken</span>}
            </div>
          </div>
          <p className="mt-1 text-[10px] text-gray-600">3-20 characters, lowercase, numbers allowed</p>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Bio</label>
          <textarea name="bio" value={form.bio} onChange={handleChange}
            rows={3} maxLength={500}
            className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:bg-white/[0.06] resize-none" />
          <p className="mt-1 text-[10px] text-gray-600">{form.bio.length}/500</p>
        </div>

        <div className="border-t border-white/[0.06] pt-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Onboarding Information</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">College Name</label>
              <input name="collegeName" value={form.collegeName} onChange={handleChange}
                className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:bg-white/[0.06]" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Phone Number</label>
              <input name="phone" value={form.phone} onChange={handleChange}
                className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:bg-white/[0.06]" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Email</label>
              <input name="collegeEmail" value={form.collegeEmail} onChange={handleChange}
                className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:bg-white/[0.06]" />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Registration Number</label>
              <input name="registrationNumber" value={form.registrationNumber} onChange={handleChange}
                className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:bg-white/[0.06]" />
            </div>
          </div>
          <p className="mt-3 text-[10px] text-yellow-500/70">
            Changing your name, college, or registration number will reset your verification status to pending.
          </p>
        </div>

        <button type="submit" disabled={saving}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-3 text-sm font-bold text-white disabled:opacity-50 hover:shadow-lg transition flex items-center justify-center gap-2">
          {saving ? (
            <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Saving...</>
          ) : "Save Changes"}
        </button>
      </form>

      {/* Delete Account */}
      <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-red-400">Delete Account</h3>
          <p className="text-xs text-gray-500 mt-1">
            Permanently remove your account and personal data. Your NFT certificates will remain on the blockchain.
          </p>
        </div>
        {!showDeleteConfirm ? (
          <button onClick={() => setShowDeleteConfirm(true)}
            className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-sm font-bold text-red-400 hover:bg-red-500/20 transition">
            Delete My Account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-red-400/80">Are you sure? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={async () => {
                setDeleting(true);
                try {
                  const token = localStorage.getItem("token");
                  await deleteAccount(token);
                  localStorage.clear();
                  window.location.href = "/login";
                } catch {
                  addToast("Failed to delete account", "error");
                  setDeleting(false);
                }
              }} disabled={deleting}
                className="rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 hover:bg-red-600 transition">
                {deleting ? "Deleting..." : "Yes, Delete Forever"}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)}
                className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white transition">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default ProfileSettings;
