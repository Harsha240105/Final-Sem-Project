import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { setupOrganisation, getOrganisationStatus } from "../services/api";

const ORG_TYPES = [
  { value: "school", label: "School" },
  { value: "college", label: "College" },
  { value: "university", label: "University" },
  { value: "other", label: "Other" },
];

const COUNTRY_CODES = [
  { code: "+1", label: "US/Canada +1" },
  { code: "+44", label: "UK +44" },
  { code: "+91", label: "India +91" },
  { code: "+61", label: "Australia +61" },
  { code: "+81", label: "Japan +81" },
  { code: "+86", label: "China +86" },
  { code: "+49", label: "Germany +49" },
  { code: "+33", label: "France +33" },
  { code: "+82", label: "South Korea +82" },
  { code: "+971", label: "UAE +971" },
  { code: "+55", label: "Brazil +55" },
  { code: "+7", label: "Russia +7" },
  { code: "+92", label: "Pakistan +92" },
  { code: "+880", label: "Bangladesh +880" },
  { code: "+234", label: "Nigeria +234" },
  { code: "+254", label: "Kenya +254" },
  { code: "+27", label: "South Africa +27" },
  { code: "+52", label: "Mexico +52" },
  { code: "+39", label: "Italy +39" },
  { code: "+34", label: "Spain +34" },
];

function OrganisationSetup() {
  const navigate = useNavigate();
  const { user, login, refreshUser } = useAuth();
  const { addToast } = useToast();
  const logoRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    type: "",
    address: "",
    registrationNumber: "",
    phone: "",
    countryCode: "",
    email: "",
    website: "",
  });

  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      addToast("Only JPG, PNG, and WebP are allowed", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast("File too large. Max 5MB", "error");
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      addToast("Organisation name is required", "error");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        addToast("Session expired. Please login again.", "error");
        navigate("/login", { replace: true });
        return;
      }

      const payload = { ...form };
      const result = await setupOrganisation(payload, token);
      if (result?.token) {
        localStorage.setItem("token", result.token);
        login(result.token, null);
      } else {
        await refreshUser();
      }
      addToast("Organisation setup complete!", "success");
      navigate("/", { replace: true });
    } catch (err) {
      addToast(err?.response?.data?.error || err?.message || "Setup failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    async function checkStatus() {
      if (!user) {
        setLoading(false);
        return;
      }

      if (user.role !== "admin") {
        navigate("/", { replace: true });
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const status = await getOrganisationStatus(token);
        if (status?.data?.completed) {
          if (!user?.onboardingCompleted) {
            await refreshUser();
          }
          navigate("/", { replace: true });
          return;
        }
        if (status?.data?.organisation) {
          const org = status.data.organisation;
          setForm({
            name: org.name || "",
            type: org.type || "",
            address: org.address || "",
            registrationNumber: org.registrationNumber || "",
            phone: org.phone || "",
            countryCode: org.countryCode || "",
            email: org.email || "",
            website: org.website || "",
          });
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
  }, [user, navigate]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex min-h-screen items-center justify-center px-4"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-screen items-center justify-center px-4 py-8"
    >
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 shadow-lg shadow-emerald-500/30 mb-4">
            <span className="text-3xl">🏛️</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Organisation Setup</h1>
          <p className="text-sm text-gray-400 mt-1">
            Tell us about your organisation to complete your admin account
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-6 space-y-5">
          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">
              Organisation Name <span className="text-red-400">*</span>
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g., MIT, Stanford University"
              className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Organisation Type</label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06] appearance-none cursor-pointer"
            >
              <option value="">Select type</option>
              {ORG_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Address</label>
            <textarea
              name="address"
              value={form.address}
              onChange={handleChange}
              placeholder="Street, city, country"
              rows={2}
              className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06] resize-none"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Registration / License Number</label>
            <input
              name="registrationNumber"
              value={form.registrationNumber}
              onChange={handleChange}
              placeholder="e.g., ORG-2024-001"
              className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Phone Number</label>
            <div className="mt-1 flex gap-2">
              <select
                name="countryCode"
                value={form.countryCode}
                onChange={handleChange}
                className="w-36 rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06] appearance-none cursor-pointer"
              >
                <option value="">Code</option>
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="Phone number"
                className="flex-1 rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Organisation Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="admin@organisation.edu"
              className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Website</label>
            <input
              name="website"
              value={form.website}
              onChange={handleChange}
              placeholder="https://example.edu"
              className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]"
            />
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Organisation Logo</label>
            <div className="mt-1">
              <label className="flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed border-white/[0.12] bg-white/[0.02] cursor-pointer hover:border-emerald-500/40 transition">
                <div className="text-2xl mb-1">🏢</div>
                <p className="text-xs text-gray-400">Click to upload logo</p>
                <p className="text-[10px] text-gray-600">JPG, PNG, or WebP — max 5MB</p>
                <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoUpload} className="hidden" />
              </label>
              {logoPreview && (
                <div className="mt-2 rounded-lg overflow-hidden border border-white/[0.08]">
                  <img src={logoPreview} alt="Logo preview" className="max-h-32 mx-auto" />
                </div>
              )}
            </div>
          </div>

          <motion.button
            onClick={handleSubmit}
            disabled={submitting}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-50 hover:shadow-lg transition flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Saving...</>
            ) : (
              "Complete Setup"
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default OrganisationSetup;
