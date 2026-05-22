import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../../shared/hooks/useAuth";
import { useToast } from "../../shared/hooks/useToast";
import { submitVerification, completeOnboarding, getVerificationStatus, reVerify } from "../../shared/services/api";
import SignaturePad from "../../shared/components/SignaturePad";

const ROLE_LABELS = {
  student: { icon: "🎓", label: "Student", gradient: "from-cyan-500 to-purple-500" },
  teacher: { icon: "👨‍🏫", label: "Teacher", gradient: "from-purple-500 to-pink-500" },
  admin: { icon: "🏛️", label: "College Admin", gradient: "from-emerald-500 to-cyan-500" },
};

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

function VerificationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, login } = useAuth();
  const { addToast } = useToast();
  const fileRef = useRef(null);

  const roleFromPath = location.pathname.includes("teacher") ? "teacher" : location.pathname.includes("admin") ? "admin" : "student";
  const role = user?.role || roleFromPath;
  const roleMeta = ROLE_LABELS[role] || ROLE_LABELS.student;

  const [form, setForm] = useState({
    fullName: user?.fullName || user?.name || "",
    collegeName: user?.collegeName || "",
    registrationNumber: "",
    employeeId: "",
    phoneNumber: user?.phone || "",
    collegeEmail: "",
    gmail: user?.gmail || "",
    countryCode: user?.countryCode || "",
  });
  const [collegeIdFile, setCollegeIdFile] = useState(null);
  const [collegeIdPreview, setCollegeIdPreview] = useState(null);
  const [signatureData, setSignatureData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState("loading");
  const [aiResult, setAiResult] = useState(null);
  const [polling, setPolling] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleIdUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      addToast("Only JPG, PNG, and PDF are allowed", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      addToast("File too large. Max 5MB", "error");
      return;
    }
    setCollegeIdFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setCollegeIdPreview(ev.target?.result);
      reader.readAsDataURL(file);
    } else {
      setCollegeIdPreview(null);
    }
  };

  const handleSubmit = async () => {
    if (!form.fullName.trim()) { addToast("Full name is required", "error"); return; }
    if (!form.collegeName.trim()) { addToast("College name is required", "error"); return; }
    if (!form.phoneNumber.trim()) { addToast("Phone number is required", "error"); return; }
    if (!form.countryCode) { addToast("Country code is required", "error"); return; }
    if (role === "student") {
      if (!form.collegeEmail.trim()) { addToast("College email is required", "error"); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.collegeEmail)) { addToast("Must be a valid email address", "error"); return; }
      if (!form.registrationNumber.trim()) { addToast("Registration number is required", "error"); return; }
    }
    if (!collegeIdFile) { addToast("College ID is required", "error"); return; }
    if (!signatureData) { addToast("Please add your signature", "error"); return; }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        addToast("Session expired. Please login again.", "error");
        navigate("/login", { replace: true });
        return;
      }

      const formData = new FormData();
      formData.append("walletAddress", user?.walletAddress || "");
      formData.append("role", role);
      formData.append("fullName", form.fullName);
      formData.append("collegeName", form.collegeName);
      formData.append("phoneNumber", form.phoneNumber);
      formData.append("countryCode", form.countryCode);
      formData.append("collegeEmail", form.collegeEmail);
      formData.append("gmail", form.gmail);
      formData.append("registrationNumber", form.registrationNumber);
      if (role === "teacher") {
        formData.append("employeeId", form.employeeId);
      }
      formData.append("collegeId", collegeIdFile);

      const sigResp = await fetch(signatureData);
      const sigBlob = await sigResp.blob();
      formData.append("signature", sigBlob, "signature.png");

      const result = await submitVerification(formData, token);
      if (result?.token) {
        localStorage.setItem("token", result.token);
      }

      const toastMsg = role === "teacher"
        ? "Application submitted! Waiting for admin approval..."
        : "Verification submitted! AI verification in progress...";
      addToast(toastMsg, "success");
      setStep("submitted");
      setPolling(true);
    } catch (err) {
      addToast(err?.response?.data?.error || err?.message || "Submission failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!polling) return;
    const token = localStorage.getItem("token");
    if (!token) { setPolling(false); return; }

    const interval = setInterval(async () => {
      try {
        const result = await getVerificationStatus(token);
        const status = result?.verificationStatus;
        if (status === "verified" || status === "rejected" || status === "error") {
          setAiResult(result);
          setPolling(false);
          clearInterval(interval);
          if (status === "verified") {
            addToast("Your account has been verified!", "success");
          }
        } else if (status === "pending_approval") {
          setAiResult(result);
        }
      } catch { /* keep polling */ }
    }, 3000);

    return () => clearInterval(interval);
  }, [polling, addToast]);

  useEffect(() => {
    async function checkCurrentStatus() {
      if (!user) { setStep("form"); return; }

      // Admins go to organisation setup
      if (user.role === "admin") {
        navigate("/org-setup", { replace: true });
        return;
      }

      // Already completed → redirect immediately
      if (user.onboardingCompleted) {
        navigate("/", { replace: true });
        return;
      }

      const token = localStorage.getItem("token");
      if (!token) { setStep("form"); return; }

      // Always fetch live status from API (JWT may be stale)
      try {
        const liveStatus = await getVerificationStatus(token);
        const status = liveStatus?.verificationStatus;
        const submitted = liveStatus?.verificationSubmitted;

        if (status === "verified" && liveStatus?.onboardingCompleted) {
          navigate("/", { replace: true });
          return;
        }
        if (status === "verified") {
          setAiResult({ verificationStatus: "verified", ...liveStatus });
          setStep("submitted");
          return;
        }

        if (user.role === "teacher") {
          if (status === "rejected") {
            setAiResult({ verificationStatus: "rejected", verificationError: liveStatus?.verificationError || "Your verification was rejected. Please resubmit documents." });
            setStep("submitted");
            return;
          }
          if (status === "pending_approval") {
            setAiResult({ verificationStatus: "pending_approval", role: "teacher" });
            setStep("submitted");
            setPolling(true);
            return;
          }
          // Teacher hasn't submitted yet or still pending → show form
          setStep("form");
          return;
        }

        // Student: only show submitted/polling if form was actually submitted
        if (status === "rejected" || status === "error") {
          setAiResult({ verificationStatus: status, verificationError: liveStatus?.verificationError || "Verification failed. Please update your details and try again.", checks: liveStatus?.checks });
          setStep("submitted");
          return;
        }
        if (submitted) {
          setStep("submitted");
          setPolling(true);
          return;
        }
        // Not submitted yet → show form (even if status is "pending")
        setStep("form");
      } catch {
        // API call failed, fall back to JWT status
        if (user.role === "teacher") {
          setStep("form");
          return;
        }
        // Student: must check verificationSubmitted before entering submitted/polling
        if (user.verificationStatus === "verified") {
          setAiResult({ verificationStatus: "verified" });
          setStep("submitted");
          return;
        }
        if (user.verificationSubmitted) {
          setStep("submitted");
          setPolling(true);
          return;
        }
        setStep("form");
      }
    }

    checkCurrentStatus();
  }, [user, navigate]);

  const handleRetry = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      addToast("Re-running AI verification...", "info");
      await reVerify(token);
      setAiResult(null);
      setPolling(true);
    } catch {
      addToast("Re-verification failed", "error");
    }
  };

  const handleComplete = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const result = await completeOnboarding(token);
      if (result?.token) {
        localStorage.setItem("token", result.token);
        login(result.token, null);
      }
      navigate("/");
    } catch {
      addToast("Failed to complete setup", "error");
    }
  };

  if (step === "loading") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="flex min-h-screen items-center justify-center px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
          <p className="text-sm text-gray-400">Loading...</p>
        </div>
      </motion.div>
    );
  }

  if (step === "submitted") {
    const isVerifying = polling || (!aiResult && !polling);
    const status = aiResult?.verificationStatus;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-white">Verification Submitted</h2>
          <p className="text-sm text-gray-400 mt-2">Your verification is being processed. We'll notify you once it's complete.</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-md p-6 space-y-5">
          {/* Full Name */}
          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Full Name</label>
            <input name="fullName" value={form.fullName} onChange={handleChange}
              placeholder="John Doe"
              className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]" />
          </div>

          {/* College Name */}
          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">College Name</label>
            <input name="collegeName" value={form.collegeName} onChange={handleChange}
              placeholder="Your college name"
              className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]" />
          </div>

          {/* Student-only fields */}
          {role === "student" && (
            <>
              <div>
                <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Registration Number</label>
                <input name="registrationNumber" value={form.registrationNumber} onChange={handleChange}
                  placeholder="e.g., 2021CS001"
                  className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">College Email</label>
                <input name="collegeEmail" value={form.collegeEmail} onChange={handleChange}
                  placeholder="student@college.edu"
                  className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]" />
                <p className="text-[10px] text-amber-400/80 mt-1">
                  ⚠️ Must match your registered name. If your email name differs, verification will be rejected.
                </p>
              </div>
            </>
          )}

          {/* Teacher & Admin get email field */}
          {(role === "teacher" || role === "admin") && (
            <div>
              <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">College Email</label>
              <input name="collegeEmail" value={form.collegeEmail} onChange={handleChange}
                placeholder={role === "admin" ? "admin@college.edu" : "teacher@college.edu"}
                className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]" />
            </div>
          )}

          {/* Personal Email for notifications (all roles) */}
          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Personal Email (for notifications)</label>
            <input name="gmail" value={form.gmail} onChange={handleChange}
              placeholder="yourname@gmail.com"
              className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]" />
            <p className="text-[10px] text-gray-600 mt-1">
              Verification status updates will be sent here if no college email is available
            </p>
          </div>

          {/* Teacher-only employee ID */}
          {role === "teacher" && (
            <div>
              <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Employee ID</label>
              <input name="employeeId" value={form.employeeId} onChange={handleChange}
                placeholder="e.g., EMP-2024-001"
                className="mt-1 w-full rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]" />
            </div>
          )}

          {/* Phone with Country Code */}
          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Phone Number</label>
            <div className="mt-1 flex gap-2">
              <select name="countryCode" value={form.countryCode} onChange={handleChange}
                className="w-36 rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06] appearance-none cursor-pointer">
                <option value="">Code</option>
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
              <input name="phoneNumber" value={form.phoneNumber} onChange={handleChange}
                placeholder="Phone number"
                className="flex-1 rounded-lg bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition focus:bg-white/[0.06]" />
            </div>
            <p className="text-[10px] text-gray-600 mt-1">
              {role === "student" ? "Used for SMS verification if no email provided" : "For account notifications"}
            </p>
          </div>

          {/* College ID Upload */}
          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">
              {role === "student" ? "College ID Card" : role === "admin" ? "Admin ID / Proof of Employment" : "Teacher ID / Proof of Employment"}
            </label>
            <div className="mt-1">
              <label className="flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed border-white/[0.12] bg-white/[0.02] cursor-pointer hover:border-cyan-500/40 transition">
                <div className="text-2xl mb-1">📄</div>
                <p className="text-xs text-gray-400">Click to upload</p>
                <p className="text-[10px] text-gray-600">JPG, PNG, or PDF — max 5MB</p>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" onChange={handleIdUpload} className="hidden" />
              </label>
              {collegeIdPreview && (
                <div className="mt-2 rounded-lg overflow-hidden border border-white/[0.08]">
                  <img src={collegeIdPreview} alt="ID preview" className="max-h-32 mx-auto" />
                </div>
              )}
              {collegeIdFile && !collegeIdPreview && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2">
                  <span className="text-xs text-gray-400">{collegeIdFile.name}</span>
                  <button type="button" onClick={() => { setCollegeIdFile(null); setCollegeIdPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                    className="ml-auto text-xs text-red-400 hover:text-red-300">Remove</button>
                </div>
              )}
            </div>
          </div>

          {/* Signature */}
          <div>
            <label className="text-[11px] uppercase tracking-widest font-semibold text-gray-500">Signature</label>
            <p className="text-[10px] text-gray-600 mb-2">
              {role === "student" ? "Sign digitally or upload your signature image" : "Your signature confirms the authenticity of your application"}
            </p>
            <SignaturePad onSave={(data) => setSignatureData(data)} />
          </div>

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-3 text-sm font-bold text-white disabled:opacity-50 hover:shadow-lg transition flex items-center justify-center gap-2">
            {submitting ? (
              <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Submitting...</>
            ) : (
              `Submit ${roleMeta.label} Verification`
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default VerificationPage;
