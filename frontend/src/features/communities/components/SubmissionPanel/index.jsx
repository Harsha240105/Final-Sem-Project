import { useState, useCallback, useEffect, memo } from "react";
import { submitTaskWork, getMyTaskSubmission, getTaskSubmissions } from "../../../../shared/services/api";
import { useToast } from "../../../../shared/hooks/useToast";

function SubmissionPanel({ task, communityId, isAdmin, isArchived }) {
  const { addToast } = useToast();
  const [mySubmission, setMySubmission] = useState(null);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [files, setFiles] = useState([]);
  const [links, setLinks] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackText, setFeedbackText] = useState({});
  const [reviewingSub, setReviewingSub] = useState(null);

  const loadMySubmission = useCallback(async () => {
    if (!task?._id) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getMyTaskSubmission(task._id, token);
      setMySubmission(data?.submission || null);
    } catch { /* silent */ }
  }, [task?._id]);

  const loadAllSubmissions = useCallback(async () => {
    if (!task?._id || !isAdmin) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const data = await getTaskSubmissions(task._id, token);
      setAllSubmissions(data?.submissions || []);
    } catch { /* silent */ }
  }, [task?._id, isAdmin]);

  useEffect(() => { loadMySubmission(); }, [loadMySubmission]);
  useEffect(() => { loadAllSubmissions(); }, [loadAllSubmissions]);

  const handleSubmit = async () => {
    if (files.length === 0 && !links.trim()) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const formData = new FormData();
      files.forEach(f => formData.append("files", f));
      if (links.trim()) formData.append("links", links.trim());
      if (notes.trim()) formData.append("notes", notes.trim());
      await submitTaskWork(task._id, formData, token);
      addToast("Submitted successfully", "success");
      setFiles([]);
      setLinks("");
      setNotes("");
      loadMySubmission();
      loadAllSubmissions();
    } catch {
      addToast("Failed to submit", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (submissionId, status) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const { reviewSubmission } = await import("../../../../shared/services/api");
      await reviewSubmission(task._id, submissionId, status, feedbackText[submissionId] || "", token);
      addToast(`Submission ${status}`, "success");
      loadAllSubmissions();
      setReviewingSub(null);
    } catch {
      addToast("Failed to review", "error");
    }
  };

  if (!task) return null;

  const statusColors = {
    draft: "text-gray-500 border-gray-500/30",
    submitted: "text-yellow-400 border-yellow-500/30",
    reviewed: "text-cyan-400 border-cyan-500/30",
    approved: "text-green-400 border-green-500/30",
    rejected: "text-red-400 border-red-500/30",
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <h3 className="text-sm font-semibold text-white mb-3">📤 Submissions</h3>

      {/* Student submission form */}
      {!isAdmin && !isArchived && (
        <div className="space-y-3 mb-4">
          {mySubmission && (
            <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                statusColors[mySubmission.status] || "text-gray-500"
              }`}>
                {mySubmission.status}
              </span>
              <span className="text-[10px] text-gray-500">v{mySubmission.version}</span>
              {mySubmission.isFinal && <span className="text-[10px] text-yellow-500">Final</span>}
            </div>
          )}
          <input
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files))}
            className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20"
          />
          <input
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder="Links (comma separated)"
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/40"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes..."
            className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-3 py-1.5 text-xs text-white outline-none resize-none focus:border-cyan-500/40"
            rows={2}
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || (files.length === 0 && !links.trim())}
            className="rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-cyan-400 transition"
          >
            {submitting ? "Submitting..." : mySubmission ? "Update Submission" : "Submit"}
          </button>
        </div>
      )}

      {/* Teacher review panel */}
      {isAdmin && allSubmissions.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">All Submissions</p>
          {allSubmissions.map(sub => (
            <div key={sub._id} className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white">{sub.student?.name || "Unknown"}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-medium border ${
                    statusColors[sub.status] || "text-gray-500"
                  }`}>
                    {sub.status}
                  </span>
                </div>
                {sub.files?.length > 0 && (
                  <span className="text-[10px] text-gray-500">{sub.files.length} files</span>
                )}
              </div>
              {sub.notes && <p className="text-[10px] text-gray-400 mb-2">{sub.notes}</p>}
              {sub.status === "submitted" && (
                <div className="space-y-1.5">
                  <textarea
                    value={feedbackText[sub._id] || ""}
                    onChange={(e) => setFeedbackText(prev => ({ ...prev, [sub._id]: e.target.value }))}
                    placeholder="Feedback..."
                    className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-2 py-1 text-[10px] text-white outline-none resize-none focus:border-cyan-500/40"
                    rows={2}
                  />
                  <div className="flex gap-1.5">
                    <button onClick={() => handleReview(sub._id, "approved")} className="rounded bg-green-500/20 px-2 py-0.5 text-[10px] text-green-400 hover:bg-green-500/30">Approve</button>
                    <button onClick={() => handleReview(sub._id, "reviewed")} className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-400 hover:bg-cyan-500/30">Reviewed</button>
                    <button onClick={() => handleReview(sub._id, "rejected")} className="rounded bg-red-500/20 px-2 py-0.5 text-[10px] text-red-400 hover:bg-red-500/30">Reject</button>
                  </div>
                </div>
              )}
              {sub.feedback?.text && (
                <div className="mt-1 rounded bg-white/[0.02] px-2 py-1">
                  <p className="text-[10px] text-gray-500">Feedback: {sub.feedback.text}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isAdmin && mySubmission?.feedback?.text && (
        <div className="mt-3 rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
          <p className="text-[10px] text-gray-500 uppercase mb-1">Feedback</p>
          <p className="text-xs text-gray-300">{mySubmission.feedback.text}</p>
        </div>
      )}
    </div>
  );
}

export default memo(SubmissionPanel);
