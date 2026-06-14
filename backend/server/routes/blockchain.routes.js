const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const Task = require("../../../database/models/task.model");
const Community = require("../../../database/models/Community");
const Certificate = require("../../../database/models/Certificate");
const NFTJobQueue = require("../../../database/models/NFTJobQueue");
const { uploadCertificateToIPFS } = require("../../services/blockchain/ipfsService");
const {
  mintCertificate,
  getWalletInfo,
  getBlockchainStatus,
  validateBlockchainConfiguration,
  getDetailedBlockchainDiagnostics,
  verifyCertificateOnChain,
  getTransactionHistory,
} = require("../../services/blockchain/nftService");
const { enqueueMintJob, getJobStatus, getTransactionState } = require("../../services/blockchain/nftQueueProcessor");
const { isMintDuplicate } = require("../../services/blockchain/duplicateGuard");
const { findUserByAnyId } = require("../utils/userSync");

function getCertificateRecipientRoles() {
  const configuredRoles = String(process.env.CERTIFICATE_RECIPIENT_ROLES || "")
    .split(",").map(r => r.trim().toLowerCase()).filter(Boolean);
  return configuredRoles.length > 0 ? configuredRoles : ["student"];
}

function isCertificateRecipientRole(role) {
  return getCertificateRecipientRoles().includes(String(role || "").trim().toLowerCase());
}

// ─── POST /api/blockchain/enqueue ──────────────────────────
// Enqueue a mint job for the queue processor.
// Body: { communityId, taskId?, userId? }
// Prevents duplicates via issuanceId + blockchain check.
router.post("/enqueue", authMiddleware, async (req, res) => {
  try {
    const { communityId, taskId, userId } = req.body;
    const targetUserId = userId || req.user.id;

    if (!communityId) return res.status(400).json({ error: "communityId is required" });
    if (!mongoose.Types.ObjectId.isValid(communityId)) return res.status(400).json({ error: "Invalid communityId" });

    if (userId && !mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ error: "Invalid userId" });
    if (userId && userId !== req.user.id && !["admin", "teacher"].includes(req.user.role)) {
      return res.status(403).json({ error: "Only admins or teachers can enqueue for other users" });
    }

    // Dedup check (blockchain + queue)
    const duplicate = await isMintDuplicate(targetUserId, communityId, taskId);
    if (duplicate.isDuplicate) {
      return res.status(409).json({
        error: "Certificate already exists or is queued for this community",
        source: duplicate.source,
        certificateId: duplicate.certificateId,
      });
    }

    const recipient = await findUserByAnyId(targetUserId);
    if (!recipient) return res.status(404).json({ error: "User not found" });
    if (!isCertificateRecipientRole(recipient.role)) {
      return res.status(400).json({
        error: `Only ${getCertificateRecipientRoles().join(", ")} accounts can receive community task certificates`,
      });
    }
    if (!recipient.walletAddress) {
      return res.status(400).json({ error: "User has no wallet address connected" });
    }

    const allTasks = await Task.find({ community_id: communityId, assignedTo: targetUserId }).lean();
    if (allTasks.length === 0) {
      return res.status(400).json({ error: "No tasks found for this user in this community" });
    }
    const allCompleted = allTasks.every(t => t.completed_status);
    if (!allCompleted) {
      const completed = allTasks.filter(t => t.completed_status).length;
      return res.status(400).json({ error: `Not all tasks completed (${completed}/${allTasks.length})` });
    }

    const community = await Community.findById(communityId).lean();
    if (!community) return res.status(404).json({ error: "Community not found" });

    const result = await enqueueMintJob({
      userId: targetUserId,
      communityId,
      taskId: taskId || null,
      priority: req.user?.role === "admin" ? 5 : 0,
    });

    if (!result.queued) {
      return res.status(409).json({ error: `Job already ${result.reason}`, reason: result.reason });
    }

    res.status(201).json({
      success: true,
      message: "Mint job enqueued",
      jobId: result.job._id,
      status: result.job.status,
    });
  } catch (err) {
    console.error("Enqueue error:", err);
    res.status(500).json({ error: err.message || "Failed to enqueue mint job" });
  }
});

// ─── POST /api/blockchain/mint ────────────────────────────
// Legacy direct mint endpoint (bypasses queue).
// Use /enqueue for production; this is for admin/testing.
router.post("/mint", authMiddleware, async (req, res) => {
  try {
    const { communityId, userId } = req.body;
    const targetUserId = userId || req.user.id;

    if (!communityId) return res.status(400).json({ error: "communityId is required" });
    if (!mongoose.Types.ObjectId.isValid(communityId)) return res.status(400).json({ error: "Invalid communityId" });
    if (userId && !mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ error: "Invalid userId" });
    if (userId && userId !== req.user.id && !["admin", "teacher"].includes(req.user.role)) {
      return res.status(403).json({ error: "Only admins or teachers can mint for other users" });
    }

    const duplicate = await isMintDuplicate(targetUserId, communityId, null);
    if (duplicate.isDuplicate) {
      return res.status(409).json({
        error: "Certificate already exists or is queued",
        source: duplicate.source,
        certificateId: duplicate.certificateId,
      });
    }

    const recipient = await findUserByAnyId(targetUserId);
    if (!recipient) return res.status(404).json({ error: "User not found" });
    if (!isCertificateRecipientRole(recipient.role)) {
      return res.status(400).json({
        error: `Only ${getCertificateRecipientRoles().join(", ")} accounts can receive certificates`,
      });
    }
    if (!recipient.walletAddress) {
      return res.status(400).json({ error: "User has no wallet address connected" });
    }

    const allTasks = await Task.find({ community_id: communityId, assignedTo: targetUserId }).lean();
    if (allTasks.length === 0) return res.status(400).json({ error: "No tasks found" });
    const allCompleted = allTasks.every(t => t.completed_status);
    if (!allCompleted) {
      const completed = allTasks.filter(t => t.completed_status).length;
      return res.status(400).json({ error: `Not all tasks completed (${completed}/${allTasks.length})` });
    }

    const community = await Community.findById(communityId).lean();
    if (!community) return res.status(404).json({ error: "Community not found" });

    const { generateCertificate } = require("../utils/certificateGenerator");
    const { nanoid } = require("nanoid");
    const certificateId = `CERT-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
    const certificatePath = await generateCertificate({
      studentName: recipient.name,
      communityName: community.name,
      collegeName: community.college_name || "Virtual Campus",
      certificateId,
    });

    const { metadataURI, imageURI, imageHTTPS = "", metadataHTTPS = "" } = await uploadCertificateToIPFS({
      certificatePath,
      studentName: recipient.name,
      communityName: community.name,
      collegeName: community.college_name || "Virtual Campus",
      certificateId,
    });

    const mintResult = await mintCertificate(recipient.walletAddress, metadataURI);

    const certDoc = {
      certificateId,
      userId: recipient._id,
      communityId,
      communityName: community.name,
      collegeName: community.college_name,
      walletAddress: recipient.walletAddress,
      tokenId: mintResult.tokenId,
      transactionHash: mintResult.transactionHash,
      txHash: mintResult.transactionHash,
      tokenURI: metadataURI,
      metadataURI,
      imageURI,
      imageHTTPS,
      issuedAt: new Date(),
      mintedAt: new Date(),
      status: "completed",
      claimed: true,
      walletClaimed: true,
      claimedAt: new Date(),
      blockNumber: mintResult.blockNumber || null,
      gasUsed: mintResult.gasUsed || null,
    };

    await Certificate.create(certDoc);

    const { createNotification } = require("../controllers/notificationController");
    await createNotification({
      userId: targetUserId,
      message: `NFT certificate issued for ${community.name}`,
      type: "certificate_issued",
      relatedId: community._id,
      relatedType: "certificate",
      redirectUrl: "/my-certificates",
    }).catch(() => {});

    res.json({
      success: true,
      message: "NFT certificate minted successfully!",
      certificate: {
        certificateId,
        transactionHash: mintResult.transactionHash,
        tokenId: mintResult.tokenId,
        metadataURI,
        imageURI,
        contractAddress: mintResult.contractAddress,
        network: "Polygon Amoy Testnet",
        student: recipient.name,
        community: community.name,
      },
    });
  } catch (err) {
    console.error("Direct mint error:", err);
    res.status(500).json({ error: err.message || "Failed to mint NFT certificate" });
  }
});

// ─── GET /api/blockchain/queue/:jobId ─────────────────────
// Get status of a specific queue job.
router.get("/queue/:jobId", authMiddleware, async (req, res) => {
  try {
    const job = await NFTJobQueue.findById(req.params.jobId).lean();
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/blockchain/queue/user ───────────────────────
// Get all queue jobs for the current user.
router.get("/queue/user", authMiddleware, async (req, res) => {
  try {
    const jobs = await NFTJobQueue.find({ userId: req.user.id })
      .sort({ queuedAt: -1 })
      .limit(20)
      .lean();
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/blockchain/retry ───────────────────────────
// Retry a failed queue job.
router.post("/retry", authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ error: "jobId is required" });

    const { retryFailedJob } = require("../../services/blockchain/nftQueueProcessor");
    const job = await retryFailedJob(jobId);
    res.json({ success: true, status: job.status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ─── POST /api/blockchain/retry-certificate ───────────────
// Legacy retry endpoint for failed certificates.
router.post("/retry-certificate", authMiddleware, async (req, res) => {
  try {
    const { certificateId } = req.body;
    if (!certificateId) return res.status(400).json({ error: "certificateId is required" });

    const failedCert = await Certificate.findOne({
      certificateId,
      userId: req.user.id,
      status: "failed",
    });

    if (!failedCert) return res.status(404).json({ error: "Failed certificate not found" });
    if (!failedCert.metadataURI) return res.status(400).json({ error: "Metadata URI not available" });

    const recipient = await findUserByAnyId(req.user.id);
    if (!recipient?.walletAddress) return res.status(400).json({ error: "Wallet not connected" });

    const mintResult = await mintCertificate(recipient.walletAddress, failedCert.metadataURI);

    await Certificate.findByIdAndUpdate(failedCert._id, {
      $set: {
        status: "completed",
        txHash: mintResult.transactionHash,
        transactionHash: mintResult.transactionHash,
        tokenId: mintResult.tokenId,
        blockNumber: mintResult.blockNumber,
        gasUsed: mintResult.gasUsed,
        mintedAt: new Date(),
        failureReason: null,
        claimed: true,
        walletClaimed: true,
        claimedAt: new Date(),
      },
    });

    res.json({
      success: true,
      certificate: {
        certificateId,
        transactionHash: mintResult.transactionHash,
        tokenId: mintResult.tokenId,
        status: "completed",
      },
    });
  } catch (err) {
    console.error("Retry certificate error:", err);
    res.status(500).json({ error: err.message || "Failed to retry" });
  }
});

// ─── GET /api/blockchain/status ───────────────────────────
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const status = await getBlockchainStatus();
    res.json(status);
  } catch (err) {
    res.json({ success: false, connected: false, error: err.message });
  }
});

// ─── GET /api/blockchain/diagnose ─────────────────────────
router.get("/diagnose", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "teacher"].includes(req.user?.role)) {
      return res.status(403).json({ error: "Only admins and teachers can access diagnostics" });
    }
    const diagnostics = await getDetailedBlockchainDiagnostics();
    const activeQueue = await NFTJobQueue.countDocuments({ status: { $in: ["pending", "retrying"] } });
    const failedQueue = await NFTJobQueue.countDocuments({ status: "failed" });
    const queuedJobs = await NFTJobQueue.countDocuments({ status: { $nin: ["completed", "failed"] } });
    res.json({ ...diagnostics, queue: { active: activeQueue, failed: failedQueue, queued: queuedJobs } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/blockchain/validate ─────────────────────────
router.get("/validate", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "teacher"].includes(req.user?.role)) {
      return res.status(403).json({ error: "Only admins and teachers can validate blockchain" });
    }
    const validation = await validateBlockchainConfiguration();
    res.json(validation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/blockchain/verify/:certificateId ────────────
// Public blockchain verification endpoint.
router.get("/verify/:certificateId", async (req, res) => {
  try {
    const cert = await Certificate.findOne({ certificateId: req.params.certificateId }).lean();
    if (!cert) return res.status(404).json({ error: "Certificate not found" });

    if (!cert.tokenId) {
      return res.json({ exists: false, verified: false, reason: "Not minted on blockchain" });
    }

    const result = await verifyCertificateOnChain({
      tokenId: cert.tokenId,
      expectedOwner: cert.walletAddress || null,
      expectedMetadataURI: cert.metadataURI || null,
    });

    res.json({
      certificateId: cert.certificateId,
      tokenId: cert.tokenId,
      contractAddress: cert.contractAddress,
      onChain: result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/blockchain/tx-history ──────────────────────
// ADMIN: View recent transaction state history.
router.get("/tx-history", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "teacher"].includes(req.user?.role)) {
      return res.status(403).json({ error: "Access denied" });
    }
    const history = await getTransactionHistory();
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
