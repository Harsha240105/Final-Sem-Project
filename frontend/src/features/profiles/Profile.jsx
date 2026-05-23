import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../shared/hooks/useAuth";
import { useWallet } from "../../shared/hooks/useWallet";
import { useToast } from "../../shared/hooks/useToast";
import { API_BASE_URL as API_URL, getCurrentUser, uploadAvatar, removeAvatar as apiRemoveAvatar, saveWalletAddress } from "../../shared/services/api";
import VerifiedBadge from "../../shared/components/VerifiedBadge";
import { useNavigate } from "react-router-dom";
const BASE_URL = API_URL.replace("/api", "");

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function isVideoUrl(url) {
  return /\.(mp4|webm)(\?|$)/i.test(url);
}

/* ── Avatar Upload Modal ─────────────────────────────── */
function AvatarUploadModal({ onClose, onUpload, uploading }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [validating, setValidating] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm"];
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB

  const isVideo = (type) => /^video\//.test(type);

  const handleFileSelect = async (file) => {
    setError("");
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only JPG, PNG, GIF, WEBP, MP4 and WebM formats are allowed.");
      setSelectedFile(null);
      setPreview(null);
      return;
    }

    if (file.size > MAX_SIZE) {
      setError(`File is too large (${formatFileSize(file.size)}). Maximum size is 50MB.`);
      setSelectedFile(null);
      setPreview(null);
      return;
    }

    if (isVideo(file.type)) {
      setValidating(true);
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        if (video.duration < 10) {
          setError("Video must be at least 10 seconds long.");
          setSelectedFile(null);
          setPreview(null);
          setValidating(false);
          return;
        }
        if (video.duration > 30) {
          setError("Video must be 30 seconds or less.");
          setSelectedFile(null);
          setPreview(null);
          setValidating(false);
          return;
        }
        setSelectedFile(file);
        setPreview(URL.createObjectURL(file));
        setValidating(false);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        setError("Could not read video file. Try a different file.");
        setSelectedFile(null);
        setPreview(null);
        setValidating(false);
      };
      video.src = url;
      return;
    }

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = () => {
    if (!selectedFile) return;
    onUpload(selectedFile);
  };

  const previewIsVideo = selectedFile && isVideo(selectedFile.type);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-sm rounded-xl bg-gray-950 border border-white/[0.08] p-5 shadow-2xl"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white">Upload Avatar</h2>
        <p className="mt-1 text-xs text-gray-500">Profile picture, GIF, or short video</p>

        {/* Requirements */}
        <div className="mt-4 rounded-lg bg-white/[0.03] px-3 py-2.5 space-y-1">
          <p className="text-[11px] text-gray-400 font-medium">Requirements:</p>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span className="text-purple-400">•</span> Formats: JPG, PNG, GIF, WEBP, MP4, WebM
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span className="text-purple-400">•</span> Max size: 50MB
          </div>
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span className="text-purple-400">•</span> Videos: 10–30 seconds (audio muted)
          </div>
        </div>

        {/* Preview */}
        {preview && !validating && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="h-24 w-24 rounded-xl overflow-hidden ring-2 ring-white/10 bg-black">
              {previewIsVideo ? (
                <video ref={videoRef} src={preview} muted autoPlay loop playsInline className="h-full w-full object-cover" />
              ) : (
                <img src={preview} alt="Preview" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="max-w-[120px] truncate">{selectedFile?.name}</span>
              <span className="text-gray-600">·</span>
              <span className={selectedFile?.size > MAX_SIZE ? "text-red-400" : "text-emerald-400"}>
                {formatFileSize(selectedFile?.size || 0)}
              </span>
            </div>
          </div>
        )}

        {validating && (
          <div className="mt-4 flex items-center justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
            <span className="ml-3 text-xs text-gray-400">Validating video...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* File input */}
        <div className="mt-4">
          {!preview || validating ? (
            <label className="flex h-28 cursor-pointer items-center justify-center rounded-lg border border-dashed border-white/10 bg-white/[0.02] transition hover:border-purple-500/30 hover:bg-white/[0.04]">
              <div className="text-center">
                <svg className="mx-auto h-8 w-8 text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                <p className="mt-1 text-xs text-gray-500">Click to select image or video</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
            </label>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setPreview(null);
                setError("");
              }}
              className="w-full rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 transition hover:text-white hover:border-white/20"
            >
              Choose different file
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-400 transition hover:text-white">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedFile || uploading || validating}
            className="rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-purple-500/20 disabled:opacity-40"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Profile Page ────────────────────────────────────── */
function Profile() {
  const { user, logout } = useAuth();
  const { account, networkName, connectWallet, disconnectWallet, isMetaMaskInstalled, isConnecting } = useWallet();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [removingWallet, setRemovingWallet] = useState(false);
  const [walletAddressStored, setWalletAddressStored] = useState(null);

  const isConnected = Boolean(account);
  const shortenAddress = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;

  const fetchUser = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getCurrentUser(token);
      if (data?.avatar) {
        setAvatarUrl(`${BASE_URL}${data.avatar}`);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Load stored wallet address from user profile
  useEffect(() => {
    if (user?.walletAddress) {
      setWalletAddressStored(user.walletAddress);
    }
  }, [user?.walletAddress]);

  const handleUploadAvatar = async (file) => {
    const token = localStorage.getItem("token");
    if (!token) {
      addToast("You must be logged in", "error");
      return;
    }
    try {
      setUploading(true);
      const data = await uploadAvatar(file, token);
      const newAvatar = `${BASE_URL}${data.avatar}`;
      setAvatarUrl(newAvatar);
      setShowUploadModal(false);
      addToast("Avatar updated!", "success");
      window.dispatchEvent(new CustomEvent("avatar-updated", { detail: { avatar: data.avatar } }));
    } catch (err) {
      console.error("Avatar upload error:", err);
      addToast(err?.response?.data?.error || "Failed to upload avatar", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      await apiRemoveAvatar(token);
      setAvatarUrl(null);
      addToast("Avatar removed", "success");
      window.dispatchEvent(new CustomEvent("avatar-updated", { detail: { avatar: null } }));
    } catch (err) {
      addToast("Failed to remove avatar", "error");
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    addToast("Logged out successfully", "success");
  };

  // Save wallet address to database
  const saveWalletToDatabase = async (walletAddress) => {
    const token = localStorage.getItem("token");
    if (!token) {
      addToast("You must be logged in", "error");
      return false;
    }

    try {
      await saveWalletAddress(walletAddress, token);
      setWalletAddressStored(walletAddress);
      addToast("Wallet saved and connected!", "success");
      return true;
    } catch (err) {
      console.error("Wallet save error:", err);
      addToast(err?.response?.data?.message || "Failed to save wallet", "error");
      return false;
    }
  };

  // Remove wallet from database
  const removeWalletFromDatabase = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      addToast("You must be logged in", "error");
      return false;
    }

    try {
      setRemovingWallet(true);
      await saveWalletAddress(null, token);
      setWalletAddressStored(null);
      disconnectWallet(); // Disconnect from MetaMask locally
      addToast("Wallet disconnected and removed from account", "success");
      return true;
    } catch (err) {
      console.error("Wallet removal error:", err);
      addToast(err.response?.data?.message || "Failed to remove wallet", "error");
      return false;
    } finally {
      setRemovingWallet(false);
    }
  };

  // Handle connect wallet - save to database after successful connection
  const handleConnectWallet = async () => {
    try {
      const connectedAccount = await connectWallet();
      if (connectedAccount) {
        await saveWalletToDatabase(connectedAccount);
        fetchUser();
      }
    } catch (err) {
      console.error("Wallet connection error:", err);
      addToast("Failed to connect wallet", "error");
    }
  };

  if (!user) return null;

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.06 } } };
  const itemVariants = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  return (
    <motion.div initial="hidden" animate="visible" variants={containerVariants} className="mx-auto max-w-4xl space-y-6">
      {/* ── Profile Header ── */}
      <motion.div variants={itemVariants} className="rounded-xl border border-white/[0.08] bg-gradient-to-r from-white/[0.06] to-transparent backdrop-blur-md overflow-hidden">
        <div className="h-28 bg-gradient-to-r from-purple-600/30 via-indigo-600/20 to-blue-600/30 relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djJIMjR2LTJIMTJ2LTJoMTJ2LTJoLTEydi0yaDEydi0ySDEyVjIyaDEyVjIwSDEydi0yaDEydi0ySDEyVjE0aDI0djJIMjR2Mmg2djJIMjR2Mmg2djJIMjR2Mmg2djJIMjR2Mmg2djJIMjR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        </div>

        <div className="px-6 pb-6 -mt-12 relative z-10">
          <div className="flex flex-wrap items-end gap-5">
            {/* Avatar */}
            <div className="relative group">
              <motion.div
                className="h-24 w-24 rounded-2xl overflow-hidden ring-4 ring-gray-950 shadow-xl cursor-pointer"
                whileHover={{ scale: 1.05 }}
                onClick={() => setShowUploadModal(true)}
              >
                {avatarUrl ? (
                  isVideoUrl(avatarUrl) ? (
                    <video src={avatarUrl} muted autoPlay loop playsInline className="h-full w-full object-cover" />
                  ) : (
                    <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" onError={() => setAvatarUrl(null)} />
                  )
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-500 to-indigo-500 text-2xl font-extrabold text-white">
                    {getInitials(user.name)}
                  </div>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  <span className="mt-1 text-[10px] font-semibold text-white">Change</span>
                </div>
              </motion.div>
              {avatarUrl && (
                <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} onClick={handleRemoveAvatar}
                  className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white text-xs shadow-lg hover:bg-red-400 transition z-10"
                  whileTap={{ scale: 0.85 }}>✕</motion.button>
              )}
            </div>

            {/* Name & Info */}
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-2xl font-extrabold text-white">{user.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-400">{user.gmail}</span>
                <span className="inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-purple-300 capitalize">{user.role}</span>
                {user?.verificationStatus && <VerifiedBadge status={user.verificationStatus} role={user.role} />}
              </div>
            </div>

            {/* Upload hint (click) */}
            <button onClick={() => setShowUploadModal(true)} className="hidden sm:flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 transition hover:border-purple-500/30 hover:text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              Upload Avatar
            </button>
            <button onClick={() => navigate("/settings/profile")} className="hidden sm:flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-gray-400 transition hover:border-cyan-500/30 hover:text-cyan-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              Edit Profile
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Account & Wallet ── */}
      <motion.div className="grid gap-5 md:grid-cols-2" variants={containerVariants}>
        <motion.div className="glass-card-premium p-5" variants={itemVariants}>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="text-lg">📋</span> Account Information
          </h2>
          <div className="mt-5 space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Full Name</p>
              <p className="mt-1.5 text-white font-medium">{user.name}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Email</p>
              <p className="mt-1.5 break-all text-white font-medium">{user.gmail}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Role</p>
              <div className="mt-1.5 inline-flex items-center gap-2">
                <span className="inline-flex items-center rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-sm font-semibold text-purple-300 capitalize">{user.role}</span>
                {user?.verificationStatus && <VerifiedBadge status={user.verificationStatus} role={user.role} />}
              </div>
            </div>
            {(user.institutionType || user.institutionName) && (
              <div>
                <p className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Institution</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {user.institutionType && (
                    <span className="inline-flex items-center rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300 capitalize">
                      {user.institutionType}
                    </span>
                  )}
                  {user.institutionName && (
                    <span className="text-sm font-medium text-white">{user.institutionName}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        <motion.div className="glass-card-premium p-5" variants={itemVariants}>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span className="text-lg">🔗</span> Wallet Connection
          </h2>
          <div className="mt-5 space-y-4">
            {isConnected && walletAddressStored === account ? (
              <>
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-emerald-400">✓ Wallet Connected & Saved</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Connected Address</p>
                  <p className="mt-1.5 font-mono text-white font-medium text-sm">{shortenAddress(account)}</p>
                  <p className="mt-2 text-[10px] text-gray-500">Full: {account}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Network</p>
                  <p className="mt-1.5 text-white font-medium">{networkName}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <motion.button 
                    type="button" 
                    onClick={removeWalletFromDatabase} 
                    disabled={removingWallet}
                    className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition disabled:opacity-50" 
                    whileHover={{ borderColor: "rgba(239, 68, 68, 0.6)", backgroundColor: "rgba(239, 68, 68, 0.15)" }} 
                    whileTap={{ scale: 0.96 }}
                  >
                    {removingWallet ? "Disconnecting..." : "Disconnect & Remove"}
                  </motion.button>
                  <motion.button 
                    type="button" 
                    onClick={handleConnectWallet}
                    disabled={isConnecting}
                    className="flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50" 
                    whileHover={{ scale: 1.02 }} 
                    whileTap={{ scale: 0.96 }}
                  >
                    {isConnecting ? "Switching..." : "Switch Wallet"}
                  </motion.button>
                </div>
              </>
            ) : walletAddressStored ? (
              <>
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                  <p className="text-[10px] uppercase tracking-widest font-semibold text-yellow-400">⚠ Wallet Saved But Not Connected in Browser</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Saved Address</p>
                  <p className="mt-1.5 font-mono text-white font-medium text-sm">{shortenAddress(walletAddressStored)}</p>
                </div>
                <p className="text-xs text-gray-400">Your wallet is saved to your account. Connect MetaMask to access it.</p>
                <motion.button 
                  type="button" 
                  onClick={handleConnectWallet} 
                  disabled={!isMetaMaskInstalled || isConnecting}
                  className="mt-4 w-full rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 font-semibold text-white shadow-lg shadow-purple-500/30 transition disabled:cursor-not-allowed disabled:opacity-50" 
                  whileHover={{ scale: 1.04, boxShadow: "0 12px 32px rgba(139, 92, 246, 0.4)" }} 
                  whileTap={{ scale: 0.96 }}
                >
                  {isConnecting ? "Connecting..." : "Connect Saved Wallet"}
                </motion.button>
                <motion.button 
                  type="button" 
                  onClick={removeWalletFromDatabase}
                  disabled={removingWallet}
                  className="w-full rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition disabled:opacity-50" 
                  whileHover={{ borderColor: "rgba(239, 68, 68, 0.6)", backgroundColor: "rgba(239, 68, 68, 0.15)" }} 
                  whileTap={{ scale: 0.96 }}
                >
                  {removingWallet ? "Removing..." : "Remove Saved Wallet"}
                </motion.button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-400">No wallet connected yet</p>
                <motion.button 
                  type="button" 
                  onClick={handleConnectWallet} 
                  disabled={!isMetaMaskInstalled || isConnecting} 
                  className="mt-4 w-full rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 font-semibold text-white shadow-lg shadow-purple-500/30 transition disabled:cursor-not-allowed disabled:opacity-50" 
                  whileHover={{ scale: 1.04, boxShadow: "0 12px 32px rgba(139, 92, 246, 0.4)" }} 
                  whileTap={{ scale: 0.96 }}
                >
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </motion.button>
                {!isMetaMaskInstalled && <p className="text-xs text-gray-500">MetaMask not detected. Install it to connect your wallet.</p>}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* ── Logout ── */}
      <motion.div className="glass-card-premium p-5" variants={itemVariants}>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <span className="text-lg">⚙️</span> Account Actions
        </h2>
        <AnimatePresence mode="wait">
          {showLogoutConfirm ? (
            <motion.div key="confirm" className="mt-4 space-y-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <p className="text-sm text-gray-300">Are you sure you want to logout?</p>
              <div className="flex gap-3">
                <motion.button type="button" onClick={handleLogout} className="flex-1 rounded-lg bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/30" whileTap={{ scale: 0.96 }}>Confirm Logout</motion.button>
                <motion.button type="button" onClick={() => setShowLogoutConfirm(false)} className="flex-1 rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition hover:border-gray-600" whileTap={{ scale: 0.96 }}>Cancel</motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.button key="btn" type="button" onClick={() => setShowLogoutConfirm(true)} className="mt-4 w-full rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition hover:border-red-500/40 hover:text-red-300" whileTap={{ scale: 0.96 }}>Logout</motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Avatar Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <AvatarUploadModal
            onClose={() => setShowUploadModal(false)}
            onUpload={handleUploadAvatar}
            uploading={uploading}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default Profile;
