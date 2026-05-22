// ─────────────────────────────────────────────────────────────
// Blockchain Routes — NFT Minting & Blockchain Info Endpoints
// ─────────────────────────────────────────────────────────────
// These endpoints expose blockchain functionality via REST API:
//
// POST /api/blockchain/mint    — Manually trigger NFT minting
// GET  /api/blockchain/status  — Check blockchain connection status
// GET  /api/blockchain/verify/:txHash — Verify a transaction on-chain
// ─────────────────────────────────────────────────────────────

const express = require("express");
const mongoose = require("mongoose");
const { nanoid } = require("nanoid");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const Task = require("../../database/models/task.model");
const Community = require("../../database/models/Community");
const Certificate = require("../../database/models/Certificate");
const { generateCertificate } = require("../utils/certificateGenerator");
const { uploadCertificateToIPFS } = require("../../blockchain/ipfsService");
const { mintCertificate, getWalletInfo, getBlockchainStatus, validateBlockchainConfiguration, getDetailedBlockchainDiagnostics } = require("../../blockchain/nftService");
const { findUserByAnyId, syncLegacyUserRecord } = require("../utils/userSync");
const { createNotification } = require("../controllers/notificationController");

function getCertificateRecipientRoles() {
  const configuredRoles = String(process.env.CERTIFICATE_RECIPIENT_ROLES || "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);

  return configuredRoles.length > 0 ? configuredRoles : ["student"];
}

function isCertificateRecipientRole(role) {
  return getCertificateRecipientRoles().includes(String(role || "").trim().toLowerCase());
}

// ─── POST /api/blockchain/mint ─────────────────────────────
// Manually trigger NFT certificate minting for a student who
// has completed all tasks in a community.
//
// Body: { communityId: "...", userId: "..." (optional, defaults to current user) }
//
// This endpoint is useful for:
// - Admin-triggered minting
// - Retrying a failed automatic mint
// - Testing the minting pipeline
// ─────────────────────────────────────────────────────────────
router.post("/mint", authMiddleware, async (req, res) => {
  try {
    const { communityId, userId } = req.body;
    const targetUserId = userId || req.user.id;

    if (!communityId) {
      return res.status(400).json({ error: "communityId is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return res.status(400).json({ error: "Invalid communityId" });
    }

    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId" });
    }

    // Only allow elevated roles to mint for other users
    if (userId && userId !== req.user.id && !["admin", "teacher"].includes(req.user.role)) {
      return res.status(403).json({ error: "Only admins or teachers can mint certificates for other users" });
    }

    // 1. Verify user exists and has a wallet
    const recipient = await findUserByAnyId(targetUserId);

    if (!recipient) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!isCertificateRecipientRole(recipient.role)) {
      return res.status(400).json({
        error: `Only ${getCertificateRecipientRoles().join(", ")} accounts can receive community task certificates`,
      });
    }

    if (recipient.collection?.name !== "users") {
      await syncLegacyUserRecord(recipient);
    }

    if (!recipient.walletAddress) {
      return res.status(400).json({ error: "User has no wallet address connected. Connect MetaMask first." });
    }

    // 2. Verify all tasks are completed
    const allTasks = await Task.find({
      community_id: communityId,
      assignedTo: targetUserId,
    });

    if (allTasks.length === 0) {
      return res.status(400).json({ error: "No tasks found for this user in this community" });
    }

    const allCompleted = allTasks.every((t) => t.completed_status);
    if (!allCompleted) {
      const completed = allTasks.filter((t) => t.completed_status).length;
      return res.status(400).json({
        error: `Not all tasks completed (${completed}/${allTasks.length})`,
      });
    }

    // 3. Check for existing certificate to prevent duplicates
    const existingCert = await Certificate.findOne({ userId: targetUserId, communityId }).lean();
    if (existingCert) {
      return res.status(409).json({
        error: "Certificate already exists for this user in this community",
        existing: {
          certificateId: existingCert.certificateId,
          tokenId: existingCert.tokenId,
          transactionHash: existingCert.transactionHash,
          status: existingCert.status,
        },
      });
    }

    // 4. Load community
    const community = await Community.findById(communityId);

    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    // 5. Generate certificate
    const certificateId = `CERT-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
    const certificatePath = await generateCertificate({
      studentName: recipient.name,
      communityName: community.name,
      collegeName: community.college_name || "Virtual Campus",
      certificateId,
    });

    // 6. Upload to IPFS
    const { metadataURI, imageURI, imageHTTPS = "", metadataHTTPS = "" } = await uploadCertificateToIPFS({
      certificatePath,
      studentName: recipient.name,
      communityName: community.name,
      collegeName: community.college_name || "Virtual Campus",
      certificateId,
    });

    // 7. Mint NFT on Polygon (MUST pass ipfs:// URI — MetaMask resolves it natively)
    const mintResult = await mintCertificate(recipient.walletAddress, metadataURI);

    // 8. Persist as a separate Certificate document (avoid overwriting user record)
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
      metadataURI: metadataURI,
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

    const createdCert = await Certificate.create(certDoc);
    // Optionally sync legacy user if needed (no NFT array update is performed here)
    const updatedRecipient = recipient; // keep existing reference for downstream logic

    if (updatedRecipient && updatedRecipient.collection && updatedRecipient.collection?.name !== "users") {
      await syncLegacyUserRecord(updatedRecipient);
    }

    await createNotification({
      userId: targetUserId,
      message: `NFT certificate issued for ${community.name}`,
      type: "certificate_issued",
      relatedId: community._id,
      relatedType: "certificate",
      redirectUrl: "/my-certificates",
    });

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
    console.error("Manual mint error:", err);
    res.status(500).json({ error: err.message || "Failed to mint NFT certificate" });
  }
});

// ─── POST /api/blockchain/retry-certificate ─────────────────
// Retry minting a previously failed certificate
// Body: { certificateId: "..." }
// Only the student who owns the certificate can retry it.
// ───────────────────────────────────────────────────────────
router.post("/retry-certificate", authMiddleware, async (req, res) => {
  try {
    const { certificateId } = req.body;

    if (!certificateId) {
      return res.status(400).json({ error: "certificateId is required" });
    }

    const userId = req.user.id || req.user._id?.toString();
    const recipient = await findUserByAnyId(userId);

    if (!recipient) {
      return res.status(404).json({ error: "User not found" });
    }

    // Use Certificate collection as source of truth
    const failedCert = await Certificate.findOne({
      certificateId,
      userId: recipient._id,
    });

    if (!failedCert) {
      return res.status(404).json({ error: "Certificate not found" });
    }

    if (failedCert.status !== "failed") {
      return res.status(400).json({
        error: `Certificate is not in failed state (current: ${failedCert.status})`,
      });
    }

    if (!failedCert.metadataURI) {
      return res.status(400).json({
        error: "Cannot retry: metadata URI not available",
      });
    }

    if (!recipient.walletAddress) {
      return res.status(400).json({
        error: "Wallet not connected. Connect MetaMask first.",
      });
    }

    // Update certificate to "tx_submitted" state
    const updateResult = await Certificate.findByIdAndUpdate(
      failedCert._id,
      {
        $set: {
          status: "tx_submitted",
          lastAttemptedAt: new Date(),
          retryCount: (failedCert.retryCount || 0) + 1,
        },
      },
      { new: true }
    );

    if (!updateResult) {
      return res.status(500).json({ error: "Failed to update certificate state" });
    }

    // Attempt to mint
    try {
      const mintResult = await mintCertificate(recipient.walletAddress, failedCert.metadataURI);

      // Update to confirmed state
      await Certificate.findByIdAndUpdate(
        failedCert._id,
        {
          $set: {
            status: "confirmed",
            txHash: mintResult.transactionHash,
            transactionHash: mintResult.transactionHash,
            tokenId: mintResult.tokenId,
            blockNumber: mintResult.blockNumber,
            gasUsed: mintResult.gasUsed,
            mintedAt: new Date(),
            failureReason: null,
          },
        }
      );

      res.json({
        success: true,
        message: "Certificate retry successful!",
        certificate: {
          certificateId,
          transactionHash: mintResult.transactionHash,
          tokenId: mintResult.tokenId,
          status: "confirmed",
        },
      });
    } catch (mintErr) {
      // Update to failed state with new error
      await Certificate.findByIdAndUpdate(
        failedCert._id,
        {
          $set: {
            status: "failed",
            failureReason: mintErr.message,
          },
        }
      );

      return res.status(400).json({
        error: "Retry failed",
        reason: mintErr.message,
      });
    }
  } catch (err) {
    console.error("Retry certificate error:", err);
    res.status(500).json({
      error: "Failed to retry certificate",
      message: err.message,
    });
  }
});

// ─── GET /api/blockchain/status ─────────────────────────────
// Check the blockchain connection status and platform wallet info.
// Useful for admin health checks and debugging.
// Returns:
//   - RPC connection status
//   - Signer address and whether it matches contract owner
//   - Contract address and total supply
//   - Minting capability
// ─────────────────────────────────────────────────────────────
router.get("/status", authMiddleware, async (req, res) => {
  try {
    const status = await getBlockchainStatus();
    res.json(status);
  } catch (err) {
    res.json({
      success: false,
      connected: false,
      error: err.message,
    });
  }
});

// ─── GET /api/blockchain/diagnose ───────────────────────────
// ADMIN-ONLY: Comprehensive blockchain diagnostics for debugging
// Returns detailed information about:
//   - Configuration validation
//   - Connection status
//   - Signer/wallet information
//   - Contract status
// This endpoint helps identify root causes of minting failures.
// ───────────────────────────────────────────────────────────
router.get("/diagnose", authMiddleware, async (req, res) => {
  try {
    // Admin/teacher only
    if (!["admin", "teacher"].includes(req.user?.role)) {
      return res.status(403).json({ error: "Only admins and teachers can access diagnostics" });
    }

    const diagnostics = await getDetailedBlockchainDiagnostics();
    res.json(diagnostics);
  } catch (err) {
    console.error("Blockchain diagnostics error:", err);
    res.status(500).json({
      error: "Failed to retrieve blockchain diagnostics",
      message: err.message,
    });
  }
});

// ─── GET /api/blockchain/validate ───────────────────────────
// ADMIN-ONLY: Validate blockchain configuration before minting
// Returns list of errors and warnings found in configuration.
// Useful before attempting certificate issuance.
// ───────────────────────────────────────────────────────────
router.get("/validate", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "teacher"].includes(req.user?.role)) {
      return res.status(403).json({ error: "Only admins and teachers can validate blockchain" });
    }

    const validation = await validateBlockchainConfiguration();
    res.json({
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    });
  } catch (err) {
    console.error("Blockchain validation error:", err);
    res.status(500).json({
      error: "Failed to validate blockchain configuration",
      message: err.message,
    });
  }
});

module.exports = router;
