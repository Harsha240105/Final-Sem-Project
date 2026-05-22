const mongoose = require("mongoose");
const { nanoid } = require("nanoid");
const Task = require("../../database/models/task.model");
const User = require("../../database/models/User");
const Community = require("../../database/models/Community");
const { generateCertificate } = require("../utils/certificateGenerator");
const { uploadCertificateToIPFS } = require("../../blockchain/ipfsService");
const Certificate = require("../../database/models/Certificate");
const { mintCertificate: mintNFT } = require("../../blockchain/nftService");
const { findUserByAnyId, syncLegacyUserRecord, resolveWalletAcrossModels } = require("../utils/userSync");
const { createNotification } = require("./notificationController");
const { logger } = require("../utils/logger");
const log = logger("TaskCtrl");

const DEFAULT_CERTIFICATE_RECIPIENT_ROLES = ["student"];

function normalizePrivateKey(rawPrivateKey) {
  const value = String(rawPrivateKey || "")
    .trim()
    .replace(/^['"]|['"]$/g, "");

  if (/^[a-fA-F0-9]{64}$/.test(value)) {
    return `0x${value}`;
  }

  if (/^0x[a-fA-F0-9]{64}$/.test(value)) {
    return value;
  }

  return null;
}

async function hasCertificateForCommunity(userDoc, communityId) {
  if (!userDoc || !userDoc._id) {
    return false;
  }
  try {
    const count = await Certificate.countDocuments({ userId: userDoc._id, communityId });
    return count > 0;
  } catch (e) {
    console.error("[Certificate] hasCertificateForCommunity error:", e);
    return false;
  }
}

async function persistCertificateForMember(memberDoc, nftRecord) {
  const memberId = memberDoc?._id?.toString();
  if (!memberId) {
    throw new Error("Invalid member id for certificate persistence");
  }

  log.info(`[PERSIST] Starting persistence for member=${memberId}, cert=${nftRecord.certificateId}`);

  logCertificatePipeline("persist:start", {
    memberId,
    certificateId: nftRecord.certificateId,
    tokenId: nftRecord.tokenId,
    status: nftRecord.status,
  });

  try {
    const certDoc = {
      certificateId: nftRecord.certificateId,
      userId: memberDoc._id,
      taskId: nftRecord.taskId || null,
      communityId: nftRecord.communityId,
      communityName: nftRecord.communityName,
      collegeName: nftRecord.collegeName,
      walletAddress: nftRecord.walletAddress,
      tokenId: nftRecord.tokenId,
      transactionHash: nftRecord.transactionHash || nftRecord.txHash,
      txHash: nftRecord.txHash,
      tokenURI: nftRecord.tokenURI || nftRecord.metadataHTTPS || nftRecord.metadataURI,
      metadataURI: nftRecord.metadataURI,
      metadataHTTPS: nftRecord.metadataHTTPS || "",
      imageURI: nftRecord.imageURI,
      imageHTTPS: nftRecord.imageHTTPS || "",
      issuedAt: nftRecord.issuedAt || new Date(),
      mintedAt: nftRecord.mintedAt || new Date(),
      status: nftRecord.status === "failed" ? "failed" : "completed",
      claimed: nftRecord.status === "confirmed" || nftRecord.status === "claimed" || nftRecord.status === "completed",
      walletClaimed: nftRecord.status === "confirmed" || nftRecord.status === "claimed" || nftRecord.status === "completed",
      claimedAt: nftRecord.status === "confirmed" || nftRecord.status === "claimed" || nftRecord.status === "completed" ? new Date() : null,
      blockNumber: nftRecord.blockNumber || null,
      gasUsed: nftRecord.gasUsed || null,
    };

    log.info(`[PERSIST] Creating/updating Certificate document... userId=${memberDoc._id?.toString()} wallet=${nftRecord.walletAddress?.substring(0, 10)}`);
    const filter = { userId: memberDoc._id, communityId: nftRecord.communityId };
    if (nftRecord.taskId) {
      filter.taskId = nftRecord.taskId;
    }
    const createdCert = await Certificate.findOneAndUpdate(
      filter,
      { $set: certDoc, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true }
    );
    
    log.info(`[PERSIST] ✅ Certificate saved: ID=${createdCert._id}, certId=${createdCert.certificateId}, tokenId=${createdCert.tokenId}, upserted=${Boolean(createdCert)}`);
    
    logCertificatePipeline("persist:success", {
      memberId,
      certificateId: nftRecord.certificateId,
      tokenId: nftRecord.tokenId,
      dbId: createdCert._id.toString(),
      totalCerts: 1,
    });

    // Optional: sync legacy user if needed (compatibility layer)
    if (memberDoc.collection?.name !== "users") {
      const legacy = await User.findById(memberId);
      if (legacy) {
        // no-op for now; legacy data remains in-place
        logCertificatePipeline("persist:legacy-synced", { memberId });
      }
    }
    return createdCert;
  } catch (err) {
    console.error(`[PERSIST] ❌ ERROR persisting certificate:`, err.message);
    logCertificatePipeline("persist:error", {
      memberId,
      certificateId: nftRecord.certificateId,
      error: err.message,
    });
    throw err;
  }
}

async function addCompletedTaskToUser(userId, taskId) {
  if (!userId || !taskId) {
    return;
  }

  const resolvedUser = await findUserByAnyId(userId);
  if (!resolvedUser) {
    return;
  }

  const model = resolvedUser.constructor;
  const supportsCompletedTasks = Boolean(model?.schema?.path("completedTasks"));

  if (supportsCompletedTasks) {
    const updatedUser = await model.findByIdAndUpdate(
      userId,
      { $addToSet: { completedTasks: taskId } },
      { new: true }
    );

    if (updatedUser && updatedUser.collection?.name !== "users") {
      await syncLegacyUserRecord(updatedUser);
    }
    return;
  }

  await User.findByIdAndUpdate(userId, {
    $addToSet: { completedTasks: taskId },
  });
}

// ─── getCommunityTasksByAssignee → REFACTORED for completedBy tracking ───
// Now tracks which users completed each task in a community
async function getCommunityTasksByAssignee(communityId) {
  const tasks = await Task.find({ community_id: communityId })
    .select("_id completedBy completed_status")
    .lean();
  
  // Map: userId -> [tasks completed by that user]
  const tasksByAssignee = new Map();
  // Map: taskId -> [users who completed it]
  const usersByTask = new Map();

  for (const task of tasks) {
    usersByTask.set(task._id.toString(), []);
    
    // Track completion per user
    if (task.completedBy && Array.isArray(task.completedBy)) {
      for (const completion of task.completedBy) {
        const userId = completion.userId?.toString();
        if (!userId) continue;

        if (!tasksByAssignee.has(userId)) {
          tasksByAssignee.set(userId, []);
        }
        tasksByAssignee.get(userId).push({
          _id: task._id,
          completed_status: task.completed_status,
          completedAt: completion.completedAt,
        });

        usersByTask.get(task._id.toString()).push(userId);
      }
    }
  }

  return { tasksByAssignee, usersByTask };
}

function buildTaskCompletionSummary(tasks = []) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.completed_status === true).length;

  return {
    totalTasks,
    completedTasks,
    allCompleted: totalTasks > 0 && completedTasks === totalTasks,
  };
}

function getCommunityMemberIds(community) {
  return (community?.members || [])
    .map((member) => member?._id || member || null)
    .filter(Boolean)
    .map((memberId) => memberId.toString());
}

function logCertificatePipeline(stage, payload = {}) {
  try {
    log.info(`[Certificate Pipeline][${stage}] ${JSON.stringify(payload)}`);
  } catch {
    log.info(`[Certificate Pipeline][${stage}]`, payload);
  }
}

function normalizeWalletAddress(walletAddress) {
  return String(walletAddress || "").trim().toLowerCase();
}

function getCertificateRecipientRoles() {
  const configuredRoles = String(process.env.CERTIFICATE_RECIPIENT_ROLES || "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);

  return configuredRoles.length > 0 ? configuredRoles : DEFAULT_CERTIFICATE_RECIPIENT_ROLES;
}

function isCertificateRecipientRole(role) {
  return getCertificateRecipientRoles().includes(String(role || "").trim().toLowerCase());
}

function getCertificateRecipientLabel(count = 1) {
  const recipientRoles = getCertificateRecipientRoles();
  if (recipientRoles.length === 1 && recipientRoles[0] === "student") {
    return count === 1 ? "student" : "students";
  }

  return count === 1 ? "recipient" : "recipients";
}

function getCertificateIssuanceConfigError() {
  const requiredEnvVars = ["PINATA_API_KEY", "PINATA_SECRET_KEY", "CONTRACT_ADDRESS", "WALLET_PRIVATE_KEY"];
  const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    return `Server configuration missing: ${missingEnvVars.join(", ")}`;
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(String(process.env.CONTRACT_ADDRESS || "").trim())) {
    return "Server configuration invalid: CONTRACT_ADDRESS must be a valid EVM address";
  }

  if (!normalizePrivateKey(process.env.WALLET_PRIVATE_KEY)) {
    return "Server configuration invalid: WALLET_PRIVATE_KEY must be 0x + 64 hex chars";
  }

  return null;
}

function getCertificateIssuanceConfigCode(configError) {
  if (!configError) {
    return null;
  }

  return configError.startsWith("Server configuration missing:")
    ? "server_config_missing"
    : "server_config_invalid";
}

function isValidWalletAddress(walletAddress) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(walletAddress || "").trim());
}

function buildNonIssuedCertificateResult(result) {
  return {
    status: "fulfilled",
    value: {
      memberId: result?.memberId || null,
      userName: result?.userName || null,
      issued: false,
      reason: result?.reason || "Certificate was not issued",
      code: result?.code || "certificate_not_issued",
      taskSummary: result?.taskSummary || null,
    },
  };
}

function formatCertificateIssue({ memberId = null, userName = null, reason, code = "certificate_not_issued" }) {
  return {
    memberId,
    userName,
    reason,
    code,
    displayMessage: userName ? `${userName}: ${reason}` : reason,
  };
}

function collectCertificateIssues(results = []) {
  return results.reduce((issues, entry) => {
    if (entry?.status === "rejected") {
      issues.push(
        formatCertificateIssue({
          reason: entry?.reason || "Unknown certificate issuance error",
          code: "issuance_error",
        })
      );
      return issues;
    }

    const value = entry?.value;
    if (value?.issued || !value?.reason || value?.code === "role_not_eligible") {
      return issues;
    }

    issues.push(
      formatCertificateIssue({
        memberId: value.memberId || null,
        userName: value.userName || null,
        reason: value.reason,
        code: value.code || "certificate_not_issued",
      })
    );
    return issues;
  }, []);
}

function isActionableCertificateIssue(issue) {
  return [
    "wallet_not_connected",
    "invalid_wallet_address",
    "server_config_missing",
    "server_config_invalid",
    "issuance_error",
  ].includes(issue?.code);
}

function buildCertificateCompletionMessage({
  wasAlreadyCompleted,
  issuedCount,
  actionableIssueCount,
  issueList,
  recipientCandidateCount,
}) {
  const prefix = wasAlreadyCompleted ? "Task was already completed." : "Task completed.";
  const actionableRecipientLabel = getCertificateRecipientLabel(
    actionableIssueCount === 1 ? 1 : 2
  );

  if (issuedCount > 0 && actionableIssueCount === 0) {
    return `${prefix} Issued certificates to ${issuedCount} eligible ${getCertificateRecipientLabel(issuedCount)}.`;
  }

  if (issuedCount > 0 && actionableIssueCount > 0) {
    return `${prefix} Issued certificates to ${issuedCount} eligible ${getCertificateRecipientLabel(issuedCount)}, but ${actionableIssueCount} ${actionableRecipientLabel} still need wallet/configuration fixes. Check the issue list in results.`;
  }

  if (actionableIssueCount > 0) {
    return `${prefix} No certificates were issued yet because ${actionableIssueCount} ${actionableRecipientLabel} still need wallet/configuration fixes. Check the issue list in results.`;
  }

  if (recipientCandidateCount === 0) {
    return `${prefix} No eligible ${getCertificateRecipientLabel(2)} were found in this community.`;
  }

  const pendingEligibilityCount = issueList.filter((issue) =>
    ["no_tasks_assigned", "tasks_incomplete"].includes(issue.code)
  ).length;

  if (pendingEligibilityCount > 0) {
    return `${prefix} No ${getCertificateRecipientLabel(2)} are eligible for certificates yet.`;
  }

  const alreadyMintedCount = issueList.filter((issue) => issue.code === "already_minted").length;
  if (alreadyMintedCount > 0) {
    return wasAlreadyCompleted
      ? `Task was already completed, and no eligible pending ${getCertificateRecipientLabel(2)} were found.`
      : `${prefix} No new certificates were issued because eligible ${getCertificateRecipientLabel(2)} already have community certificates.`;
  }

  return `${prefix} No new certificates were issued.`;
}

function getCertificateIssuanceStatus({
  issuedCount,
  actionableIssueCount,
  eligibleMemberCount,
  recipientCandidateCount,
  issueList,
}) {
  if (issuedCount > 0 && actionableIssueCount === 0) {
    return "success";
  }

  if (issuedCount > 0 && actionableIssueCount > 0) {
    return "partial";
  }

  if (actionableIssueCount > 0) {
    return "pending_retry";
  }

  if (recipientCandidateCount === 0) {
    return "not_eligible";
  }

  if (eligibleMemberCount === 0 && issueList.some((issue) => ["no_tasks_assigned", "tasks_incomplete"].includes(issue.code))) {
    return "not_eligible";
  }

  if (issueList.some((issue) => issue.code === "already_minted")) {
    return "already_issued";
  }

  return "none";
}

async function persistTaskCertificateIssuance(task, summary) {
  if (!task) {
    return;
  }

  task.certificateIssuance = {
    status: summary.certificateStatus || "none",
    message: summary.message || "",
    issuedCount: Number(summary.issuedCount || 0),
    skippedCount: Number(summary.skippedCount || 0),
    eligibleMemberCount: Number(summary.eligibleMemberCount || 0),
    ineligibleMemberCount: Number(summary.ineligibleMemberCount || 0),
    retryableIssueCount: Number(summary.retryableIssueCount || 0),
    retryAvailable: Boolean(summary.retryAvailable),
    issues: Array.isArray(summary.issues) ? summary.issues : [],
    lastAttemptedAt: new Date(),
  };

  await task.save();
}

async function resolveMemberCertificateEligibility({
  memberId,
  community,
  tasksByAssignee,
}) {
  const member = await findUserByAnyId(memberId);

  if (!member) {
    return {
      memberId: String(memberId),
      userName: null,
      eligible: false,
      reason: "User not found",
      code: "user_not_found",
    };
  }

  const memberIdString = member._id?.toString() || String(memberId);
  const assignedTasks = tasksByAssignee.get(memberIdString) || [];
  const taskSummary = buildTaskCompletionSummary(assignedTasks);
  const memberRole = String(member.role || "").trim().toLowerCase();

  if (!isCertificateRecipientRole(memberRole)) {
    return {
      member,
      memberId: memberIdString,
      userName: member.name,
      eligible: false,
      reason: `Role ${memberRole || "unknown"} is not eligible for community task certificates`,
      code: "role_not_eligible",
      taskSummary,
    };
  }

  if (taskSummary.totalTasks === 0) {
    return {
      member,
      memberId: memberIdString,
      userName: member.name,
      eligible: false,
      reason: "No tasks assigned in this community",
      code: "no_tasks_assigned",
      taskSummary,
    };
  }

  if (!taskSummary.allCompleted) {
    return {
      member,
      memberId: memberIdString,
      userName: member.name,
      eligible: false,
      reason: "Not all assigned tasks are completed",
      code: "tasks_incomplete",
      taskSummary,
    };
  }

  if (!member.walletAddress) {
    return {
      member,
      memberId: memberIdString,
      userName: member.name,
      eligible: false,
      reason: "Wallet not connected",
      code: "wallet_not_connected",
      taskSummary,
    };
  }

  if (!isValidWalletAddress(member.walletAddress)) {
    return {
      member,
      memberId: memberIdString,
      userName: member.name,
      eligible: false,
      reason: "Invalid wallet address",
      code: "invalid_wallet_address",
      taskSummary,
    };
  }

  const configError = getCertificateIssuanceConfigError();
  if (configError) {
    return {
      member,
      memberId: memberIdString,
      userName: member.name,
      eligible: false,
      reason: configError,
      code: getCertificateIssuanceConfigCode(configError),
      taskSummary,
    };
  }

  return {
    member,
    memberId: memberIdString,
    userName: member.name,
    eligible: true,
    taskSummary,
  };
}

async function issueCertificateToMember({ memberId, member: providedMember, community, taskId }) {
  const member = providedMember || (await findUserByAnyId(memberId));

  if (!member) {
    log.info(`[ISSUE CERT] ❌ Member not found: ${memberId}`);
    return {
      memberId: String(memberId),
      issued: false,
      reason: "User not found",
      code: "user_not_found",
    };
  }

  const memberIdString = member._id?.toString() || String(memberId);
  let normalizedWallet = normalizeWalletAddress(member.walletAddress);

  // If wallet missing from provided member, fallback: check other models
  // (handles dual-model mismatch where wallet is on Student but not User)
  if (!normalizedWallet) {
    const resolved = await resolveWalletAcrossModels(memberId, member.gmail || member.email);
    if (resolved) {
      log.info(`[ISSUE CERT] 🔄 Wallet resolved from fallback for ${member.name}: ${resolved.substring(0, 10)}...`);
      member.walletAddress = resolved;
      normalizedWallet = normalizeWalletAddress(member.walletAddress);
    }
  }

  // ── IDEMPOTENCY CHECK: Skip if certificate already completed for this user+community ──
  // Allow retrying failed certificates (status != "completed"/"claimed"/"confirmed")
  try {
    const existingQuery = { userId: member._id, communityId: community?._id };
    const existingCert = await Certificate.findOne(existingQuery).lean();
    if (existingCert) {
      const completedStatuses = ["completed", "claimed", "confirmed"];
      if (completedStatuses.includes(existingCert.status)) {
        log.info(`[ISSUE CERT] ⚠️ Completed certificate already exists for member=${memberIdString}, community=${community?.name}. Skipping duplicate mint.`);
        logCertificatePipeline("issue:already-exists", {
          memberId: memberIdString,
          userName: member.name,
          communityId: community?._id?.toString(),
          taskId: taskId?.toString(),
          existingCertId: existingCert.certificateId,
          existingStatus: existingCert.status,
        });
        return {
          memberId: memberIdString,
          userName: member.name,
          issued: true,
          certificateId: existingCert.certificateId,
          skipped: true,
          reason: "already_exists",
        };
      }
      log.info(`[ISSUE CERT] 🔄 Previous certificate found with status="${existingCert.status}" for member=${memberIdString}. Will retry minting.`);
    }
  } catch (checkErr) {
    console.error(`[ISSUE CERT] Error checking existing certificate:`, checkErr.message);
  }

  log.info(`[ISSUE CERT] Starting for member=${memberIdString}, name=${member.name}, community=${community?.name}`);

  logCertificatePipeline("issue:start", {
    memberId: memberIdString,
    userName: member.name,
    communityId: community?._id?.toString?.() || null,
    taskId: taskId?.toString?.() || null,
    hasWallet: Boolean(normalizedWallet),
  });

  if (!normalizedWallet) {
    log.info(`[ISSUE CERT] ❌ No wallet: ${member.name}`);
    return {
      memberId: memberIdString,
      userName: member.name,
      issued: false,
      reason: "Wallet not connected",
      code: "wallet_not_connected",
    };
  }

  if (!isValidWalletAddress(normalizedWallet)) {
    log.info(`[ISSUE CERT] ❌ Invalid wallet for ${member.name}`);
    return {
      memberId: memberIdString,
      userName: member.name,
      issued: false,
      reason: "Invalid wallet address",
      code: "invalid_wallet_address",
    };
  }

  const configError = getCertificateIssuanceConfigError();
  if (configError) {
    log.info(`[ISSUE CERT] ❌ Config error: ${configError}`);
    return {
      memberId: memberIdString,
      userName: member.name,
      issued: false,
      reason: configError,
      code: getCertificateIssuanceConfigCode(configError),
    };
  }

  const certificateId = `CERT-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
  log.info(`[ISSUE CERT] Generated cert ID: ${certificateId}`);

  try {
    log.info(`[ISSUE CERT] Generating certificate for ${member.name}...`);
    const certificatePath = await generateCertificate({
      studentName: member.name,
      communityName: community.name,
      collegeName: community.college_name || "Virtual Campus",
      certificateId,
    });

    log.info(`[ISSUE CERT] Certificate file generated: ${certificatePath}`);

    // Upload certificate and get both IPFS and HTTPS URLs
    log.info(`[ISSUE CERT] Uploading to IPFS...`);
    const { metadataURI, imageURI, imageHTTPS, metadataHTTPS } = await uploadCertificateToIPFS({
      certificatePath,
      studentName: member.name,
      communityName: community.name,
      collegeName: community.college_name || "Virtual Campus",
      certificateId,
    });

    log.info(`[ISSUE CERT] IPFS upload complete. MetadataURI=${metadataURI?.substring(0, 30)}`);

    log.info(`[ISSUE CERT] Minting NFT with metadataURI=${metadataURI?.substring(0, 50)}...`);
    const mintResult = await mintNFT(normalizedWallet, metadataURI);

    log.info(`[ISSUE CERT] ✅ NFT Minted! TokenID=${mintResult.tokenId}, TxHash=${mintResult.transactionHash?.substring(0, 15)}`);

    // Store BOTH IPFS and HTTPS URLs in the database
    const nftRecord = {
      certificateId,
      communityId: community._id,
      communityName: community.name,
      collegeName: community.college_name || "Virtual Campus",
      walletAddress: normalizedWallet,
      taskId,
      metadataURI,
      metadataHTTPS,
      tokenURI: metadataURI,
      imageURI,
      imageHTTPS,
      txHash: mintResult.transactionHash,
      transactionHash: mintResult.transactionHash,
      tokenId: mintResult.tokenId,
      blockNumber: mintResult.blockNumber || null,
      gasUsed: mintResult.gasUsed || null,
      issuedAt: new Date(),
      mintedAt: new Date(),
      status: "completed",
      claimed: true,
      claimedAt: new Date(),
      retryCount: 0,
    };

    log.info(`[ISSUE CERT] Persisting certificate to database...`);
    await persistCertificateForMember(member, nftRecord);
    log.info(`[ISSUE CERT] ✅ Certificate persisted for ${member.name}`);

    try {
      await createNotification({
        userId: memberIdString,
        message: `🎓 NFT certificate issued for ${community.name}! Token #${mintResult.tokenId}`,
        type: "certificate_issued",
        relatedId: community._id,
        relatedType: "certificate",
        redirectUrl: "/my-certificates",
      });
    } catch (notifErr) {
      console.error(`[ISSUE CERT] ⚠️ Notification failed (non-blocking): ${notifErr.message}`);
    }

    logCertificatePipeline("issue:success", {
      memberId: memberIdString,
      userName: member.name,
      certificateId,
      txHash: mintResult.transactionHash,
      tokenId: mintResult.tokenId,
      gasUsed: mintResult.gasUsed || null,
      imageHTTPS,
    });

    log.info(`[ISSUE CERT] ✅ SUCCESS: Certificate ${certificateId} issued to ${member.name}`);

    return {
      memberId: memberIdString,
      userName: member.name,
      issued: true,
      certificateId,
      metadataURI,
      metadataHTTPS,
      imageHTTPS,
      txHash: mintResult.transactionHash,
      tokenId: mintResult.tokenId,
    };
  } catch (error) {
    console.error(`[ISSUE CERT] ❌ EXCEPTION:`, error.message, error.stack);
    logCertificatePipeline("issue:failed", {
      memberId: memberIdString,
      userName: member.name,
      reason: error.message,
    });

    // IMPORTANT: Save failed state to DB so user can retry
    const failedNftRecord = {
      certificateId,
      communityId: community._id,
      communityName: community.name,
      taskId,
      status: "failed",
      failureReason: error.message,
      retryCount: 1,
      issuedAt: new Date(),
      lastAttemptedAt: new Date(),
    };

    try {
      await persistCertificateForMember(member, failedNftRecord);
    } catch (persistErr) {
      console.error(`[ISSUE CERT] ❌ Failed to persist error state for certificate ${certificateId}:`, persistErr.message);
    }

    return {
      memberId: memberIdString,
      userName: member.name,
      issued: false,
      reason: error.message,
      code: "issuance_error",
    };
  }
}

async function canAccessTask(task, user) {
  if (!task || !user) return false;
  const userId = user.id || user._id?.toString();
  if (!userId) return false;
  if (task.assignedTo?.toString() === userId) return true;
  if (["admin", "teacher", "community_manager"].includes(user.role)) return true;

  const community = await Community.findById(task.community_id).select("members");

  if (!community?.members?.length) return false;
  return community.members.some((memberId) => memberId.toString() === userId);
}

// ─── POST /api/tasks (TEACHER only - creates task for all community students) ───
const createTask = async (req, res) => {
  try {
    const { community_id, title, description } = req.body;
    const files = req.files || [];

    // DEBUG: Log incoming request payload
    log.info("[TASK CREATE] Request payload:", {
      community_id,
      title,
      description,
      fileCount: files.length,
      bodyKeys: Object.keys(req.body),
    });

    if (!community_id || !title?.trim()) {
      console.error("[TASK CREATE] Validation failed:", { community_id, title });
      return res.status(400).json({ error: "community_id and title are required" });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(community_id)) {
      return res.status(400).json({ error: "Invalid community_id" });
    }

    // Verify community exists
    const communityExists = await Community.findById(community_id);
    if (!communityExists) {
      return res.status(404).json({ error: "Community not found" });
    }

    const requesterId = req.user?.id || req.user?._id?.toString();
    if (!requesterId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let requester = await User.findById(requesterId);
    if (!requester) {
      const resolvedRequester = await findUserByAnyId(requesterId);
      if (resolvedRequester && resolvedRequester.collection?.name !== "users") {
        await syncLegacyUserRecord(resolvedRequester);
        requester = await User.findById(requesterId);
      }
    }

    if (!requester) {
      return res.status(404).json({ error: "User not found" });
    }

    // ROLE-BASED ACCESS: Only TEACHER can create tasks
    const isTeacher = requester.role === "teacher";
    if (!isTeacher) {
      return res.status(403).json({
        error: "Only teachers can create tasks",
      });
    }

    // Process file attachments
    const attachments = files.map((file) => ({
      fileName: file.originalname,
      fileUrl: `/uploads/tasks/${file.filename}`,
      mimeType: file.mimetype,
      uploadedBy: requesterId,
      uploadedAt: new Date(),
    }));

    // Create task available to ALL students in community (no assignedTo)
    const task = await Task.create({
      community_id,
      createdBy: requesterId,
      title: title.trim(),
      description: description?.trim() || "",
      attachments,
      completedBy: [],
    });

    await task.populate([
      { path: "createdBy", select: "name gmail avatar" },
      { path: "community_id", select: "name" },
      { path: "attachments.uploadedBy", select: "name" },
    ]);

    res.status(201).json(task);
  } catch (err) {
    console.error("createTask error:", err);
    res.status(500).json({ error: "Failed to create task" });
  }
};

// ─── GET /api/tasks/community/:communityId ───
const getTasksByCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(communityId)) {
      return res.status(400).json({ error: "Invalid communityId" });
    }

    const tasks = await Task.find({ community_id: communityId })
      .populate({ path: "createdBy", select: "name gmail avatar" })
      .populate({ path: "community_id", select: "name" })
      .populate({ path: "attachments.uploadedBy", select: "name" })
      .populate({ path: "completedBy.userId", select: "name avatar" })
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    console.error("getTasksByCommunity error:", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
};

// ─── PATCH /api/tasks/:taskId/mark-complete (STUDENT marks their own task completion) ───
const markTaskCompletedByStudent = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ error: "Invalid taskId" });
    }

    const task = await Task.findById(taskId).populate([
      { path: "community_id", select: "_id name members" },
      { path: "createdBy", select: "name" },
    ]);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const userId = req.user?.id || req.user?._id?.toString();
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if user is a member of this community
    const community = task.community_id;
    const isMember = (community?.members || []).some(
      (memberId) => memberId.toString() === userId
    );

    if (!isMember) {
      return res.status(403).json({ error: "You must be a member of this community to complete tasks" });
    }

    // Check if user has already completed this task
    const alreadyCompleted = task.completedBy?.some(
      (entry) => entry.userId?.toString() === userId || entry.userId === userId
    );

    if (alreadyCompleted) {
      return res.status(400).json({ error: "You have already completed this task" });
    }

    // Add student to completedBy array
    task.completedBy.push({
      userId,
      completedAt: new Date(),
    });

    await task.save();

    // Populate for response
    await task.populate([
      { path: "createdBy", select: "name gmail avatar" },
      { path: "community_id", select: "name" },
      { path: "attachments.uploadedBy", select: "name" },
      { path: "completedBy.userId", select: "name avatar" },
    ]);

    // Add task to user's completedTasks array
    await addCompletedTaskToUser(userId, task._id);

    // ─── Check if ALL tasks in this community are completed by this student ───
    // This triggers the automatic NFT certificate minting workflow.
    let nftResult = null;
    try {
      nftResult = await checkAndMintCertificate(userId, community._id);
    } catch (mintErr) {
      // Log the error but don't fail the task completion
      console.error("[Task Controller] NFT minting check failed (non-blocking):", mintErr.message);
    }

    res.json({
      ...task.toObject(),
      ...(nftResult ? { nft: nftResult } : {}),
    });
  } catch (err) {
    console.error("markTaskCompletedByStudent error:", err);
    res.status(500).json({ error: "Failed to mark task as completed" });
  }
};

// ─── PATCH /api/tasks/:taskId/complete (LEGACY - for backward compatibility) ───
const completeTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ error: "Invalid taskId" });
    }

    const task = await Task.findById(taskId).populate([
      { path: "community_id", select: "name" },
    ]);

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const userId = req.user?.id || req.user?._id?.toString();
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Check if student has already completed this task
    const alreadyCompleted = task.completedBy?.some(
      (entry) => entry.userId?.toString() === userId || entry.userId === userId
    );

    if (alreadyCompleted) {
      return res.status(400).json({ error: "You have already completed this task" });
    }

    // Add student to completedBy array
    task.completedBy.push({
      userId,
      completedAt: new Date(),
    });

    await task.save();

    // Add task to the user's completedTasks
    await addCompletedTaskToUser(userId, task._id);

    await task.populate([
      { path: "createdBy", select: "name gmail avatar" },
      { path: "community_id", select: "_id name" },
      { path: "completedBy.userId", select: "name avatar" },
    ]);

    // ─── Check if ALL tasks in this community are completed by this student ───
    // This triggers the automatic NFT certificate minting workflow.
    let nftResult = null;
    try {
      nftResult = await checkAndMintCertificate(userId, task.community_id._id || task.community_id);
    } catch (mintErr) {
      // Log the error but don't fail the task completion
      console.error("[Task Controller] NFT minting check failed (non-blocking):", mintErr.message);
    }

    res.json({
      ...task.toObject(),
      ...(nftResult ? { nft: nftResult } : {}),
    });
  } catch (err) {
    console.error("completeTask error:", err);
    res.status(500).json({ error: "Failed to complete task" });
  }
};

// ─── POST /api/tasks/:taskId/complete ───
const completeTaskAndIssueCertificates = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { studentIds } = req.body; // Optional: teacher-selected student IDs for manual issuance

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ error: "Invalid taskId" });
    }

    // ─── FETCH TASK WITH COMMUNITY MEMBERS POPULATED ───
    const task = await Task.findById(taskId).populate({
      path: "community_id",
      select: "name college_name members createdBy",
      model: "Community",
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    const community = task.community_id;
    if (!community) {
      return res.status(404).json({ error: "Community not found" });
    }

    // ─── ACCESS CONTROL ───
    const userId = req.user.id || req.user._id?.toString();
    const hasElevatedAccess = ["admin", "teacher"].includes(req.user?.role);
    if (!hasElevatedAccess && community.createdBy?.toString() !== userId) {
      return res.status(403).json({
        error: "Only community creator, admin, or teacher can complete this task and issue certificates",
      });
    }

    // ─── MARK TASK AS COMPLETED ───
    const wasAlreadyCompleted = Boolean(task.completed_status);
    if (!task.completed_status) {
      task.completed_status = true;
      await task.save();
    }

    // ─── FETCH COMMUNITY MEMBERS WITH POPULATED DATA ───
    logCertificatePipeline("batch:start", {
      taskId: task._id.toString(),
      communityId: community._id.toString(),
      wasAlreadyCompleted,
    });

    const communityWithMembers = await Community.findById(community._id).populate({
      path: "members",
      select: "_id name walletAddress role gmail",
    });

    const communityMembers = communityWithMembers?.members || [];
    logCertificatePipeline("batch:community-members-fetched", {
      taskId: task._id.toString(),
      communityId: community._id.toString(),
      totalMembers: communityMembers.length,
      memberIds: communityMembers.map((m) => m._id.toString()),
    });

    if (communityMembers.length === 0) {
      return res.status(400).json({
        error: "No members found in community",
        certificateStatus: "not_eligible",
        issuedCount: 0,
        failedCount: 0,
      });
    }

    // ─── BUILD ELIGIBLE STUDENTS LIST ───
    let eligibleStudents;

    if (Array.isArray(studentIds) && studentIds.length > 0) {
      // Manual selection mode: teacher explicitly selected these students.
      // The teacher's selection IS the authority — trust it.
      // Only require a wallet to mint the NFT.
      // First, resolve wallet addresses from primary models if missing from User model sync
      const selectedIdSet = new Set(studentIds.map((id) => id.toString()));
      const selectedMembers = communityMembers.filter((m) => m && selectedIdSet.has(m._id.toString()));
      for (const member of selectedMembers) {
        if (!member) continue;
        if (!member.walletAddress?.trim()) {
          const resolved = await resolveWalletAcrossModels(member._id, member.gmail || member.email);
          if (resolved) {
            member.walletAddress = resolved;
          }
        }
      }
      eligibleStudents = selectedMembers.filter((member) => {
        if (!member) return false;
        const hasWallet = Boolean(member.walletAddress?.trim());
        logCertificatePipeline("batch:member-manual-check", {
          memberId: member._id.toString(),
          memberName: member.name,
          isSelected: true,
          hasWallet,
          eligible: hasWallet,
        });
        return hasWallet;
      });
      log.info(`[MINT BATCH] Manual selection mode: ${eligibleStudents.length} students eligible out of ${studentIds.length} selected`);
    } else {
      // Automatic mode: only students who completed the task and have wallet
      const completedUserIds = new Set(
        (task.completedBy || [])
          .map((completion) => completion.userId?.toString())
          .filter(Boolean)
      );

      // Wallet fallback: resolve wallet from other models for members whose
      // User record doesn't have walletAddress (dual-model mismatch fix)
      for (const member of communityMembers) {
        if (!member) continue;
        if (!member.walletAddress?.trim() && completedUserIds.has(member._id.toString())) {
          const resolved = await resolveWalletAcrossModels(member._id, member.gmail || member.email);
          if (resolved) {
            log.info(`[MINT BATCH] Resolved wallet for ${member.name} from fallback`);
            member.walletAddress = resolved;
          }
        }
      }

      eligibleStudents = communityMembers.filter((member) => {
        if (!member) return false;
        const isCompleted = completedUserIds.has(member._id.toString());
        const hasWallet = Boolean(member.walletAddress?.trim());

        logCertificatePipeline("batch:member-eligibility-check", {
          memberId: member._id.toString(),
          memberName: member.name,
          isCompleted,
          hasWallet,
          eligible: isCompleted && hasWallet,
        });

        return isCompleted && hasWallet;
      });
    }

    logCertificatePipeline("batch:eligible-students", {
      taskId: task._id.toString(),
      communityId: community._id.toString(),
      eligibleCount: eligibleStudents.length,
      eligibleIds: eligibleStudents.map((s) => s._id.toString()),
    });

    // ─── VALIDATION: No eligible students ───
    if (eligibleStudents.length === 0) {
      const message = Array.isArray(studentIds) && studentIds.length > 0
        ? "None of the selected students have a wallet connected. Ask students to connect a wallet first."
        : "No students have completed this task yet.";

      logCertificatePipeline("batch:no-eligible-students", {
        taskId: task._id.toString(),
        communityId: community._id.toString(),
        message,
      });

      return res.status(200).json({
        message,
        certificateStatus: "not_eligible",
        issuedCount: 0,
        failedCount: 0,
        results: [],
      });
    }

    // ─── VALIDATION: Check blockchain configuration ───
    const configError = getCertificateIssuanceConfigError();
    if (configError) {
      logCertificatePipeline("batch:config-error", {
        taskId: task._id.toString(),
        error: configError,
      });

      return res.status(500).json({
        error: configError,
        certificateStatus: "config_error",
        issuedCount: 0,
        failedCount: 0,
      });
    }

    // ─── FILTER: Skip students who already have a COMPLETED certificate for this community ───
    // Allow retrying failed certificates
    const existingCerts = await Certificate.find({
      userId: { $in: eligibleStudents.map((s) => s._id) },
      communityId: community._id,
    }).select("userId status").lean();
    const completedStatuses = ["completed", "claimed", "confirmed"];
    const userIdsWithCompletedCert = new Set(
      existingCerts
        .filter((c) => completedStatuses.includes(c.status))
        .map((c) => c.userId.toString())
    );
    const userIdsWithFailedCert = new Set(
      existingCerts
        .filter((c) => !completedStatuses.includes(c.status))
        .map((c) => c.userId.toString())
    );
    const studentsToIssue = eligibleStudents.filter((s) => s && !userIdsWithCompletedCert.has(s._id.toString()));
    const skippedDueToExisting = eligibleStudents.length - studentsToIssue.length;

    if (skippedDueToExisting > 0) {
      log.info(`[MINT BATCH] Skipping ${skippedDueToExisting} students who already have completed certificates`);
    }
    if (userIdsWithFailedCert.size > 0) {
      log.info(`[MINT BATCH] Retrying ${userIdsWithFailedCert.size} student(s) with previously failed certificates`);
    }

    // ─── ISSUE CERTIFICATES TO ELIGIBLE STUDENTS ───
    const results = [];
    let issuedCount = 0;
    let failedCount = 0;

    log.info(`[MINT BATCH] Starting certificate minting for ${studentsToIssue.length} students (${skippedDueToExisting} already have certificates)`);

    for (const student of studentsToIssue) {
      if (!student) continue;
      try {
        log.info(`[MINT BATCH] Processing student #${eligibleStudents.indexOf(student) + 1}/${eligibleStudents.length}: ${student.name} (ID: ${student._id})`);

        logCertificatePipeline("batch:issuing", {
          taskId: task._id.toString(),
          communityId: community._id.toString(),
          studentId: student._id.toString(),
          studentName: student.name,
          studentIndex: eligibleStudents.indexOf(student) + 1,
          totalEligible: eligibleStudents.length,
        });

        const result = await issueCertificateToMember({
          memberId: student._id,
          member: student,
          community: {
            _id: community._id,
            name: community.name,
            college_name: community.college_name,
          },
          taskId: task._id,
        });

        log.info(`[MINT BATCH] Certificate result for ${student.name}:`, {
          issued: result.issued,
          tokenId: result.tokenId || "N/A",
          txHash: result.txHash?.substring(0, 10) || "N/A",
          reason: result.reason || "success",
        });

        results.push({
          status: "fulfilled",
          value: result,
        });

        if (result.issued) {
          issuedCount++;
          log.info(`[MINT BATCH] ✅ Certificate #${issuedCount} issued for ${student.name}`);
          logCertificatePipeline("batch:certificate-issued", {
            taskId: task._id.toString(),
            studentId: student._id.toString(),
            studentName: student.name,
            txHash: result.txHash,
            tokenId: result.tokenId,
            issuedIndex: issuedCount,
          });
        } else {
          failedCount++;
          log.info(`[MINT BATCH] ❌ Certificate failed for ${student.name}: ${result.reason}`);
          logCertificatePipeline("batch:certificate-failed", {
            taskId: task._id.toString(),
            studentId: student._id.toString(),
            studentName: student.name,
            reason: result.reason,
            failedIndex: failedCount,
          });
        }
      } catch (error) {
        failedCount++;
        console.error(`[MINT BATCH] ❌ ERROR minting for ${student.name}:`, error.message);
        logCertificatePipeline("batch:certificate-error", {
          taskId: task._id.toString(),
          studentId: student._id.toString(),
          studentName: student.name,
          error: error.message,
          errorIndex: failedCount,
        });

        results.push({
          status: "rejected",
          reason: error?.message || "Certificate issuance error",
          memberId: student._id.toString(),
          memberName: student.name,
        });
      }
    }

    log.info(`[MINT BATCH] Certificate minting complete: ${issuedCount} issued, ${failedCount} failed out of ${eligibleStudents.length}`);

    // ─── BUILD RESPONSE ───
    const totalAttempted = studentsToIssue.length;
    const certificateStatus =
      skippedDueToExisting === eligibleStudents.length
        ? "already_issued"
        : issuedCount === totalAttempted
          ? "success"
          : issuedCount > 0
            ? "partial"
            : "failed";

    const responseBody = {
      message:
        skippedDueToExisting === eligibleStudents.length
          ? `✓ All ${skippedDueToExisting} eligible student(s) already have certificates.`
          : issuedCount === totalAttempted
            ? `✓ Task completed. Issued certificates to all ${issuedCount} eligible student(s).${skippedDueToExisting > 0 ? ` (${skippedDueToExisting} already had certificates)` : ""}`
            : issuedCount > 0
              ? `⚠ Task completed. Issued ${issuedCount}/${totalAttempted} certificate(s). ${failedCount} failed.${skippedDueToExisting > 0 ? ` ${skippedDueToExisting} already had certificates.` : ""}`
              : `✗ Task completed. Failed to issue certificates. ${skippedDueToExisting > 0 ? ` (${skippedDueToExisting} already had certificates)` : ""}`,
      certificateStatus,
      task: {
        _id: task._id,
        title: task.title,
        community: {
          _id: community._id,
          name: community.name,
        },
      },
      issuedCount,
      failedCount,
      skippedDueToExisting,
      totalEligible: eligibleStudents.length,
      results,
    };

    logCertificatePipeline("batch:complete", {
      taskId: task._id.toString(),
      communityId: community._id.toString(),
      issuedCount,
      failedCount,
      totalEligible: eligibleStudents.length,
      certificateStatus,
    });

    return res.status(issuedCount > 0 ? 200 : 207).json(responseBody);
  } catch (err) {
    console.error("completeTaskAndIssueCertificates error:", err);
    logCertificatePipeline("batch:exception", {
      error: err.message,
      stack: err.stack,
    });
    return res.status(500).json({
      error: "Failed to complete task and issue certificates",
      details: err.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────
// checkAndMintCertificate — Automatic NFT Minting on Completion
// ─────────────────────────────────────────────────────────────
// WORKFLOW:
// 1. Fetch all tasks assigned to this student in this community.
// 2. Check if every task has completed_status === true.
// 3. If not all done, return null (no action).
// 4. If all done, load the student's wallet address from MongoDB.
// 5. Generate a certificate image using certificateGenerator.
// 6. Upload the image + metadata to IPFS via ipfsService.
// 7. Call the smart contract's mintCertificate() via nftService.
// 8. Save the NFT record in the user's document.
// 9. Return the transaction hash and certificate details.
// ─────────────────────────────────────────────────────────────
// ─── checkAndMintCertificate — COMMUNITY-SCOPED NFT Minting ───
// WORKFLOW:
// 1. Fetch community + verify user is member
// 2. Fetch all tasks in THIS community only
// 3. Check if user completed ALL tasks in THIS community
// 4. If not all done, skip (return)
// 5. If all done, mint certificate for THIS community only
// 6. Store tx hash, token ID, and metadata on-chain
// ────────────────────────────────────────────────────────────
async function checkAndMintCertificate(userId, communityId) {
  // ✅ STEP 1: Fetch community and verify user is member
  const community = await Community.findById(communityId).populate("members", "_id");

  if (!community) {
    log.info(`[NFT] Community ${communityId} not found`);
    return { skipped: true, reason: "Community not found" };
  }

  // ✅ Verify user is IN this community only
  const isMember = (community.members || []).some(
    (m) => m._id?.toString() === userId.toString()
  );
  if (!isMember) {
    log.info(`[NFT] User ${userId} is not a member of community ${communityId}`);
    return { skipped: true, reason: "User is not a member of this community" };
  }

  // ✅ STEP 2: Fetch ALL tasks in THIS community
  const allTasksInCommunity = await Task.find({ community_id: communityId })
    .select("_id completedBy completed_status")
    .lean();

  if (allTasksInCommunity.length === 0) {
    log.info(`[NFT] No tasks found in community ${communityId}`);
    return { skipped: true, reason: "No tasks in this community" };
  }

  // ✅ STEP 3: Check if user completed ALL tasks
  let completedTaskCount = 0;
  for (const task of allTasksInCommunity) {
    const userCompleted = task.completedBy?.some(
      (c) => c.userId?.toString() === userId.toString()
    );
    if (userCompleted) {
      completedTaskCount++;
    }
  }

  const allTasksCompleted = completedTaskCount === allTasksInCommunity.length;
  log.info(`[NFT] User completed ${completedTaskCount}/${allTasksInCommunity.length} tasks in community`);

  // ✅ STEP 4: If not all done, skip
  if (!allTasksCompleted) {
    return {
      skipped: true,
      reason: `User has completed ${completedTaskCount}/${allTasksInCommunity.length} tasks`,
      taskSummary: {
        completed: completedTaskCount,
        total: allTasksInCommunity.length,
      },
    };
  }

  // ✅ STEP 5: Load user and resolve wallet from legacy models
  let user = await User.findById(userId);
  if (!user) {
    const resolved = await findUserByAnyId(userId);
    if (resolved && resolved.collection?.name !== "users") {
      await syncLegacyUserRecord(resolved);
      user = await User.findById(userId);
    }
  }

  if (!user) {
    const resolved = await findUserByAnyId(userId, "walletAddress role name");
    if (!resolved) {
      return { skipped: true, reason: "User not found" };
    }
    user = resolved;
  }

  // Resolve wallet from legacy models if missing from User model
  let userWallet = user.walletAddress?.trim();
  if (!userWallet) {
    const fullUser = await findUserByAnyId(user._id, "walletAddress");
    if (fullUser?.walletAddress?.trim()) {
      userWallet = fullUser.walletAddress.trim();
    }
  }

  if (!userWallet) {
    log.info(`[NFT] User ${user.name} has no wallet address`);
    return { skipped: true, reason: "Wallet address not configured" };
  }

  // Ensure user.walletAddress is set for later use
  user.walletAddress = userWallet;

  // ✅ STEP 6: Check for existing COMPLETED certificate (allow retrying failed ones)
  const existingCert = await Certificate.findOne({ userId: user._id, communityId }).lean();
  if (existingCert) {
    const completedStatuses = ["completed", "claimed", "confirmed"];
    if (completedStatuses.includes(existingCert.status)) {
      log.info(`[NFT] ⚠️ Completed certificate already exists for ${user.name} in ${community.name}. Skipping duplicate mint.`);
      return {
        minted: true,
        skipped: true,
        certificateId: existingCert.certificateId,
        transactionHash: existingCert.transactionHash,
        tokenId: existingCert.tokenId,
        metadataURI: existingCert.metadataURI,
        communityId: communityId.toString(),
        communityName: community.name,
        network: "Polygon Amoy Testnet",
      };
    }
    log.info(`[NFT] 🔄 Previous certificate found with status="${existingCert.status}" for ${user.name}. Will retry minting.`);
  }

  // ✅ STEP 7: Mint NFT with proper transaction handling
  try {
    log.info(`[NFT] Minting certificate for ${user.name} in community ${community.name}...`);
    const mintResult = await issueCertificateToMember({
      memberId: user._id,
      member: user,
      community,
      taskId: null,
    });

    if (!mintResult.issued) {
      console.error(`[NFT] Failed to mint: ${mintResult.reason}`);
      return { skipped: true, reason: mintResult.reason };
    }

    log.info(`[NFT] ✓ Certificate minted! TX: ${mintResult.txHash}, TokenID: ${mintResult.tokenId}`);
    return {
      minted: true,
      certificateId: mintResult.certificateId,
      transactionHash: mintResult.txHash,
      tokenId: mintResult.tokenId,
      metadataURI: mintResult.metadataURI,
      communityId: communityId.toString(),
      communityName: community.name,
      network: "Polygon Amoy Testnet",
    };
  } catch (err) {
    console.error(`[NFT] Minting failed:`, err.message);
    return { skipped: true, reason: `Minting error: ${err.message}` };
  }
}

// ─── GET /api/tasks/my ── Get tasks assigned to current user ───
const getMyTasks = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id?.toString();

    const tasks = await Task.find({ assignedTo: userId })
      .populate({ path: "community_id", select: "name" })
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    console.error("getMyTasks error:", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
};

// ─── POST /api/tasks/upload/:taskId ───
const uploadTaskFile = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ error: "Invalid taskId" });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (!(await canAccessTask(task, req.user))) {
      return res.status(403).json({ error: "You are not allowed to upload files for this task" });
    }

    // Check if task is completed and user is not elevated/community_manager
    if (task.completed_status && !["admin", "teacher", "community_manager"].includes(req.user.role)) {
      return res.status(403).json({ 
        error: "Task completed. File uploads are disabled for students." 
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.user.id || req.user._id?.toString();
    const normalizedPath = `/uploads/tasks/${req.file.filename}`;

    task.files.push({
      fileName: req.file.originalname,
      filePath: normalizedPath,
      uploadedBy: userId,
    });

    await task.save();
    await task.populate({ path: "files.uploadedBy", select: "name gmail avatar" });

    return res.status(201).json({
      message: "File uploaded successfully",
      file: task.files[task.files.length - 1],
    });
  } catch (err) {
    console.error("uploadTaskFile error:", err);
    return res.status(500).json({ error: "Failed to upload task file" });
  }
};

// ─── POST /api/tasks/chat/:taskId ───
const addTaskChatMessage = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { message } = req.body;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ error: "Invalid taskId" });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (!(await canAccessTask(task, req.user))) {
      return res.status(403).json({ error: "You are not allowed to chat on this task" });
    }

    // Check if task is completed and user is not elevated/community_manager
    if (task.completed_status && !["admin", "teacher", "community_manager"].includes(req.user.role)) {
      return res.status(403).json({ 
        error: "Task completed. Chat is disabled for students." 
      });
    }

    const userId = req.user.id || req.user._id?.toString();
    task.chatMessages.push({
      user: userId,
      message: String(message).trim(),
      createdAt: new Date(),
    });

    await task.save();

    await task.populate({ path: "chatMessages.user", select: "name gmail avatar" });

    const io = req.app.get("io");
    if (io) {
      io.to(`task:${taskId}`).emit("task_chat_message", {
        taskId,
        chatMessages: task.chatMessages,
      });
    }

    return res.status(201).json({
      message: "Message sent",
      chatMessages: task.chatMessages,
    });
  } catch (err) {
    console.error("addTaskChatMessage error:", err);
    return res.status(500).json({ error: "Failed to send chat message" });
  }
};

// ─── GET /api/tasks/chat/:taskId ───
const getTaskChatMessages = async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({ error: "Invalid taskId" });
    }

    const task = await Task.findById(taskId).populate({
      path: "chatMessages.user",
      select: "name gmail avatar",
    });

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (!(await canAccessTask(task, req.user))) {
      return res.status(403).json({ error: "You are not allowed to view chat for this task" });
    }

    return res.status(200).json({ chatMessages: task.chatMessages || [] });
  } catch (err) {
    console.error("getTaskChatMessages error:", err);
    return res.status(500).json({ error: "Failed to fetch chat messages" });
  }
};

module.exports = {
  createTask,
  getTasksByCommunity,
  completeTask,
  markTaskCompletedByStudent,
  completeTaskAndIssueCertificates,
  getMyTasks,
  uploadTaskFile,
  addTaskChatMessage,
  getTaskChatMessages,
};
