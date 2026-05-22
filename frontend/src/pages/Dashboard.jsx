import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { useWallet } from "../hooks/useWallet";
import {
  API_BASE_URL as API_URL,
  getMyTasks,
  getNotifications,
  getUserCertificates,
  getDashboardConnectionStats,
} from "../services/api";
import VerifiedBadge from "../components/VerifiedBadge";
import ParticleField from "../components/ParticleField";
import RevealOnScroll from "../components/RevealOnScroll";
import ActivityFeed from "../components/ActivityFeed";
import WalletNFTStatus from "../components/WalletNFTStatus";
import { useSocket } from "../context/SocketContext";
import { Award, Trophy, Building2, Medal, CheckCircle, ChevronLeft, ChevronRight, Bell } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import PropTypes from "prop-types";

const BASE_URL = API_URL.replace(/\/api\/?$/, "");
const POLYGON_EXPLORER = "https://amoy.polygonscan.com";

function getInitials(name) {
  return name ? name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "?";
}

function shortenAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function normalizeTaskCertificate(certificate) {
  const status = certificate?.status || "issued";
  const statusMap = {
    claimed: "Completed",
    completed: "Completed",
    issued: "Pending Claim",
    failed: "Failed",
    tx_submitted: "Processing",
  };
  return {
    id: `task-${certificate?.certificateId || certificate?.tokenId || "na"}`,
    title: certificate?.communityName || "Community Certificate",
    category: certificate?.collegeName || "Community Task",
    reference: certificate?.certificateId || "On-chain certificate",
    detail: certificate?.tokenId ? `Token #${certificate.tokenId}` : "Awaiting token id",
    sourceLabel: "Community",
    statusLabel: statusMap[status] || "Pending",
    accent: "from-purple-500/20 to-indigo-500/10 border-purple-500/20",
    verifyPath: certificate?.certificateId ? `/verify/${certificate.certificateId}` : null,
    explorerUrl: certificate?.txHash ? `${POLYGON_EXPLORER}/tx/${certificate.txHash}` : null,
    issuedAt: certificate?.mintedAt || certificate?.issuedAt || null,
  };
}

function DashSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-52 rounded-xl shimmer-skeleton" />
        <div className="h-52 rounded-xl shimmer-skeleton" />
      </div>
      <div className="h-40 rounded-xl shimmer-skeleton" />
    </div>
  );
}

function AnimatedCount({ value, suffix = "" }) {
  const [display, setDisplay] = useState(0);
  const animRef = useRef(null);

  useEffect(() => {
    const start = display;
    const end = value;
    const duration = 700;
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(start + (end - start) * eased));
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [value]);

  return <span>{display}{suffix}</span>;
}

function Dashboard({ role }) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { account, networkName, connectWallet, disconnectWallet, isConnecting, isMetaMaskInstalled } = useWallet();
  const { connected, liveActivities } = useSocket();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [myTasks, setMyTasks] = useState([]);
  const [myNFTs, setMyNFTs] = useState([]);
  const [notificationPreview, setNotificationPreview] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [connectionStats, setConnectionStats] = useState({ followers: 0, following: 0, mutual: 0 });
  const [lastSynced, setLastSynced] = useState(null);
  const [syncingNFTs, setSyncingNFTs] = useState(false);
  const [liveVerificationStatus, setLiveVerificationStatus] = useState(null);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const nftScrollRef = useRef(null);

  const scrollNFT = useCallback((dir) => {
    if (nftScrollRef.current) {
      nftScrollRef.current.scrollBy({ left: dir * 240, behavior: "smooth" });
    }
  }, []);

  const getCurrentUserId = useCallback(() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      return JSON.parse(atob(token.split(".")[1])).id || null;
    } catch { return null; }
  }, []);

  const currentUserId = getCurrentUserId();

  const fetchAvatar = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const { data: u } = await axios.get(`${API_URL}/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (u.avatar) setAvatarUrl(`${BASE_URL}${u.avatar}?t=${Date.now()}`);
      else setAvatarUrl(null);
      if (u.verificationStatus) {
        setLiveVerificationStatus(u.verificationStatus);
      }
    } catch { /* silent */ }
  }, []);

  const checkVerificationStatus = useCallback(async () => {
    try {
      setCheckingVerification(true);
      const token = localStorage.getItem("token");
      if (!token) return;
      const { data } = await axios.get(`${API_URL}/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (data?.verificationStatus) {
        setLiveVerificationStatus(data.verificationStatus);
        if (data.verificationStatus === "verified") {
          addToast("Your account is verified!", "success");
        }
      }
    } catch {
      addToast("Failed to check verification status", "error");
    } finally {
      setCheckingVerification(false);
    }
  }, [addToast]);

  const handleReVerify = useCallback(async () => {
    try {
      setCheckingVerification(true);
      const token = localStorage.getItem("token");
      if (!token) return;
      const { data } = await axios.post(`${API_URL}/verify/re-verify`, {}, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000,
      });
      if (data?.token) {
        localStorage.setItem("token", data.token);
        window.dispatchEvent(new CustomEvent("auth-changed"));
      }
      if (data?.result?.verified) {
        setLiveVerificationStatus("verified");
        addToast("Verification successful!", "success");
      } else if (data?.result?.verified === false) {
        setLiveVerificationStatus("rejected");
        addToast("Verification failed. Please re-submit your details.", "error");
      } else {
        setLiveVerificationStatus("pending");
        addToast("Verification re-submitted. Check back shortly.", "info");
      }
    } catch (err) {
      addToast(err.response?.data?.error || "Re-verification failed", "error");
    } finally {
      setCheckingVerification(false);
    }
  }, [addToast]);

  const fetchMyTasks = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getMyTasks(token);
      setMyTasks(data || []);
    } catch { /* silent */ }
  }, []);

  const fetchMyNFTs = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const taskCertificateResponse = await getUserCertificates(token);
      const taskCertificates = Array.isArray(taskCertificateResponse) ? taskCertificateResponse : [];
      setMyNFTs(taskCertificates.map(normalizeTaskCertificate).sort((a, b) => new Date(b?.issuedAt || 0) - new Date(a?.issuedAt || 0)));
      setLastSynced(new Date());
    } catch { /* silent */ }
  }, []);

  const handleManualSyncNFTs = useCallback(async () => {
    try {
      setSyncingNFTs(true);
      const token = localStorage.getItem("token");
      if (!token) return;
      const { syncCertificateStatus } = await import("../services/api");
      const synced = await syncCertificateStatus(token);
      const taskCertificates = Array.isArray(synced) ? synced : [];
      setMyNFTs(taskCertificates.map(normalizeTaskCertificate).sort((a, b) => new Date(b?.issuedAt || 0) - new Date(a?.issuedAt || 0)));
      setLastSynced(new Date());
      addToast("Certificates synced with blockchain", "success");
    } catch {
      addToast("Sync failed, using cached data", "warning");
    } finally {
      setSyncingNFTs(false);
    }
  }, [addToast]);

  const fetchNotificationPreview = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getNotifications(token);
      setNotificationPreview((data.notifications || []).slice(0, 4));
    } catch {
      setNotificationPreview([]);
    }
  }, []);

  const fetchCommunities = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await axios.get(`${API_URL}/communities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCommunities(res.data || []);
    } catch { /* silent */ }
  }, []);

  const fetchConnectionStats = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getDashboardConnectionStats(token);
      setConnectionStats(data.stats || { followers: 0, following: 0, mutual: 0 });
    } catch { /* silent */ }
  }, []);

  const handleRemoveWallet = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        addToast("You must be logged in", "error");
        return;
      }
      await axios.put(
        `${API_URL}/user/wallet`,
        { walletAddress: null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      disconnectWallet();
      addToast("Wallet removed from this account", "success");
      window.dispatchEvent(new CustomEvent("wallet-updated"));
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to remove wallet", "error");
    }
  }, [addToast, disconnectWallet]);

  useEffect(() => {
    fetchAvatar();
    const timer = setTimeout(() => {
      fetchCommunities();
      fetchMyTasks();
      fetchMyNFTs();
      fetchNotificationPreview();
      fetchConnectionStats();
    }, 0);

    const taskInterval = setInterval(fetchMyTasks, 15000);
    const nftInterval = setInterval(fetchMyNFTs, 25000);
    const connInterval = setInterval(fetchConnectionStats, 30000);
    const verifyInterval = setInterval(fetchAvatar, 15000);

    const onAvatarUpdate = () => fetchAvatar();
    const onDashboardRefresh = () => { fetchMyTasks(); fetchMyNFTs(); fetchNotificationPreview(); fetchConnectionStats(); };
    const onCertificatesRefresh = () => fetchMyNFTs();

    window.addEventListener("avatar-updated", onAvatarUpdate);
    window.addEventListener("dashboard-updated", onDashboardRefresh);
    window.addEventListener("certificates-updated", onCertificatesRefresh);

    setLoading(false);
    return () => {
      clearTimeout(timer);
      clearInterval(taskInterval);
      clearInterval(nftInterval);
      clearInterval(connInterval);
      clearInterval(verifyInterval);
      window.removeEventListener("avatar-updated", onAvatarUpdate);
      window.removeEventListener("dashboard-updated", onDashboardRefresh);
      window.removeEventListener("certificates-updated", onCertificatesRefresh);
    };
  }, [fetchAvatar, fetchCommunities, fetchMyNFTs, fetchMyTasks, fetchNotificationPreview, fetchConnectionStats]);

  const completedTasksCount = myTasks.filter(t => t.completed_status).length;
  const totalTasksCount = myTasks.length;
  const taskProgress = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;
  const chartData = totalTasksCount > 0
    ? [
        { name: "Completed", value: completedTasksCount, color: "#00FFA3" },
        { name: "Pending", value: totalTasksCount - completedTasksCount, color: "#FFD166" },
      ]
    : [{ name: "No tasks", value: 1, color: "#374151" }];

  const joinedCommunities = communities.filter((c) =>
    c.members?.some((m) => {
      const memberId = m?._id || m;
      return memberId?.toString() === currentUserId?.toString();
    })
  );

  const fade = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } };
  const stagger = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.04 } } };

  return (
    <>
      <ParticleField count={30} color="cyan" />
      <motion.div initial="hidden" animate="visible" variants={stagger} className="relative z-10 mx-auto max-w-7xl space-y-6 overflow-visible">

      {/* ═══ DESCRIPTION ═══ */}
      <RevealOnScroll>
        <div className="glass-card-premium p-6 text-center">
          <p className="text-base text-gray-300 leading-relaxed max-w-3xl mx-auto">
            Blockchain Enabled Virtual Campus is a decentralized platform for students, teachers, and communities to collaborate, complete tasks, and earn blockchain NFT certificates.
          </p>
        </div>
      </RevealOnScroll>

      {/* ═══ BIO CARD ═══ */}
      <RevealOnScroll delay={80}>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="glass-card-premium overflow-hidden holographic">
            <div className="h-24 bg-gradient-to-r from-cyan-600/25 via-purple-600/15 to-pink-600/25 relative">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#050816]/60" />
            </div>
            <div className="px-5 pb-5 -mt-10 relative z-10">
              <div className="flex items-end gap-4">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user?.name} className="h-16 w-16 rounded-2xl object-cover ring-4 ring-[#050816] shadow-lg shadow-cyan-500/20" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-500 text-xl font-extrabold text-white ring-4 ring-[#050816] shadow-lg shadow-cyan-500/20">
                    {getInitials(user?.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0 pb-0.5">
                  <h2 className="text-xl font-extrabold text-white truncate">{user?.name}</h2>
                  <p className="text-xs text-gray-400">{user?.gmail}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-green-300 shrink-0">
                  <span className="pulse-dot" /> Online
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/[0.04] p-2.5 text-center group hover:bg-cyan-500/5 transition">
                  <p className="text-lg font-bold text-cyan-400"><AnimatedCount value={joinedCommunities.length} /></p>
                  <p className="text-[10px] text-gray-500 font-medium">Communities</p>
                </div>
                <div className="rounded-lg bg-white/[0.04] p-2.5 text-center group hover:bg-green-500/5 transition">
                  <p className="text-lg font-bold text-green-400"><AnimatedCount value={connectionStats.followers} /></p>
                  <p className="text-[10px] text-gray-500 font-medium">Followers</p>
                </div>
                <div className="rounded-lg bg-white/[0.04] p-2.5 text-center group hover:bg-purple-500/5 transition">
                  <p className="text-lg font-bold text-purple-400"><AnimatedCount value={myNFTs.length} /></p>
                  <p className="text-[10px] text-gray-500 font-medium">Certificates</p>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                  <p className="text-sm font-bold text-pink-400"><AnimatedCount value={connectionStats.following} /></p>
                  <p className="text-[9px] text-gray-500 font-medium">Following</p>
                </div>
                <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                  <p className="text-sm font-bold text-yellow-400"><AnimatedCount value={connectionStats.mutual} /></p>
                  <p className="text-[9px] text-gray-500 font-medium">Mutual</p>
                </div>
              </div>

            <div className="mt-3 rounded-lg bg-white/[0.03] px-3 py-2.5 flex items-center justify-between border border-white/[0.06]">
              {account ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                      <svg className="h-3.5 w-3.5 text-cyan-300" viewBox="0 0 24 24" fill="none" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 110-6h.75a2.25 2.25 0 012.25 2.25" /></svg>
                    </div>
                    <span className="text-xs font-mono text-white">{shortenAddress(account)}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-gray-500">{networkName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveWallet}
                    className="ml-3 rounded-md border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold text-red-300 transition hover:bg-red-500/20 hover:shadow-[0_0_12px_rgba(255,77,109,0.2)]"
                  >
                    Remove Wallet
                  </button>
                </>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs text-gray-500">{isMetaMaskInstalled ? "Wallet not connected" : "MetaMask not detected"}</span>
                  {isMetaMaskInstalled && (
                    <motion.button onClick={connectWallet} disabled={isConnecting}
                      className="rounded-md bg-gradient-to-r from-cyan-500 to-purple-500 px-3 py-1 text-[10px] font-bold text-white shadow-lg shadow-cyan-500/20 disabled:opacity-50 hover:shadow-cyan-500/30"
                      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      {isConnecting ? "..." : "Connect"}
                    </motion.button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 capitalize">
                {role === "admin" ? "Admin" : role === "community_manager" ? "Community Manager" : role === "teacher" ? "Teacher" : "Student"}
              </span>
              {(liveVerificationStatus || user?.verificationStatus) && (
                <VerifiedBadge status={liveVerificationStatus || user?.verificationStatus} role={role} />
              )}
              {(liveVerificationStatus === "pending" || user?.verificationStatus === "pending") && (
                <>
                  <button
                    type="button"
                    onClick={checkVerificationStatus}
                    disabled={checkingVerification}
                    className="inline-flex items-center rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-300 transition hover:bg-yellow-500/20 disabled:opacity-50"
                  >
                    {checkingVerification ? "Checking..." : "Re-check"}
                  </button>
                  <button
                    type="button"
                    onClick={handleReVerify}
                    disabled={checkingVerification}
                    className="inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold text-purple-300 transition hover:bg-purple-500/20 disabled:opacity-50"
                  >
                    {checkingVerification ? "Verifying..." : "Re-verify Now"}
                  </button>
                </>
              )}
              {account && (
                <span className="inline-flex items-center rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-300">
                  Wallet Connected
                </span>
              )}
            </div>
          </div>
          </div>
        </div>

        {/* Task Progress Card */}
        <div className="glass-card-premium p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500/20 to-cyan-500/20">
              <CheckCircle size={16} className="text-green-400" />
            </div>
            <h3 className="text-sm font-bold text-white">Task Progress</h3>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-lg bg-white/[0.04] p-3 text-center">
              <p className="text-xl font-bold text-purple-400"><AnimatedCount value={totalTasksCount} /></p>
              <p className="text-[9px] text-gray-500 font-medium">Total Tasks</p>
            </div>
            <div className="rounded-lg bg-white/[0.04] p-3 text-center">
              <p className="text-xl font-bold text-green-400"><AnimatedCount value={completedTasksCount} /></p>
              <p className="text-[9px] text-gray-500 font-medium">Completed</p>
            </div>
            <div className="rounded-lg bg-white/[0.04] p-3 text-center">
              <p className="text-xl font-bold text-yellow-400"><AnimatedCount value={totalTasksCount - completedTasksCount} /></p>
              <p className="text-[9px] text-gray-500 font-medium">Pending</p>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Completion</span>
              <span className="text-xs font-bold text-white">{taskProgress}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-green-500 to-cyan-400 transition-all duration-700 shadow-[0_0_8px_rgba(0,255,163,0.3)]" style={{ width: `${taskProgress}%` }} />
            </div>
          </div>
          {myTasks.length > 0 && (
            <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
              {myTasks.slice(0, 5).map((t) => (
                <div key={t._id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5 hover:bg-white/[0.05] transition">
                  <span className={`h-1.5 w-1.5 rounded-full ${t.completed_status ? "bg-green-400 shadow-[0_0_6px_rgba(0,255,163,0.5)]" : "bg-yellow-400 shadow-[0_0_6px_rgba(255,209,102,0.5)]"}`} />
                  <span className={`text-[11px] flex-1 truncate ${t.completed_status ? "text-gray-500 line-through" : "text-gray-300"}`}>{t.title}</span>
                  <span className={`text-[9px] font-bold ${t.completed_status ? "text-green-400" : "text-yellow-400"}`}>
                    {t.completed_status ? "Done" : "Pending"}
                  </span>
                </div>
            ))}
            </div>
          )}
        </div>
      </RevealOnScroll>

      {/* ═══ TASK COMPLETION CHART ═══ */}
      <RevealOnScroll>
        <motion.div variants={fade} className="glass-card-premium p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <Trophy size={16} className="text-purple-400" />
            </div>
            <h3 className="text-sm font-bold text-white">Task Overview</h3>
          </div>
          <div className="flex items-center justify-center h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} stroke="transparent" />
                  ))}
                </Pie>
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-lg font-bold fill-white">
                  {totalTasksCount}
                </text>
                <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="text-[10px] fill-gray-500">
                  total
                </text>
                <Tooltip
                  contentStyle={{ background: "rgba(15,20,35,0.9)", border: "1px solid rgba(123,97,255,0.2)", borderRadius: "8px", fontSize: "12px" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", color: "#94A3B8" }}
                  iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </RevealOnScroll>

      {/* ═══ NOTIFICATION PREVIEW ═══ */}
      <RevealOnScroll>
        <motion.div variants={fade} className="glass-card-premium p-5 holographic">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
              <Bell size={16} className="text-cyan-400" />
            </div>
            <h3 className="text-sm font-bold text-white">Notification Preview</h3>
          </div>
        </div>
        {notificationPreview.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-500">No notifications yet</p>
        ) : (
          <div className="space-y-2">
            {notificationPreview.map((notification) => (
              <div
                key={notification._id}
                className={`rounded-lg px-3 py-2 transition cursor-pointer ${notification.read ? "bg-white/[0.02]" : "bg-cyan-500/5 border-l-2 border-cyan-400"}`}
                onClick={() => {
                  if (notification.redirectUrl) {
                    navigate(notification.redirectUrl);
                  }
                }}
              >
                <p className="truncate text-xs text-gray-200">{notification.message}</p>
                <p className="mt-0.5 text-[10px] text-gray-500">{timeAgo(notification.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </motion.div>
      </RevealOnScroll>

      {/* ═══ NFT CERTIFICATES ═══ */}
      <RevealOnScroll>
        <motion.div variants={fade}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Medal size={16} className="text-yellow-400" />
            <h3 className="text-sm font-bold text-white">NFT Certificates</h3>
            <span className="text-[10px] text-gray-600">{myNFTs.length} earned</span>
            {lastSynced && (
              <span className="text-[9px] text-gray-600 flex items-center gap-1 ml-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {lastSynced && (
              <span className="text-[9px] text-gray-500">
                {timeAgo(lastSynced)}
              </span>
            )}
            <button
              type="button"
              onClick={handleManualSyncNFTs}
              disabled={syncingNFTs}
              className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[9px] font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {syncingNFTs ? "Syncing..." : "Sync"}
            </button>
          </div>
        </div>
        {myNFTs.length === 0 ? (
          <div className="glass-card flex flex-col items-center py-10">
            <Award size={40} className="text-gray-500 mb-3 opacity-40 float-animation" />
            <p className="text-sm text-gray-500 font-medium">No NFT earned yet</p>
            <p className="text-[11px] text-gray-600 mt-1">Complete community tasks to earn certificates</p>
          </div>
        ) : (
          <div className="relative">
            <div ref={nftScrollRef} className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar scroll-smooth">
            {myNFTs.map((nft) => (
              <motion.div
                key={nft.id}
                className={`flex-shrink-0 w-48 rounded-xl bg-gradient-to-br ${nft.accent} border p-4 text-center glass-card`}
                whileHover={{ scale: 1.04, y: -2 }}
              >
                <Trophy size={28} className="float-animation text-yellow-400" />
                <p className="mt-2 text-[11px] font-bold text-white leading-tight truncate">{nft.title}</p>
                <p className="mt-0.5 text-[9px] text-gray-400 truncate">{nft.category}</p>
                <p className="mt-1 text-[8px] text-gray-500 font-mono truncate">{nft.reference}</p>
                <p className="mt-0.5 text-[8px] text-gray-500 truncate">{nft.detail}</p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className="inline-block text-[8px] text-green-300 font-bold">{nft.statusLabel}</span>
                  <span className="inline-block text-[8px] text-gray-500">{nft.sourceLabel}</span>
                </div>
                <div className="mt-2 flex items-center justify-center gap-2 text-[8px]">
                  {nft.verifyPath && (
                    <button type="button" onClick={() => navigate(nft.verifyPath)}
                      className="rounded border border-white/10 px-2 py-1 text-gray-300 transition hover:border-cyan-500/30 hover:text-cyan-400 hover:shadow-[0_0_8px_rgba(0,245,255,0.15)]">
                      Verify
                    </button>
                  )}
                  {nft.explorerUrl && (
                    <a href={nft.explorerUrl} target="_blank" rel="noopener noreferrer"
                      className="rounded border border-white/10 px-2 py-1 text-gray-300 transition hover:border-purple-500/30 hover:text-purple-400 hover:shadow-[0_0_8px_rgba(123,97,255,0.15)]">
                      Explorer
                    </a>
                  )}
                </div>
              </motion.div>
            ))}
            </div>
            {myNFTs.length > 3 && (
              <>
                <button
                  type="button"
                  onClick={() => scrollNFT(-1)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3 h-8 w-8 rounded-full bg-gray-900/80 border border-white/[0.08] flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition z-10 backdrop-blur-sm"
                  aria-label="Scroll left"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollNFT(1)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-3 h-8 w-8 rounded-full bg-gray-900/80 border border-white/[0.08] flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:border-cyan-500/30 transition z-10 backdrop-blur-sm"
                  aria-label="Scroll right"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>
        )}
      </motion.div>
      </RevealOnScroll>

      {/* ═══ WALLET NFT STATUS ═══ */}
      <RevealOnScroll>
        <motion.div variants={fade}>
          <WalletNFTStatus
            account={account}
            networkName={networkName}
            myNFTs={myNFTs}
            lastSynced={lastSynced}
            onSync={handleManualSyncNFTs}
            syncing={syncingNFTs}
          />
        </motion.div>
      </RevealOnScroll>

      {/* ═══ COMMUNITY POSTERS + ACTIVITY ═══ */}
      <RevealOnScroll>
        <motion.div variants={fade} className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
            <Building2 size={16} className="text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Community Posters</h3>
            </div>
            <button onClick={() => navigate("/communities")} className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold transition hover:shadow-[0_0_8px_rgba(0,245,255,0.3)]">View All →</button>
          </div>

          {joinedCommunities.length === 0 ? (
            <div className="glass-card flex flex-col items-center py-12">
            <Building2 size={36} className="text-gray-500 mb-2 float-animation" />
            <p className="text-sm text-gray-500">No communities joined yet</p>
              <button onClick={() => navigate("/communities")} className="mt-3 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition">
                Browse Communities
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {communities.slice(0, 6).map((c) => {
                const isMember = c.members?.some(m => (m._id || m) === currentUserId);
                return (
                  <motion.div key={c._id}
                    onClick={() => navigate(`/communities/${c._id}`)}
                    className="glass-card overflow-hidden cursor-pointer group"
                    whileHover={{ y: -3 }}>
                    <div className="h-20 bg-gradient-to-br from-cyan-500/15 to-purple-500/10 overflow-hidden relative">
                      {c.image && <img src={`${BASE_URL}${c.image}`} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#050816]/70 to-transparent" />
                      {isMember && (
                        <span className="absolute top-1.5 right-1.5 rounded-full bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 text-[8px] font-bold text-green-300">Joined</span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-bold text-white truncate">{c.name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{c.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-[9px] text-gray-600">{c.members?.length || 0} members</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity Feed */}
        <div className="glass-card-premium p-5 holographic">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚡</span>
              <h3 className="text-sm font-bold text-white">Recent Activity</h3>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-green-400" : "bg-red-400"} animate-pulse`} />
              <span className="text-[9px] text-gray-500">{connected ? "Live" : "Offline"}</span>
            </div>
          </div>
          <ActivityFeed maxHeight={320} maxItems={20} />
        </div>
      </motion.div>
      </RevealOnScroll>
    </motion.div>
    </>
  );
}

Dashboard.propTypes = { role: PropTypes.string };

export default Dashboard;
