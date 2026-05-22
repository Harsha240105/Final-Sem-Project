import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useToast } from "../hooks/useToast";
import { createAdminAccount } from "../services/api";

function AdminSetup() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    adminSecret: "",
  });

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const validateForm = () => {
    if (!formData.name.trim()) {
      addToast("Name is required", "error");
      return false;
    }
    if (!formData.email.trim()) {
      addToast("Email is required", "error");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      addToast("Valid email is required", "error");
      return false;
    }
    if (formData.password.length < 6) {
      addToast("Password must be at least 6 characters", "error");
      return false;
    }
    if (!formData.adminSecret.trim()) {
      addToast("Admin secret is required", "error");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setLoading(true);
      const response = await createAdminAccount(
        formData.name,
        formData.email,
        formData.password,
        formData.adminSecret
      );

      if (response?.token) {
        localStorage.setItem("token", response.token);
        addToast("Admin account created successfully!", "success");
        setTimeout(() => navigate("/"), 2000);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message;
      addToast(errorMsg || "Failed to create admin account", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <motion.div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/40"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <span className="text-2xl font-black text-white">🔐</span>
          </motion.div>
          <h1 className="text-3xl font-bold text-white">Admin Setup</h1>
          <p className="mt-2 text-sm text-gray-400">Create your first administrator account</p>
        </div>

        {/* Form Container */}
        <motion.form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-white/[0.1] bg-white/[0.03] p-8 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Full Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Enter your name"
              className="w-full rounded-lg border border-white/[0.1] bg-white/[0.05] px-4 py-3 text-white placeholder-gray-500 transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              disabled={loading}
            />
          </div>

          {/* Email Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="admin@example.com"
              className="w-full rounded-lg border border-white/[0.1] bg-white/[0.05] px-4 py-3 text-white placeholder-gray-500 transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              disabled={loading}
            />
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="At least 6 characters"
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.05] px-4 py-3 pr-12 text-white placeholder-gray-500 transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
          </div>

          {/* Admin Secret Field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Admin Secret Key</label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                name="adminSecret"
                value={formData.adminSecret}
                onChange={handleChange}
                placeholder="Enter admin secret from .env"
                className="w-full rounded-lg border border-white/[0.1] bg-white/[0.05] px-4 py-3 pr-12 text-white placeholder-gray-500 transition focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                {showSecret ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Set ADMIN_SECRET in your backend .env file
            </p>
          </div>

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 py-3 font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:shadow-lg hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-white" />
                Creating Admin...
              </span>
            ) : (
              "Create Admin Account"
            )}
          </motion.button>

          {/* Info Box */}
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/30 p-3 text-xs text-blue-200">
            <p className="font-semibold mb-1">ℹ️ Setup Instructions:</p>
            <ol className="list-inside list-decimal space-y-1 text-blue-300/80">
              <li>Set ADMIN_SECRET in backend .env</li>
              <li>Enter the same secret here</li>
              <li>Create your admin account</li>
              <li>You can then approve teachers and manage the platform</li>
            </ol>
          </div>
        </motion.form>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-gray-500">
          Keep this admin account secure. Do not share credentials.
        </p>
      </motion.div>
    </div>
  );
}

export default AdminSetup;
