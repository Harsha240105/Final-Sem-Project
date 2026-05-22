import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { getPendingTeachers, approveTeacher, rejectTeacher, createAccountByAdmin, API_SERVER_ORIGIN } from "../services/api";

const STATUS_BADGE = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  pending_approval: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  verified: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/10 text-red-400 border-red-500/30",
};

const STATUS_LABELS = {
  pending: "Pending Registration",
  pending_approval: "Awaiting Approval",
  verified: "Verified",
  approved: "Approved",
  rejected: "Rejected",
};

function AdminPanel() {
  const { token } = useAuth();
  const { addToast } = useToast();
  const [tab, setTab] = useState("pending");
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  // Create teacher form state
  const [createForm, setCreateForm] = useState({ name: "", email: "", walletAddress: "", collegeName: "", phone: "", role: "student" });
  const [creatingTeacher, setCreatingTeacher] = useState(false);

  const handleCreateFormChange = (field) => (e) => {
    setCreateForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) {
      addToast("Teacher name is required", "error");
      return;
    }
    setCreatingTeacher(true);
    try {
      await createAccountByAdmin(createForm, token);
      addToast("Teacher created and pending approval", "success");
      setCreateForm({ name: "", email: "", walletAddress: "", collegeName: "", phone: "", role: "student" });
      fetchTeachers();
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to create teacher", "error");
    } finally {
      setCreatingTeacher(false);
    }
  };

  const fetchTeachers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPendingTeachers(token);
      setTeachers(res.data || []);
    } catch {
      addToast("Failed to load pending teachers", "error");
    } finally {
      setLoading(false);
    }
  }, [token, addToast]);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      await approveTeacher(id, token);
      addToast("Teacher approved successfully", "success");
      setSelectedTeacher(null);
      fetchTeachers();
    } catch {
      addToast("Failed to approve teacher", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    setActionLoading(id);
    try {
      await rejectTeacher(id, token);
      addToast("Teacher application rejected", "info");
      setSelectedTeacher(null);
      fetchTeachers();
    } catch {
      addToast("Failed to reject teacher", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const imgSrc = (path) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return `${API_SERVER_ORIGIN}${path}`;
  };

  return (
    <div className="max-w-5xl mx-auto py-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <p className="text-sm text-gray-400 mt-1">Manage teachers and platform settings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1 w-fit">
        <button
          onClick={() => setTab("pending")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition ${tab === "pending" ? "bg-cyan-500/20 text-cyan-300" : "text-gray-400 hover:text-white"}`}
        >
          Pending Approvals ({teachers.length})
        </button>
        <button
          onClick={() => setTab("create")}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition ${tab === "create" ? "bg-cyan-500/20 text-cyan-300" : "text-gray-400 hover:text-white"}`}
        >
          Create Teacher
        </button>
      </div>

      {tab === "pending" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
              <p className="text-2xl font-bold text-cyan-400">{teachers.length}</p>
              <p className="text-xs text-gray-500 mt-1">Pending Teachers</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
              <p className="text-2xl font-bold text-purple-400">{teachers.filter(t => t.source === "user" || t.source === "teacher").length}</p>
              <p className="text-xs text-gray-500 mt-1">Wallet-Registered</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
              <p className="text-2xl font-bold text-emerald-400">{teachers.filter(t => t.source === "admin").length}</p>
              <p className="text-xs text-gray-500 mt-1">Email-Registered</p>
            </div>
          </div>
        </div>
      )}

      {tab === "create" && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Create Account</h2>
          <p className="text-xs text-gray-400 mb-6">Create a new account. Teachers need admin approval. Students and admins are created with immediate access.</p>
          <form onSubmit={handleCreateTeacher} className="space-y-4 max-w-xl">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Role</label>
              <select
                value={createForm.role}
                onChange={handleCreateFormChange("role")}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50"
              >
                <option value="student" className="bg-gray-900">Student</option>
                <option value="teacher" className="bg-gray-900">Teacher (needs approval)</option>
                <option value="admin" className="bg-gray-900">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Name *</label>
              <input
                type="text"
                value={createForm.name}
                onChange={handleCreateFormChange("name")}
                placeholder="Full name"
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={handleCreateFormChange("email")}
                  placeholder="user@college.edu"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Wallet Address</label>
                <input
                  type="text"
                  value={createForm.walletAddress}
                  onChange={handleCreateFormChange("walletAddress")}
                  placeholder="0x..."
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">College / Institution</label>
                <input
                  type="text"
                  value={createForm.collegeName}
                  onChange={handleCreateFormChange("collegeName")}
                  placeholder="College name"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Phone</label>
                <input
                  type="text"
                  value={createForm.phone}
                  onChange={handleCreateFormChange("phone")}
                  placeholder="Phone number"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            </div>
            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
              <p className="text-xs text-amber-400">
                {createForm.role === "teacher"
                  ? "Teacher will be created with pending approval. Another admin must approve them."
                  : createForm.role === "admin"
                    ? "Admin will be created and must complete organisation setup at /org-setup before accessing the dashboard."
                    : "Student will be created with immediate access."}
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <motion.button
                type="submit"
                disabled={creatingTeacher}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50 hover:shadow-lg transition"
              >
                {creatingTeacher ? "Creating..." : `Create ${createForm.role === "teacher" ? "Teacher" : createForm.role === "admin" ? "Admin" : "Student"}`}
              </motion.button>
              <motion.button
                type="button"
                onClick={() => { setCreateForm({ name: "", email: "", walletAddress: "", collegeName: "", phone: "", role: "student" }); }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-xl border border-white/10 px-6 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/[0.06] transition"
              >
                Clear
              </motion.button>
            </div>
          </form>
        </div>
      )}

      {/* Teacher Detail Modal */}
      <AnimatePresence>
        {selectedTeacher && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
            onClick={() => setSelectedTeacher(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-gray-950 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-lg font-bold text-white">
                    {(selectedTeacher.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white">{selectedTeacher.name || "Unnamed"}</h2>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_BADGE[selectedTeacher.verificationStatus] || STATUS_BADGE.pending}`}>
                      {STATUS_LABELS[selectedTeacher.verificationStatus] || "Pending"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTeacher(null)}
                  className="text-gray-500 hover:text-white transition text-xl leading-none"
                >✕</button>
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Wallet</p>
                  <p className="text-sm font-mono text-white truncate mt-1">{selectedTeacher.walletAddress || "—"}</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">College</p>
                  <p className="text-sm text-white mt-1">{selectedTeacher.collegeName || "—"}</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Email</p>
                  <p className="text-sm text-white mt-1 truncate">{selectedTeacher.collegeEmail || selectedTeacher.gmail || "—"}</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Phone</p>
                  <p className="text-sm text-white mt-1">{selectedTeacher.countryCode || ""} {selectedTeacher.phone || "—"}</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Employee ID</p>
                  <p className="text-sm text-white mt-1">{selectedTeacher.employeeId || "—"}</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Full Name</p>
                  <p className="text-sm text-white mt-1">{selectedTeacher.fullName || selectedTeacher.name || "—"}</p>
                </div>
              </div>

              {/* ID Image */}
              {selectedTeacher.collegeIdImage && (
                <div className="mb-4">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">College ID</p>
                  <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.02]">
                    <img
                      src={imgSrc(selectedTeacher.collegeIdImage)}
                      alt="College ID"
                      className="max-h-64 mx-auto object-contain"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  </div>
                </div>
              )}

              {/* Signature Image */}
              {selectedTeacher.signatureImage && (
                <div className="mb-6">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Signature</p>
                  <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.02] p-4">
                    <img
                      src={imgSrc(selectedTeacher.signatureImage)}
                      alt="Signature"
                      className="max-h-20 mx-auto object-contain"
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  </div>
                </div>
              )}

              {/* No form data notice */}
              {!selectedTeacher.collegeIdImage && !selectedTeacher.signatureImage && (
                <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 mb-6 text-center">
                  <p className="text-xs text-amber-400">No form data submitted yet. Teacher registered but hasn't filled the verification form.</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-white/[0.06]">
                <motion.button
                  onClick={() => handleApprove(selectedTeacher._id)}
                  disabled={actionLoading === selectedTeacher._id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 hover:shadow-lg transition"
                >
                  {actionLoading === selectedTeacher._id ? "Processing..." : "Approve Teacher"}
                </motion.button>
                <motion.button
                  onClick={() => handleReject(selectedTeacher._id)}
                  disabled={actionLoading === selectedTeacher._id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-red-500 to-red-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50 hover:shadow-lg transition"
                >
                  Reject
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AdminPanel;
