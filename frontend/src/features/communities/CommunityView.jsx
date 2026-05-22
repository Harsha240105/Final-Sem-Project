import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import PropTypes from "prop-types";
import { useToast } from "../../shared/hooks/useToast";
import { useAuth } from "../../shared/hooks/useAuth";
import {
  API_BASE_URL as API_URL,
  getTasksByCommunity,
  completeTaskAndIssueCertificates,
  createTask as createTaskApi,
  uploadTaskFile as uploadTaskFileApi,
  sendTaskChatMessage,
  getTaskChatMessages,
  getUserCertificates,
} from "../../shared/services/api";
import FollowButton from "../../shared/components/FollowButton";
import { MediaBanner } from "../../shared/components/MediaBanner";

const BASE = API_URL.replace(/\/api\/?$/, "");

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24);
  if (dy < 30) return `${dy}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(n) {
  return n ? n.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "?";
}

function getToken() {
  return localStorage.getItem("token");
}
function authHeaders() {
  return { headers: { Authorization: `Bearer ${getToken()}` } };
}
function getCurrentUserId() {
  try {
    const t = getToken();
    if (!t) return null;
    const encodedPayload = t.split(".")[1];
    if (!encodedPayload) return null;
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
    return JSON.parse(atob(padded)).id || null;
  } catch {
    return null;
  }
}

function extractCertificateIssues(result) {
  if (Array.isArray(result?.issues)) {
    return result.issues.filter((issue) => issue?.reason);
  }

  const rawResults = Array.isArray(result?.results) ? result.results : [];
  return rawResults.reduce((issues, entry) => {
    const reason =
      entry?.status === "fulfilled"
        ? entry?.value?.reason || null
        : entry?.reason || null;

    if (!reason) {
      return issues;
    }

    issues.push({
      memberId: entry?.value?.memberId || null,
      userName: entry?.value?.userName || null,
      reason,
      code: entry?.value?.code || "certificate_not_issued",
      displayMessage: entry?.value?.userName ? `${entry.value.userName}: ${reason}` : reason,
    });
    return issues;
  }, []);
}

function summarizeCertificateIssues(issues) {
  const groupedIssues = issues.reduce((acc, issue) => {
    const reason = issue?.reason || "Unknown certificate issue";
    const current = acc.get(reason) || { reason, count: 0, userName: issue?.userName || null };
    current.count += 1;
    if (!current.userName && issue?.userName) {
      current.userName = issue.userName;
    }
    acc.set(reason, current);
    return acc;
  }, new Map());

  return Array.from(groupedIssues.values())
    .slice(0, 2)
    .map((issue) => {
      if (issue.count > 1) {
        return `${issue.reason} (${issue.count} members)`;
      }
      return issue.userName ? `${issue.userName}: ${issue.reason}` : issue.reason;
    })
    .join(" | ");
}

function isRetryableCertificateIssue(issue) {
  return [
    "wallet_not_connected",
    "invalid_wallet_address",
    "server_config_missing",
    "server_config_invalid",
    "issuance_error",
  ].includes(issue?.code);
}

function getCertificateStatusMeta(summary) {
  switch (summary?.certificateStatus) {
    case "success":
      return {
        label: "Certificates Issued",
        tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      };
    case "partial":
      return {
        label: "Partial Issuance",
        tone: "border-amber-500/20 bg-amber-500/10 text-amber-300",
      };
    case "pending_retry":
      return {
        label: "Certificates Pending",
        tone: "border-orange-500/20 bg-orange-500/10 text-orange-300",
      };
    case "already_issued":
      return {
        label: "Already Issued",
        tone: "border-sky-500/20 bg-sky-500/10 text-sky-300",
      };
    case "not_eligible":
      return {
        label: "Not Eligible Yet",
        tone: "border-white/10 bg-white/[0.04] text-gray-300",
      };
    default:
      return {
        label: "Certificates Unchecked",
        tone: "border-white/10 bg-white/[0.04] text-gray-300",
      };
  }
}

function buildTaskIssuanceSummary(result) {
  const issues = extractCertificateIssues(result);
  const issuedCount = Number(result?.issuedCount || 0);
  const skippedCount = Number(result?.skippedDueToExisting ?? result?.skippedCount ?? 0);
  const retryableIssueCount = Number(
    result?.retryableIssueCount ?? issues.filter((issue) => isRetryableCertificateIssue(issue)).length
  );

  let certificateStatus = result?.certificateStatus || "none";
  if (!result?.certificateStatus) {
    if (issuedCount > 0 && retryableIssueCount === 0 && issues.length === 0) {
      certificateStatus = "success";
    } else if (issuedCount > 0 && retryableIssueCount > 0) {
      certificateStatus = "partial";
    } else if (retryableIssueCount > 0) {
      certificateStatus = "pending_retry";
    } else if (issues.some((issue) => ["no_tasks_assigned", "tasks_incomplete"].includes(issue.code))) {
      certificateStatus = "not_eligible";
    } else if (issues.some((issue) => issue.code === "already_minted")) {
      certificateStatus = "already_issued";
    }
  }

  return {
    message: result?.message || "",
    issuedCount,
    skippedCount,
    retryableIssueCount,
    retryAvailable: Boolean(result?.retryAvailable ?? retryableIssueCount > 0),
    certificateStatus,
    issues,
    reasonSummary: summarizeCertificateIssues(issues),
    lastUpdated: result?.lastAttemptedAt || Date.now(),
  };
}

function buildTaskIssuanceSummaryFromTask(task) {
  const persistedIssuance = task?.certificateIssuance;
  if (!persistedIssuance) {
    return null;
  }

  const hasMeaningfulIssuanceState =
    Boolean(persistedIssuance.lastAttemptedAt) ||
    Boolean(persistedIssuance.message) ||
    (Array.isArray(persistedIssuance.issues) && persistedIssuance.issues.length > 0) ||
    Number(persistedIssuance.issuedCount || 0) > 0 ||
    Number(persistedIssuance.retryableIssueCount || 0) > 0;

  if (!hasMeaningfulIssuanceState && persistedIssuance.status === "none") {
    return null;
  }

  return buildTaskIssuanceSummary({
    ...persistedIssuance,
    certificateStatus: persistedIssuance.status || "none",
  });
}

function CommunityView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  const role = user?.role || "student";
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [showComments, setShowComments] = useState(true);
  const [commenting, setCommenting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [deletingComment, setDeletingComment] = useState(null);
  const [showCollabs, setShowCollabs] = useState(false);
  const [collabTitle, setCollabTitle] = useState("");
  const [collabDesc, setCollabDesc] = useState("");
  const [creatingCollab, setCreatingCollab] = useState(false);
  const [openCollab, setOpenCollab] = useState(null);
  const [collabMsg, setCollabMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [assigningManager, setAssigningManager] = useState(null);
  const [removingMember, setRemovingMember] = useState(null);
  const [updatingCommunity, setUpdatingCommunity] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showTasks, setShowTasks] = useState(true);
  const [completingTask, setCompletingTask] = useState(null);
  const [taskIssuanceSummaries, setTaskIssuanceSummaries] = useState({});
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", description: "", attachments: [] });
  const [creatingTask, setCreatingTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [activeTaskTab, setActiveTaskTab] = useState("upload");
  const [taskUploadFile, setTaskUploadFile] = useState(null);
  const [uploadingTaskFile, setUploadingTaskFile] = useState(false);
  const [taskChatMessages, setTaskChatMessages] = useState([]);
  const [taskChatInput, setTaskChatInput] = useState("");
  const [loadingTaskChat, setLoadingTaskChat] = useState(false);
  const [sendingTaskChat, setSendingTaskChat] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
  const [issuingToStudents, setIssuingToStudents] = useState(false);
  const commentRef = useRef(null);
  const chatEndRef = useRef(null);

  const userId = getCurrentUserId();
  const isAdmin = ["admin", "teacher"].includes(role);
  const isElevatedUser = ["admin", "teacher"].includes(user?.role);
  const createdById = community?.createdBy?._id || community?.createdBy || null;
  const isCommunityCreator = Boolean(
    createdById && userId && createdById.toString() === userId.toString()
  );
  const isTeacherMember = Boolean(
    role === "teacher" &&
      userId &&
      (community?.members || []).some((member) => {
        const memberId = member?._id || member;
        return memberId?.toString() === userId.toString();
      })
  );
  const canCreateTasks = role === "teacher" || isAdmin || role === "community_manager" || isCommunityCreator;
  const selectedTaskIssuance = selectedTask
    ? taskIssuanceSummaries[selectedTask._id] || buildTaskIssuanceSummaryFromTask(selectedTask)
    : null;
  const selectedTaskStatusMeta = getCertificateStatusMeta(selectedTaskIssuance);

  const fetchCommunity = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/communities/${id}`, authHeaders());
      setCommunity(res.data);
    } catch (err) {
      console.error("Fetch community error:", err);
      addToast("Failed to load community", "error");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => {
    fetchCommunity();
    const interval = setInterval(fetchCommunity, 30000);
    return () => clearInterval(interval);
  }, [fetchCommunity]);

  // ── Fetch tasks for this community ──
  const fetchTasks = useCallback(async () => {
    try {
      setLoadingTasks(true);
      const token = getToken();
      const data = await getTasksByCommunity(id, token);
      setTasks(data);
      setTaskIssuanceSummaries(
        (data || []).reduce((summaries, task) => {
          const issuanceSummary = buildTaskIssuanceSummaryFromTask(task);
          if (issuanceSummary) {
            summaries[task._id] = issuanceSummary;
          }
          return summaries;
        }, {})
      );
      setSelectedTask((prev) => {
        if (!prev?._id) return prev;
        return (data || []).find((task) => task._id === prev._id) || prev;
      });
    } catch (err) {
      console.error("Fetch tasks error:", err);
    } finally {
      setLoadingTasks(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTasks();
    // Poll for task updates every 10 seconds for real-time reflected changes
    const interval = setInterval(fetchTasks, 10000);
    return () => clearInterval(interval);
  }, [id, fetchTasks]);

  // ── Complete task ──
  const handleCompleteTask = async (taskId) => {
    try {
      setCompletingTask(taskId);
      const token = getToken();
      const result = await completeTaskAndIssueCertificates(taskId, token);
      const summary = buildTaskIssuanceSummary(result);
      const issuedCount = summary.issuedCount;
      const skippedCount = summary.skippedCount;
      const issues = summary.issues;
      const reasonSummary = summary.reasonSummary;

      setTaskIssuanceSummaries((prev) => ({
        ...prev,
        [taskId]: summary,
      }));

      if (issuedCount > 0 && skippedCount === 0 && issues.length === 0) {
        addToast(`✓ Issued certificates to all ${issuedCount} eligible student(s).`, "success");
      } else if (issuedCount > 0) {
        const detail = [`Issued: ${issuedCount}`];
        if (skippedCount > 0) detail.push(`Already had: ${skippedCount}`);
        if (issues.length > 0) detail.push(`Issues: ${issues.length}`);
        addToast(`${result?.message || "Partial issuance."} ${detail.join(" | ")}${reasonSummary ? ` — ${reasonSummary}` : ""}`, "warning");
      } else {
        const detail = [];
        if (skippedCount > 0) detail.push(`Already had certificates: ${skippedCount}`);
        if (issues.length > 0) detail.push(`Issues: ${issues.length}`);
        addToast(`${result?.message || "Task completed, but no certificates were issued."}${detail.length > 0 ? ` (${detail.join(", ")})` : ""}${reasonSummary ? ` — ${reasonSummary}` : ""}`, "warning");
      }
      
      // Refresh tasks to update completion status
      await fetchTasks();
      await fetchCommunity();
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask((prev) => {
          if (!prev) return prev;
          const latestTask = result?.task || {};
          return {
            ...prev,
            ...latestTask,
            completed_status: latestTask.completed_status ?? true,
          };
        });
      }
      
        // Live UI updates - refresh certificates and dashboard
        try {
          // Refresh user certificates to show new NFTs
          await getUserCertificates(token);

          // Trigger global refresh events for other components
          window.dispatchEvent(new CustomEvent('certificates-updated'));
          window.dispatchEvent(new CustomEvent('dashboard-updated'));
          window.dispatchEvent(new CustomEvent('communities-updated'));
          window.dispatchEvent(new CustomEvent('notifications-updated'));
        } catch (refreshError) {
          console.error('[Live Updates] Failed to refresh UI:', refreshError);
        }
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to complete task", "error");
    } finally {
      setCompletingTask(null);
    }
  };

  // ── Issue certificates to selected students ──
  const handleIssueToSelectedStudents = async (taskId) => {
    if (selectedStudentIds.size === 0) {
      addToast("Please select at least one student", "error");
      return;
    }
    try {
      setIssuingToStudents(true);
      const token = getToken();
      const result = await completeTaskAndIssueCertificates(taskId, token, {
        studentIds: Array.from(selectedStudentIds),
      });
      const summary = buildTaskIssuanceSummary(result);
      setTaskIssuanceSummaries((prev) => ({
        ...prev,
        [taskId]: summary,
      }));
      if (summary.issuedCount > 0) {
        const detail = [`Issued: ${summary.issuedCount}`];
        if (summary.skippedCount > 0) detail.push(`Already had: ${summary.skippedCount}`);
        if (summary.issues.length > 0) detail.push(`Issues: ${summary.issues.length}`);
        addToast(detail.join(" | ") + (summary.reasonSummary ? ` — ${summary.reasonSummary}` : ""), summary.issues.length > 0 ? "warning" : "success");
      } else {
        const detail = [];
        if (summary.skippedCount > 0) detail.push(`Already had certificates: ${summary.skippedCount}`);
        if (summary.issues.length > 0) detail.push(`Issues: ${summary.issues.length}`);
        addToast(`${summary.reasonSummary || result?.message || "No certificates were issued"}${detail.length > 0 ? ` (${detail.join(", ")})` : ""}`, "warning");
      }
      setShowIssueModal(false);
      setSelectedStudentIds(new Set());
      await fetchTasks();
      window.dispatchEvent(new CustomEvent('certificates-updated'));
      window.dispatchEvent(new CustomEvent('dashboard-updated'));
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to issue certificates", "error");
    } finally {
      setIssuingToStudents(false);
    }
  };

  const handleOpenTaskDetails = async (task) => {
    setSelectedTask(task);
    setActiveTaskTab("upload");
    setTaskUploadFile(null);
    setTaskChatInput("");
    setLoadingTaskChat(true);
    try {
      const token = getToken();
      const data = await getTaskChatMessages(task._id, token);
      setTaskChatMessages(data.chatMessages || []);
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to load task chat", "error");
      setTaskChatMessages([]);
    } finally {
      setLoadingTaskChat(false);
    }
  };

  const handleCloseTaskDetails = () => {
    setSelectedTask(null);
    setTaskUploadFile(null);
    setTaskChatInput("");
    setTaskChatMessages([]);
  };

  const handleTaskFileUpload = async () => {
    if (!selectedTask?._id) return;
    if (!taskUploadFile) {
      addToast("Please select a file first", "error");
      return;
    }

    try {
      setUploadingTaskFile(true);
      const token = getToken();
      await uploadTaskFileApi(selectedTask._id, taskUploadFile, token);
      addToast("File uploaded successfully", "success");
      setTaskUploadFile(null);
      await fetchTasks();
      const refreshed = await getTasksByCommunity(id, token);
      const updated = refreshed.find((t) => t._id === selectedTask._id);
      if (updated) setSelectedTask(updated);
      setTasks(refreshed);
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to upload file", "error");
    } finally {
      setUploadingTaskFile(false);
    }
  };

  const handleSendTaskChat = async () => {
    if (!selectedTask?._id) return;
    if (!taskChatInput.trim()) return;

    try {
      setSendingTaskChat(true);
      const token = getToken();
      const data = await sendTaskChatMessage(selectedTask._id, taskChatInput.trim(), token);
      setTaskChatMessages(data.chatMessages || []);
      setTaskChatInput("");
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to send message", "error");
    } finally {
      setSendingTaskChat(false);
    }
  };

  // ── Create task (admin) ──
  // ── Create task (TEACHER only) ──
  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    try {
      setCreatingTask(true);
      const token = getToken();
      
      // Use FormData to send files
      const formData = new FormData();
      formData.append("community_id", id);
      formData.append("title", newTask.title.trim());
      formData.append("description", newTask.description.trim());
      
      // Add file attachments
      (newTask.attachments || []).forEach((file) => {
        formData.append("attachments", file);
      });
      
      await createTaskApi(formData, token);
      addToast("Task created with attachments!", "success");
      setNewTask({ title: "", description: "", attachments: [] });
      setShowCreateTask(false);
      fetchTasks();
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to create task", "error");
    } finally {
      setCreatingTask(false);
    }
  };

  // ── Mark task as completed by student ──
  const handleMarkTaskComplete = async (taskId) => {
    try {
      setCompletingTask(taskId);
      const token = getToken();
      
      const response = await axios.patch(
        `${API_URL}/tasks/${taskId}/mark-complete`,
        {},
        authHeaders(token)
      );
      
      addToast("Task marked as completed! 🎉", "success");
      
      // Refresh tasks
      await fetchTasks();
      
      // Update selected task
      if (selectedTask?._id === taskId) {
        setSelectedTask(response.data);
      }
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to mark task as completed", "error");
    } finally {
      setCompletingTask(null);
    }
  };

  const handleJoin = async () => {
    try {
      setJoining(true);
      const res = await axios.post(`${API_URL}/communities/${id}/join`, {}, authHeaders());
      setCommunity(res.data);
      addToast("Joined community!", "success");
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to join", "error");
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    try {
      await axios.post(`${API_URL}/communities/${id}/leave`, {}, authHeaders());
      addToast("Left community", "info");
      await fetchCommunity();
      navigate("/communities");
    } catch (err) {
      addToast(err.response?.data?.error || err.response?.data?.message || "Failed to leave", "error");
    }
  };

  const handleEditCommunity = async () => {
    if (!community) return;

    const nextName = window.prompt("Edit community name", community.name || "");
    if (nextName === null) return;

    const nextDescription = window.prompt("Edit community description", community.description || "");
    if (nextDescription === null) return;

    const nextCollegeName = window.prompt("Edit college name", community.college_name || "");
    if (nextCollegeName === null) return;

    try {
      setUpdatingCommunity(true);
      const res = await axios.put(
        `${API_URL}/communities/${id}`,
        {
          name: nextName,
          description: nextDescription,
          college_name: nextCollegeName,
        },
        authHeaders()
      );
      setCommunity(res.data);
      addToast("Community updated", "success");
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to update community", "error");
    } finally {
      setUpdatingCommunity(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      setCommenting(true);
      const res = await axios.post(
        `${API_URL}/communities/${id}/comment`,
        { text: commentText.trim() },
        authHeaders()
      );
      setCommunity(res.data);
      setCommentText("");
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to comment", "error");
    } finally {
      setCommenting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this community? This cannot be undone.")) return;
    try {
      await axios.delete(`${API_URL}/communities/${id}`, authHeaders());
      addToast("Community deleted", "success");
      navigate("/communities");
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to delete", "error");
    }
  };

  // ── Comment delete ──
  const handleDeleteComment = async (commentId) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      setDeletingComment(commentId);
      const res = await axios.delete(
        `${API_URL}/communities/${id}/comments/${commentId}`,
        authHeaders()
      );
      setCommunity(res.data);
      addToast("Comment deleted", "success");
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to delete comment", "error");
    } finally {
      setDeletingComment(null);
    }
  };

  // ── Remove member (admin) ──
  const handleRemoveMember = async (memberId) => {
    if (!window.confirm("Remove this member from the community?")) return;
    try {
      setRemovingMember(memberId);
      const res = await axios.delete(
        `${API_URL}/communities/${id}/members/${memberId}`,
        authHeaders()
      );
      setCommunity(res.data);
      addToast("Member removed", "success");
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to remove member", "error");
    } finally {
      setRemovingMember(null);
    }
  };

  // ── Assign manager (admin) ──
  const handleAssignManager = async (memberId) => {
    if (!window.confirm("Assign this member as community manager?")) return;
    try {
      setAssigningManager(memberId);
      await axios.post(
        `${API_URL}/communities/${id}/assign-manager`,
        { userId: memberId },
        authHeaders()
      );
      addToast("Manager assigned successfully!", "success");
      fetchCommunity();
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to assign manager", "error");
    } finally {
      setAssigningManager(null);
    }
  };

  // ── Members modal ──
  const handleOpenMembersModal = () => {
    setShowMembersModal(true);
  };

  // ── Create collaboration ──
  const handleCreateCollab = async (e) => {
    e.preventDefault();
    if (!collabTitle.trim()) return;
    try {
      setCreatingCollab(true);
      const res = await axios.post(
        `${API_URL}/communities/${id}/collab/create`,
        { projectTitle: collabTitle.trim(), description: collabDesc.trim() },
        authHeaders()
      );
      setCommunity(res.data);
      setCollabTitle("");
      setCollabDesc("");
      addToast("Collaboration created!", "success");
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to create collab", "error");
    } finally {
      setCreatingCollab(false);
    }
  };

  // ── Join collaboration ──
  const handleJoinCollab = async (collabId) => {
    try {
      const res = await axios.post(
        `${API_URL}/communities/${id}/collab/${collabId}/join`,
        {},
        authHeaders()
      );
      setCommunity(res.data);
      addToast("Joined collaboration!", "success");
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to join", "error");
    }
  };

  // ── Send collab message ──
  const handleSendCollabMsg = async (collabId) => {
    if (!collabMsg.trim()) return;
    try {
      setSendingMsg(true);
      const res = await axios.post(
        `${API_URL}/communities/${id}/collab/${collabId}/message`,
        { text: collabMsg.trim() },
        authHeaders()
      );
      setCommunity(res.data);
      setCollabMsg("");
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      addToast(err.response?.data?.error || "Failed to send message", "error");
    } finally {
      setSendingMsg(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 animate-pulse">
        <div className="h-56 rounded-xl bg-gray-800/20" />
        <div className="h-8 w-1/3 rounded bg-gray-800/30" />
        <div className="h-4 w-2/3 rounded bg-gray-800/20" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-gray-800/20" />
          ))}
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="mx-auto max-w-4xl py-20 text-center">
        <p className="text-gray-500">Community not found</p>
        <button onClick={() => navigate("/communities")} className="mt-4 text-sm text-cyan-400 hover:text-cyan-300">
          Back to Communities
        </button>
      </div>
    );
  }

  const isMember = community.members?.some((m) => (m._id || m)?.toString() === userId?.toString());
  const creatorId = community.createdBy?._id || community.createdBy;
  const isCreator = creatorId?.toString() === userId?.toString();
  const memberCount = community.members?.length || 0;
  const contribs = community.contributions || [];
  const totalProjects = contribs.reduce((s, c) => s + (c.completedProjects || 0), 0);
  const totalAchievements = contribs.reduce((s, c) => s + (c.achievements || 0), 0);
  const commentCount = community.comments?.length || 0;

  return (
    <div>
      {/* ═══ Cinematic Hero Banner ═══ */}
      <div className="relative w-full h-[85vh] min-h-[560px] max-h-[1000px] overflow-hidden bg-[#060812]">
        {/* Gradient fallback */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/15 via-purple-600/10 to-pink-600/15" />

        {/* Banner media (video or image) */}
        {community.image && (
          <MediaBanner
            src={`${BASE}${community.image}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Dark overlay — minimal, keeps video visible */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060812] to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#060812]/30 to-transparent" />

        {/* ── Hero content ── */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-12 lg:p-16">
          {/* Back button */}
          <button
            onClick={() => navigate("/communities")}
            className="absolute top-6 left-6 md:top-8 md:left-12 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition z-10"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back
          </button>

          {/* Logo */}
          {community.logo && (
            <div className="mb-4 md:mb-5">
              <img
                src={`${BASE}${community.logo}`}
                alt={community.name}
                className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover ring-2 ring-white/10 shadow-2xl"
              />
            </div>
          )}

          {/* Community name */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#f0f0ff] leading-tight max-w-3xl">
            {community.name}
          </h1>

          {/* College */}
          {community.college_name && (
            <p className="mt-2 text-base md:text-lg text-cyan-300 font-medium flex items-center gap-2">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
              </svg>
              {community.college_name}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-[#a0a0b0]">
            <span className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-[7px] font-bold text-white">
                {getInitials(community.createdBy?.name)}
              </span>
              {community.createdBy?.name || "Admin"}
            </span>
            <span className="text-[#6a6a7a]">·</span>
            <span className="flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-[#6a6a7a]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
              {memberCount} member{memberCount !== 1 ? "s" : ""}
            </span>
            <span className="text-[#6a6a7a]">·</span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              Active
            </span>
            {community.category && (
              <>
                <span className="text-[#6a6a7a]">·</span>
                <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#a0a0b0] uppercase tracking-wider">
                  {community.category}
                </span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 mt-6">
            {isCreator ? (
              <>
                <button
                  onClick={handleEditCommunity}
                  disabled={updatingCommunity}
                  className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 hover:border-white/40 disabled:opacity-50"
                >
                  {updatingCommunity ? "Updating..." : "Edit Community"}
                </button>
                <button
                  onClick={handleDelete}
                  className="rounded-lg border border-red-500/30 px-5 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10 hover:border-red-500/50"
                >
                  Delete Community
                </button>
              </>
            ) : isAdmin ? (
              <button
                onClick={handleDelete}
                className="rounded-lg border border-red-500/30 px-5 py-2.5 text-sm font-medium text-red-300 transition hover:bg-red-500/10 hover:border-red-500/50"
              >
                Delete Community
              </button>
            ) : isMember ? (
              <button
                onClick={handleLeave}
                className="rounded-lg border border-white/20 px-5 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/10 hover:border-red-500/40 hover:text-red-300"
              >
                Leave Community
              </button>
            ) : (
              <button
                onClick={handleJoin}
                disabled={joining}
                className="rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50"
              >
                {joining ? "Joining..." : "Join Community"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Main Content ═══ */}
      <Motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="mx-auto max-w-4xl space-y-6 -mt-24 relative z-10 pb-16"
      >

      {/* Description */}
      <div className="cyber-card p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">About</h3>
        <p className="text-sm text-gray-300 leading-relaxed">{community.description}</p>
        {community.certificate_template_id && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
            <span className="text-sm">📜</span>
            <div>
              <p className="text-[10px] text-yellow-300 font-semibold uppercase tracking-wider">Certificate Template</p>
              <p className="text-xs text-yellow-200 font-mono">{community.certificate_template_id}</p>
            </div>
          </div>
        )}
      </div>

      {/* Preview mode - Show only for non-members */}
      {!isMember && (
        <div className="mt-12 flex flex-col items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-12 text-center cyber-card">
          <div className="text-4xl mb-4 float-animation">🔒</div>
          <h3 className="text-xl font-bold text-white mb-2">Join to See More</h3>
          <p className="text-sm text-gray-400 mb-6">
            This is a preview. Join the community to access tasks, members, comments, and more!
          </p>
          <button
            onClick={handleJoin}
            disabled={joining}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-6 py-3 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-cyan-500/30 disabled:opacity-50"
          >
            {joining ? "Joining..." : "+ Join Community"}
          </button>
        </div>
      )}

      {/* Full Content - Only for members */}
      {isMember && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Members", value: memberCount, color: "text-purple-400", icon: "👥" },
              { label: "Projects", value: totalProjects, color: "text-blue-400", icon: "📁" },
              { label: "Achievements", value: totalAchievements, color: "text-green-400", icon: "🏆" },
              { label: "Comments", value: commentCount, color: "text-yellow-400", icon: "💬" },
            ].map((s) => (
              <div key={s.label} className="cyber-card p-4 text-center hover:shadow-[0_0_12px_rgba(0,245,255,0.1)] transition">
                <span className="text-xl float-animation">{s.icon}</span>
                <p className={`text-2xl font-bold mt-1 counter-animate ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

      {/* ═══ Tasks Section ═══ */}
      {isMember && (
        <div className="cyber-card p-5 scanline">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowTasks((p) => !p)}
              className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-cyan-400 transition"
            >
              <svg
                className={`h-3.5 w-3.5 transition-transform ${showTasks ? "rotate-90" : ""}`}
                fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              Tasks ({tasks.length})
            </button>
            {canCreateTasks && (
              <button
                onClick={() => setShowCreateTask((p) => !p)}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:shadow-lg hover:shadow-cyan-500/25"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add Task
              </button>
            )}
          </div>

          {/* Task Progress Bar */}
          {tasks.length > 0 && (() => {
            const completedCount = tasks.filter((t) => t.completed_status).length;
            const progress = Math.round((completedCount / tasks.length) * 100);
            return (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Progress</span>
                  <span className="text-xs font-bold text-white">{completedCount}/{tasks.length} completed ({progress}%)</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-500 to-cyan-400 transition-all duration-500 shadow-[0_0_8px_rgba(0,255,163,0.3)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })()}

          <AnimatePresence>
            {showTasks && (
              <Motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                {/* Create Task Form (TEACHER only) */}
                <AnimatePresence>
                  {showCreateTask && canCreateTasks && (
                    <Motion.form
                      onSubmit={handleCreateTask}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-4 space-y-3 p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                    >
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">📝 Create New Task</p>
                      
                      <input
                        value={newTask.title}
                        onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                        placeholder="Task title (required)..."
                        className="w-full rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none focus:bg-white/[0.06]"
                      />
                      
                      <textarea
                        value={newTask.description}
                        onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
                        placeholder="Task description (optional)..."
                        rows={2}
                        className="w-full rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none focus:bg-white/[0.06] resize-none"
                      />
                      
                      <div>
                        <label className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider block mb-2">
                          📎 Attach Files (PDF, ZIP, Images)
                        </label>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.zip,.png,.jpg,.jpeg,.webp"
                          onChange={(e) => setNewTask((p) => ({ 
                            ...p, 
                            attachments: Array.from(e.target.files || []) 
                          }))}
                          className="w-full rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-gray-400 file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:bg-purple-500/20 file:text-purple-300 hover:file:bg-purple-500/30 outline-none focus:bg-white/[0.06]"
                        />
                        {newTask.attachments && newTask.attachments.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {Array.from(newTask.attachments).map((file, idx) => (
                              <p key={idx} className="text-xs text-purple-300 truncate">
                                ✓ {file.name}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <button
                          type="submit"
                          disabled={creatingTask || !newTask.title.trim()}
                          className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-40 transition hover:shadow-lg hover:shadow-emerald-500/20"
                        >
                          {creatingTask ? "Creating..." : "Create Task"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowCreateTask(false)}
                          className="rounded-lg px-4 py-2 text-xs text-gray-400 hover:text-white transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </Motion.form>
                  )}
                </AnimatePresence>

                {/* Task List */}
                {loadingTasks ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-gray-800/20 animate-pulse" />)}
                  </div>
                ) : tasks.length === 0 ? (
                  <p className="text-xs text-gray-600 py-6 text-center">No tasks yet</p>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => {
                      const issuanceSummary =
                        taskIssuanceSummaries[task._id] || buildTaskIssuanceSummaryFromTask(task);
                      const issuanceMeta = getCertificateStatusMeta(issuanceSummary);
                      return (
                        <div
                          key={task._id}
                          onClick={() => handleOpenTaskDetails(task)}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 transition ${
                            task.completed_status
                              ? "bg-emerald-500/5 border border-emerald-500/10"
                              : "bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            task.completed_status
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-purple-500/20 text-purple-400"
                          }`}>
                            {task.completed_status ? (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${task.completed_status ? "text-emerald-300 line-through" : "text-white"}`}>
                              {task.title}
                            </p>
                            {task.description && (
                              <p className="text-[11px] text-gray-600 truncate">{task.description}</p>
                            )}
                            {task.attachments && task.attachments.length > 0 && (
                              <p className="text-[10px] text-purple-500 mt-0.5">📎 {task.attachments.length} file(s) attached</p>
                            )}
                            {task.completedBy && task.completedBy.length > 0 && (
                              <p className="text-[10px] text-emerald-500 mt-0.5">✓ Completed by {task.completedBy.length} student(s)</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              task.completed_status
                                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                                : "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                            }`}>
                              {task.completed_status ? "Completed" : "Pending"}
                            </span>
                            {issuanceSummary && (
                              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${issuanceMeta.tone}`}>
                                {issuanceMeta.label}
                              </span>
                            )}
                            <span className="text-[10px] font-semibold text-purple-300">Open</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {selectedTask && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={handleCloseTaskDetails}
          >
            <Motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="flex h-[92vh] w-[96vw] max-w-6xl flex-col rounded-2xl border border-white/10 bg-gray-950 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Task Details</p>
                  <h3 className="mt-1 text-lg font-bold text-white">{selectedTask.title}</h3>
                  <p className="mt-1 text-sm text-gray-400">{selectedTask.description || "No description provided"}</p>
                  
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2.5 py-1 font-semibold ${
                      selectedTask.completed_status
                        ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                        : "border border-amber-500/20 bg-amber-500/10 text-amber-300"
                    }`}>
                      Status: {selectedTask.completed_status ? "Completed" : "Pending"}
                    </span>
                    
                    {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                      <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-purple-300">
                        📎 {selectedTask.attachments.length} file(s)
                      </span>
                    )}
                    
                    {selectedTask.completedBy && selectedTask.completedBy.length > 0 && (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                        ✓ {selectedTask.completedBy.length} completed
                      </span>
                    )}
                    
                    {selectedTaskIssuance && (
                      <span className={`rounded-full border px-2.5 py-1 font-semibold ${selectedTaskStatusMeta.tone}`}>
                        {selectedTaskStatusMeta.label}
                      </span>
                    )}
                  </div>
                  
                  {/* Show students who completed this task */}
                  {selectedTask.completedBy && selectedTask.completedBy.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Completed by:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedTask.completedBy.map((entry) => (
                          <span key={entry.userId?._id || entry.userId} className="text-xs rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-emerald-300">
                            {entry.userId?.name || "Unknown Student"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-2 shrink-0">
                  {/* Mark as Complete button for students */}
                  {role === "student" && !selectedTask.completedBy?.some(entry => entry.userId?._id === userId || entry.userId === userId) && (
                    <button
                      onClick={() => handleMarkTaskComplete(selectedTask._id)}
                      disabled={completingTask === selectedTask._id}
                      className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-40 transition hover:shadow-lg hover:shadow-emerald-500/20"
                    >
                      {completingTask === selectedTask._id ? "Marking..." : "Mark Complete ✓"}
                    </button>
                  )}
                  
                  <button
                    onClick={handleCloseTaskDetails}
                    className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-gray-300 transition hover:bg-white/[0.06]"
                  >
                    Close
                  </button>
                </div>
              </div>

              {selectedTaskIssuance && (
                <div className="border-b border-white/10 px-5 py-4">
                  <div className={`rounded-xl border p-4 ${
                    selectedTaskIssuance.certificateStatus === "success"
                      ? "border-emerald-500/20 bg-emerald-500/10"
                      : selectedTaskIssuance.retryAvailable
                        ? "border-orange-500/20 bg-orange-500/10"
                        : "border-white/10 bg-white/[0.03]"
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                          Certificate Issuance
                        </p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {selectedTaskIssuance.message || "Certificate issuance status updated."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                          Issued: {selectedTaskIssuance.issuedCount}
                        </span>
                        {selectedTaskIssuance.skippedCount > 0 && (
                          <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-sky-300">
                            Already had: {selectedTaskIssuance.skippedCount}
                          </span>
                        )}
                        {selectedTaskIssuance.retryableIssueCount > 0 && (
                          <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-orange-300">
                            Pending: {selectedTaskIssuance.retryableIssueCount}
                          </span>
                        )}
                        {selectedTaskIssuance.issues.length > 0 && (
                          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-red-300">
                            Issues: {selectedTaskIssuance.issues.length}
                          </span>
                        )}
                      </div>
                    </div>

                    {selectedTaskIssuance.issues.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {/* Group issues by code for cleaner display */}
                        {(() => {
                          const grouped = selectedTaskIssuance.issues.reduce((acc, issue) => {
                            const key = issue.code || "other";
                            if (!acc[key]) acc[key] = [];
                            acc[key].push(issue);
                            return acc;
                          }, {});
                          const priorityOrder = ["wallet_not_connected", "invalid_wallet_address", "tasks_incomplete", "issuance_error", "other"];
                          const sortedGroups = priorityOrder.map(k => [k, grouped[k]]).filter(([, v]) => v);
                          const totalIssueTypes = Object.keys(grouped).length;
                          const displayedGroups = sortedGroups.slice(0, 3);
                          const hasMore = totalIssueTypes > 3;
                          return (
                            <>
                              {displayedGroups.map(([code, group]) => (
                                <p
                                  key={code}
                                  className="rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-xs text-gray-100"
                                >
                                  <span className="font-semibold text-gray-300">
                                    {group.length > 1 ? `${group.length} students` : (group[0].userName || '1 student')}
                                  </span>
                                  : {group[0].reason}
                                  {group.length > 1 && group.some(i => i.userName) && (
                                    <span className="text-gray-400">
                                      {' — '}{group.map(i => i.userName).filter(Boolean).join(', ')}
                                    </span>
                                  )}
                                </p>
                              ))}
                              {hasMore && (
                                <p className="text-xs text-gray-400">
                                  +{totalIssueTypes - 3} more issue type(s)
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {selectedTaskIssuance.retryAvailable && (
                      <p className="mt-3 text-xs text-orange-200">
                        Students with pending wallet/configuration issues can receive certificates after the issue is fixed and the teacher retries issuance.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="border-b border-white/10 px-5 pt-3">
                <div className="flex gap-2">
                  {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTaskTab("attachments")}
                      className={`rounded-t-lg px-3 py-2 text-xs font-semibold transition ${
                        activeTaskTab === "attachments"
                          ? "bg-white/[0.08] text-white"
                          : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      📎 Attachments ({selectedTask.attachments.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveTaskTab("upload")}
                    className={`rounded-t-lg px-3 py-2 text-xs font-semibold transition ${
                      activeTaskTab === "upload"
                        ? "bg-white/[0.08] text-white"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Upload Files
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTaskTab("chat")}
                    className={`rounded-t-lg px-3 py-2 text-xs font-semibold transition ${
                      activeTaskTab === "chat"
                        ? "bg-white/[0.08] text-white"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Chat
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {activeTaskTab === "attachments" ? (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-400 mb-4">
                      📎 Task Attachments - Download materials provided by the teacher
                    </p>
                    {selectedTask.attachments && selectedTask.attachments.length > 0 ? (
                      <div className="space-y-2">
                        {selectedTask.attachments.map((attachment, idx) => {
                          const fileIcon = attachment.mimeType?.includes("pdf") ? "📄" : 
                                          attachment.mimeType?.includes("zip") ? "📦" : 
                                          attachment.mimeType?.includes("image") ? "🖼️" : "📎";
                          return (
                            <a
                              key={idx}
                              href={`${API_URL}${attachment.fileUrl}`}
                              download
                              className="flex items-center gap-3 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 transition hover:bg-purple-500/10 hover:border-purple-500/40"
                            >
                              <span className="text-lg">{fileIcon}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-white truncate">{attachment.fileName}</p>
                                <p className="text-[10px] text-gray-500">
                                  Uploaded by {attachment.uploadedBy?.name || "Unknown"} on {new Date(attachment.uploadedAt).toLocaleDateString()}
                                </p>
                              </div>
                              <span className="text-xs text-purple-300 shrink-0">⬇️</span>
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 py-4 text-center">No attachments for this task</p>
                    )}
                  </div>
                ) : activeTaskTab === "upload" ? (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-400">
                      Upload PDF, ZIP, or image files related to this task.
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        onChange={(e) => setTaskUploadFile(e.target.files?.[0] || null)}
                        disabled={selectedTask.completed_status && !isElevatedUser}
                        className="max-w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-200 disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={handleTaskFileUpload}
                        disabled={uploadingTaskFile || !taskUploadFile || (selectedTask.completed_status && !isElevatedUser)}
                        className="rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {uploadingTaskFile ? "Uploading..." : "Upload"}
                      </button>
                    </div>

                    {selectedTask.completed_status && !isElevatedUser && (
                      <p className="text-xs text-amber-400">
                        ⚠️ Task completed. File uploads are disabled for students.
                      </p>
                    )}

                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Uploaded Files ({selectedTask.files?.length || 0})
                      </p>
                      {!selectedTask.files?.length ? (
                        <p className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-3 text-xs text-gray-500">
                          No files uploaded yet.
                        </p>
                      ) : (
                        selectedTask.files.map((file, index) => (
                          <a
                            key={`${file.filePath}-${index}`}
                            href={`${BASE}${file.filePath}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-gray-200 transition hover:bg-white/[0.05]"
                          >
                            <span className="truncate">{file.fileName}</span>
                            <span className="text-purple-300">Open</span>
                          </a>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] p-3">
                      {loadingTaskChat ? (
                        <p className="text-xs text-gray-500">Loading messages...</p>
                      ) : taskChatMessages.length === 0 ? (
                        <p className="text-xs text-gray-500">No messages yet. Start the conversation.</p>
                      ) : (
                        taskChatMessages.map((msg, index) => {
                          const msgUserId = msg.user?._id || msg.user;
                          const mine = msgUserId === userId;
                          return (
                            <div
                              key={`${msg.createdAt || index}-${index}`}
                              className={`rounded-lg px-3 py-2 text-xs ${
                                mine
                                  ? "ml-auto w-fit max-w-[85%] bg-purple-500/20 text-purple-100"
                                  : "mr-auto w-fit max-w-[85%] bg-white/[0.06] text-gray-200"
                              }`}
                            >
                              <p className="font-semibold text-[10px] text-gray-300 mb-0.5">
                                {msg.user?.name || "User"}
                              </p>
                              <p>{msg.message}</p>
                              <p className="mt-1 text-[10px] text-gray-500">{timeAgo(msg.createdAt)}</p>
                            </div>
                          );
                        })
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <div className="flex gap-2">
                      <input
                        value={taskChatInput}
                        onChange={(e) => setTaskChatInput(e.target.value)}
                        placeholder="Type your message..."
                        disabled={selectedTask.completed_status && !isElevatedUser}
                        className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none disabled:opacity-50"
                      />
                      <button
                        type="button"
                        onClick={handleSendTaskChat}
                        disabled={sendingTaskChat || !taskChatInput.trim() || (selectedTask.completed_status && !isElevatedUser)}
                        className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {sendingTaskChat ? "Sending..." : "Send"}
                      </button>
                    </div>

                    {selectedTask.completed_status && !isElevatedUser && (
                      <p className="text-xs text-amber-400 mt-2">
                        ⚠️ Task completed. Chat is disabled for students.
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/10 p-4">
                {(isCreator || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudentIds(new Set());
                      setShowIssueModal(true);
                    }}
                    className="rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition hover:shadow-purple-500/20"
                  >
                    🎓 Select Students & Issue Certificate
                  </button>
                )}
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Manual Certificate Issuance Modal ═══ */}
      <AnimatePresence>
        {showIssueModal && selectedTask && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setShowIssueModal(false)}
          >
            <Motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-gray-950 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 p-5">
                <div>
                  <h3 className="text-lg font-bold text-white">Issue Certificates</h3>
                  <p className="text-xs text-gray-500">
                    Select students to issue certificates for "{selectedTask.title}"
                  </p>
                </div>
                <button
                  onClick={() => setShowIssueModal(false)}
                  className="rounded-lg border border-white/10 p-2 text-gray-400 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    {community?.members?.length || 0} members in community
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedStudentIds.size === (community?.members?.length || 0)) {
                        setSelectedStudentIds(new Set());
                      } else {
                        setSelectedStudentIds(new Set((community?.members || []).map((m) => m._id)));
                      }
                    }}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold"
                  >
                    {selectedStudentIds.size === (community?.members?.length || 0) ? "Deselect All" : "Select All"}
                  </button>
                </div>

                <div className="space-y-1">
                  {(community?.members || []).map((member) => {
                    const memberId = member._id?.toString();
                    const memberName = member.name || "Unknown";
                    const memberRole = member.role || "student";
                    const hasWallet = Boolean(member.walletAddress?.trim());
                    const isSelected = selectedStudentIds.has(memberId);
                    return (
                      <label
                        key={memberId}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition ${
                          isSelected
                            ? "bg-purple-500/10 border border-purple-500/30"
                            : "bg-white/[0.03] border border-transparent hover:bg-white/[0.06]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            const next = new Set(selectedStudentIds);
                            if (next.has(memberId)) {
                              next.delete(memberId);
                            } else {
                              next.add(memberId);
                            }
                            setSelectedStudentIds(next);
                          }}
                          className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
                        />
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-[9px] font-bold text-white shrink-0">
                          {getInitials(memberName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">{memberName}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400 capitalize">{memberRole}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {hasWallet ? (
                              <span className="text-[9px] text-green-400 flex items-center gap-1">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                                Wallet connected
                              </span>
                            ) : (
                              <span className="text-[9px] text-red-400 flex items-center gap-1">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                                No wallet
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-white/10 p-5">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-gray-300 transition hover:bg-white/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleIssueToSelectedStudents(selectedTask._id)}
                  disabled={issuingToStudents || selectedStudentIds.size === 0}
                  className="rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {issuingToStudents
                    ? "Issuing..."
                    : `Issue to ${selectedStudentIds.size} student${selectedStudentIds.size !== 1 ? "s" : ""}`}
                </button>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Members */}
      {community.members?.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Members ({memberCount})
            </h3>
            <button
              onClick={handleOpenMembersModal}
              className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold transition"
            >
              View All →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {community.members.slice(0, 10).map((m, i) => (
              <div
                key={m._id || i}
                className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 group/member"
              >
                {m.avatar ? (
                  <img
                    src={`${BASE}${m.avatar}`}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-[9px] font-bold text-white">
                    {getInitials(m.name)}
                  </div>
                )}
                <span className="text-xs text-gray-300">{m.name || "User"}</span>
                {isAdmin && (m._id || m) !== userId && (
                  <div className="flex items-center gap-1 ml-1 opacity-0 group-hover/member:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleRemoveMember(m._id)}
                      disabled={removingMember === m._id}
                      className="rounded-md bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-red-400 hover:bg-red-500/20 transition disabled:opacity-30"
                      title="Remove member"
                    >
                      {removingMember === m._id ? "..." : "Remove"}
                    </button>
                    <button
                      onClick={() => handleAssignManager(m._id)}
                      disabled={assigningManager === m._id}
                      className="rounded-md bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-purple-400 hover:bg-purple-500/20 transition disabled:opacity-30"
                      title="Assign as community manager"
                    >
                      {assigningManager === m._id ? "..." : "Manager"}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {memberCount > 10 && (
              <div className="flex items-center gap-2 rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-2 cursor-pointer hover:bg-purple-500/20 transition" onClick={handleOpenMembersModal}>
                <span className="text-xs text-purple-300 font-semibold">+{memberCount - 10} more</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Members Modal */}
      <AnimatePresence>
        {showMembersModal && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setShowMembersModal(false)}
          >
            <Motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-white/10 bg-gray-950 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 p-5">
                <div>
                  <h3 className="text-lg font-bold text-white">Community Members</h3>
                  <p className="text-xs text-gray-500">{memberCount} members</p>
                </div>
                <button
                  onClick={() => setShowMembersModal(false)}
                  className="rounded-lg border border-white/10 p-2 text-gray-400 transition hover:bg-white/[0.06] hover:text-white"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                {loadingMemberFollow ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg bg-white/[0.03] p-3 animate-pulse">
                        <div className="h-10 w-10 rounded-full bg-gray-800" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 w-24 rounded bg-gray-800" />
                          <div className="h-2 w-16 rounded bg-gray-800" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {community.members.map((m) => {
                      const memberId = m._id || m;
                      const isMe = memberId?.toString() === userId?.toString();
                      return (
                        <div
                          key={memberId}
                          className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] p-3 hover:bg-white/[0.05] transition"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            {m.avatar ? (
                              <img
                                src={`${BASE}${m.avatar}`}
                                alt=""
                                className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10"
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-sm font-bold text-white ring-2 ring-white/10">
                                {getInitials(m.name)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-white">{m.name || "User"}</p>
                              {m.role && (
                                <span className="inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-purple-300 capitalize mt-0.5">
                                  {m.role}
                                </span>
                              )}
                            </div>
                          </div>
                          {!isMe && (
                            <FollowButton
                              userId={memberId}
                              size="sm"
                            />
                          )}
                          {isMe && (
                            <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                              You
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Contributions */}
      {contribs.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Contributions
          </h3>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-white/[0.04] px-3 py-3 text-center">
              <p className="text-xl font-bold text-purple-400">{totalProjects}</p>
              <p className="text-[10px] text-gray-500">Projects</p>
            </div>
            <div className="rounded-lg bg-white/[0.04] px-3 py-3 text-center">
              <p className="text-xl font-bold text-emerald-400">{totalAchievements}</p>
              <p className="text-[10px] text-gray-500">Achievements</p>
            </div>
            <div className="rounded-lg bg-white/[0.04] px-3 py-3 text-center">
              <p className="text-xl font-bold text-blue-400">{contribs.length}</p>
              <p className="text-[10px] text-gray-500">Contributors</p>
            </div>
          </div>
          <div className="space-y-2">
            {contribs.map((c, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-white/[0.03] px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.title}</p>
                  {c.description && (
                    <p className="text-[11px] text-gray-600 truncate">{c.description}</p>
                  )}
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500"
                    style={{ width: `${Math.min(100, (c.completedProjects || 0) * 20)}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 shrink-0">{c.completedProjects} done</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      <div className="glass-card p-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Achievements
        </h3>
        {totalAchievements > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {contribs
              .filter((c) => c.achievements > 0)
              .map((c, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-4 text-center"
                >
                  <span className="text-2xl">🏆</span>
                  <p className="mt-2 text-xs font-semibold text-white">{c.title}</p>
                  <p className="text-[10px] text-gray-500">{c.achievements} achievement{c.achievements !== 1 ? "s" : ""}</p>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-xs text-gray-600 text-center py-4">No achievements yet</p>
        )}
      </div>

      {/* Attachments */}
      {community.files?.length > 0 && (
        <div className="glass-card p-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Attachments
          </h3>
          <div className="flex flex-wrap gap-2">
            {community.files.map((f, i) => {
              const name = f.split("/").pop();
              return (
                <a
                  key={i}
                  href={`${BASE}${f}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-gray-300 transition hover:bg-white/[0.08]"
                >
                  <svg
                    className="h-4 w-4 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                  {name.length > 30 ? name.slice(0, 27) + "..." : name}
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Comments Section (Collapsible) */}
      <div className="glass-card p-5">
        <button
          onClick={() => setShowComments((p) => !p)}
          className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition w-full"
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform ${showComments ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          Comments ({commentCount})
        </button>

        <AnimatePresence>
          {showComments && (
            <Motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="mt-4 space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                {commentCount === 0 ? (
                  <p className="text-xs text-gray-600 py-6 text-center">
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  [...(community.comments || [])].reverse().map((c) => (
                    <div key={c._id} className="flex gap-3 py-2.5 rounded-lg px-2 hover:bg-white/[0.02] transition group">
                      {c.user?.avatar ? (
                        <img
                          src={`${BASE}${c.user.avatar}`}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-[10px] font-bold text-white">
                          {getInitials(c.user?.name)}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {c.user?.name || "User"}
                          </span>
                          <span className="text-[11px] text-gray-600">{timeAgo(c.createdAt)}</span>
                          {/* Delete button for own comments or admin */}
                          {(c.user?._id === userId || isAdmin) && (
                            <button
                              onClick={() => handleDeleteComment(c._id)}
                              disabled={deletingComment === c._id}
                              className="ml-auto opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all disabled:opacity-30"
                              title="Delete comment"
                            >
                              {deletingComment === c._id ? (
                                <span className="text-[10px]">...</span>
                              ) : (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-gray-400 break-words">{c.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleComment} className="mt-4 flex gap-2">
                <input
                  ref={commentRef}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 rounded-lg bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-gray-600 outline-none transition focus:bg-white/[0.06]"
                />
                <button
                  type="submit"
                  disabled={commenting || !commentText.trim()}
                  className="rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-purple-500/20 disabled:opacity-40"
                >
                  {commenting ? "..." : "Send"}
                </button>
              </form>
            </Motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ Collaborations Section (Collapsible) ═══ */}
      {isMember && (
        <div className="glass-card p-5">
          <button
            onClick={() => setShowCollabs((p) => !p)}
            className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition w-full"
          >
            <svg
              className={`h-3.5 w-3.5 transition-transform ${showCollabs ? "rotate-90" : ""}`}
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
            Collaborations ({community.collaborations?.length || 0})
          </button>

          <AnimatePresence>
            {showCollabs && (
              <Motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                {/* Create new collab form */}
                <form onSubmit={handleCreateCollab} className="mt-4 space-y-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">New Collaboration</p>
                  <input
                    value={collabTitle}
                    onChange={(e) => setCollabTitle(e.target.value)}
                    placeholder="Project title..."
                    className="w-full rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none focus:bg-white/[0.06]"
                  />
                  <input
                    value={collabDesc}
                    onChange={(e) => setCollabDesc(e.target.value)}
                    placeholder="Short description (optional)..."
                    className="w-full rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none focus:bg-white/[0.06]"
                  />
                  <button
                    type="submit"
                    disabled={creatingCollab || !collabTitle.trim()}
                    className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {creatingCollab ? "Creating..." : "Create Collaboration"}
                  </button>
                </form>

                {/* Collab list */}
                <div className="mt-4 space-y-3">
                  {(community.collaborations || []).length === 0 ? (
                    <p className="text-xs text-gray-600 py-4 text-center">No collaborations yet</p>
                  ) : (
                    (community.collaborations || []).map((collab) => {
                      const isCollabMember = collab.members?.some(
                        (m) => (m._id || m) === userId
                      );
                      const isOpen = openCollab === collab._id;

                      return (
                        <div key={collab._id} className="rounded-lg bg-white/[0.03] border border-white/[0.06] overflow-hidden">
                          {/* Collab header */}
                          <div className="px-4 py-3 flex items-center justify-between">
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => setOpenCollab(isOpen ? null : collab._id)}
                            >
                              <p className="text-sm font-semibold text-white truncate">{collab.projectTitle}</p>
                              {collab.description && (
                                <p className="text-[11px] text-gray-500 truncate mt-0.5">{collab.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[9px] text-gray-600">
                                  by {collab.createdBy?.name || "Unknown"}
                                </span>
                                <span className="text-[9px] text-gray-600">
                                  · {collab.members?.length || 0} member{(collab.members?.length || 0) !== 1 ? "s" : ""}
                                </span>
                                <span className="text-[9px] text-gray-600">
                                  · {collab.messages?.length || 0} msg{(collab.messages?.length || 0) !== 1 ? "s" : ""}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {!isCollabMember && (
                                <button
                                  onClick={() => handleJoinCollab(collab._id)}
                                  className="rounded-md bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 text-[10px] font-semibold text-purple-400 hover:bg-purple-500/20 transition"
                                >
                                  Join
                                </button>
                              )}
                              {isCollabMember && (
                                <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                                  Joined
                                </span>
                              )}
                              <button
                                onClick={() => setOpenCollab(isOpen ? null : collab._id)}
                                className="text-gray-500 hover:text-gray-300 transition"
                              >
                                <svg
                                  className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                                  fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Expanded chat */}
                          <AnimatePresence>
                            {isOpen && isCollabMember && (
                              <Motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden border-t border-white/[0.06]"
                              >
                                {/* Members list */}
                                <div className="px-4 py-2 flex items-center gap-1 border-b border-white/[0.04]">
                                  <span className="text-[9px] text-gray-600 mr-1">Members:</span>
                                  <div className="flex -space-x-1.5">
                                    {(collab.members || []).slice(0, 8).map((m, j) => (
                                      <div key={m._id || j} className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 text-[7px] font-bold text-white ring-1 ring-gray-950" title={m.name}>
                                        {m.avatar ? (
                                          <img src={`${BASE}${m.avatar}`} alt="" className="h-5 w-5 rounded-full object-cover" />
                                        ) : (
                                          getInitials(m.name)
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Messages */}
                                <div className="max-h-72 overflow-y-auto custom-scrollbar px-4 py-3 space-y-2">
                                  {(collab.messages || []).length === 0 ? (
                                    <p className="text-xs text-gray-600 py-4 text-center">No messages yet — start the conversation!</p>
                                  ) : (
                                    (collab.messages || []).map((msg, mi) => {
                                      const isMe = (msg.sender?._id || msg.sender) === userId;
                                      return (
                                        <div key={msg._id || mi} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                                          <div className={`max-w-[75%] rounded-xl px-3 py-2 ${isMe ? "bg-purple-500/20 border border-purple-500/20" : "bg-white/[0.05] border border-white/[0.06]"}`}>
                                            {!isMe && (
                                              <p className="text-[9px] font-semibold text-purple-400 mb-0.5">{msg.sender?.name || "User"}</p>
                                            )}
                                            <p className="text-xs text-gray-200 break-words">{msg.text}</p>
                                            <p className="text-[8px] text-gray-600 mt-0.5 text-right">{timeAgo(msg.createdAt)}</p>
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                  <div ref={chatEndRef} />
                                </div>

                                {/* Message input */}
                                <div className="px-4 py-3 border-t border-white/[0.06] flex gap-2">
                                  <input
                                    value={collabMsg}
                                    onChange={(e) => setCollabMsg(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendCollabMsg(collab._id)}
                                    placeholder="Type a message..."
                                    className="flex-1 rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none focus:bg-white/[0.06]"
                                  />
                                  <button
                                    onClick={() => handleSendCollabMsg(collab._id)}
                                    disabled={sendingMsg || !collabMsg.trim()}
                                    className="rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                                  >
                                    {sendingMsg ? "..." : "Send"}
                                  </button>
                                </div>
                              </Motion.div>
                            )}
                            {isOpen && !isCollabMember && (
                              <Motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="px-4 py-4 border-t border-white/[0.06] text-center"
                              >
                                <p className="text-xs text-gray-500">Join this collaboration to view messages and chat</p>
                              </Motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })
                  )}
                </div>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
        </>
      )}
    </Motion.div>
  </div>
  );
}

CommunityView.propTypes = {
};

export default CommunityView;
