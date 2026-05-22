import { useState, useEffect, useCallback } from "react";
import { useSocket } from "../../../shared/services/SocketContext";

const STAGE_LABELS = {
  pending: "Queued",
  generating_metadata: "Generating Certificate",
  uploading_ipfs: "Uploading to IPFS",
  minting: "Minting on Blockchain",
  confirming: "Confirming Transaction",
  completed: "Completed",
  failed: "Failed",
  retrying: "Retrying",
};

const STAGE_ORDER = [
  "pending",
  "generating_metadata",
  "uploading_ipfs",
  "minting",
  "confirming",
  "completed",
];

function getStageProgress(stage) {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx >= 0 ? ((idx + 1) / STAGE_ORDER.length) * 100 : 0;
}

function useMintProgress() {
  const { socket } = useSocket();
  const [activeJobs, setActiveJobs] = useState([]);
  const [lastCompleted, setLastCompleted] = useState(null);
  const [lastFailed, setLastFailed] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const handleProgress = (data) => {
      setActiveJobs(prev => {
        const filtered = prev.filter(j => j.jobId !== data.jobId);
        return [...filtered, {
          jobId: data.jobId,
          status: data.status,
          message: data.message || STAGE_LABELS[data.status] || data.status,
          progress: getStageProgress(data.status),
          updatedAt: Date.now(),
        }];
      });
    };

    const handleComplete = (data) => {
      const { certificate } = data;
      setLastCompleted(certificate);
      setActiveJobs(prev => prev.filter(j => j.jobId !== certificate?.jobId));
    };

    const handleFailed = (data) => {
      setLastFailed(data);
      setActiveJobs(prev => prev.filter(j => j.jobId !== data.jobId));
    };

    socket.on("nft:mint-progress", handleProgress);
    socket.on("nft:mint-complete", handleComplete);
    socket.on("nft:mint-failed", handleFailed);

    return () => {
      socket.off("nft:mint-progress", handleProgress);
      socket.off("nft:mint-complete", handleComplete);
      socket.off("nft:mint-failed", handleFailed);
    };
  }, [socket]);

  const clearCompleted = useCallback(() => setLastCompleted(null), []);
  const clearFailed = useCallback(() => setLastFailed(null), []);

  return {
    activeJobs,
    lastCompleted,
    lastFailed,
    clearCompleted,
    clearFailed,
    isMinting: activeJobs.length > 0,
  };
}

export { useMintProgress, STAGE_LABELS, STAGE_ORDER, getStageProgress };
