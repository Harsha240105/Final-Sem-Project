const NFTJobQueue = require("../../../database/models/NFTJobQueue");
const Certificate = require("../../../database/models/Certificate");
const Community = require("../../../database/models/Community");
const { findUserByAnyId, syncLegacyUserRecord } = require("../../server/utils/userSync");
const { generateCertificate } = require("../../server/utils/certificateGenerator");
const { uploadCertificateToIPFS } = require("./ipfsService");
const { mintCertificate, verifyCertificateOnChain } = require("./nftService");
const { createIssuanceKey, acquireMintLock, releaseMintLock } = require("./duplicateGuard");
const { CONTRACT_ADDRESS } = require("./contractAddress");
const { createNotification } = require("../../server/controllers/notificationController");
const { nanoid } = require("nanoid");
const crypto = require("crypto");

let io = null;
let processingInterval = null;
const PROCESSING_INTERVAL_MS = 5000;
const MAX_CONCURRENT = 3;
const activeJobs = new Set();

function setSocketIO(socketIO) {
  io = socketIO;
}

function emitProgress(jobId, userId, status, data = {}) {
  if (!io) return;
  io.to(String(userId)).emit("nft:mint-progress", { jobId, status, ...data });
}

function emitComplete(userId, certificate) {
  if (!io) return;
  io.to(String(userId)).emit("nft:mint-complete", { certificate });
}

function emitFailed(userId, jobId, error) {
  if (!io) return;
  io.to(String(userId)).emit("nft:mint-failed", { jobId, error });
}

async function processQueue() {
  if (!io) return;

  const available = MAX_CONCURRENT - activeJobs.size;
  if (available <= 0) return;

  try {
    const jobs = await NFTJobQueue.find({
      status: "pending",
      locked: false,
    })
      .sort({ priority: -1, queuedAt: 1 })
      .limit(available)
      .lean();

    for (const job of jobs) {
      const lockToken = await acquireMintLock(job.issuanceId);
      if (!lockToken) continue;
      activeJobs.add(job._id.toString());
      processJob(job, lockToken).finally(() => {
        activeJobs.delete(job._id.toString());
        releaseMintLock(job.issuanceId, lockToken).catch(() => {});
      });
    }
  } catch (err) {
    console.error("[NFT Queue] Process error:", err.message);
  }
}

async function processJob(job, lockToken) {
  const { userId, communityId, taskId, issuanceId } = job;
  const jobId = job._id.toString();

  try {
    const recipient = await findUserByAnyId(userId);
    if (!recipient) throw new Error("Recipient user not found");
    if (!recipient.walletAddress) throw new Error("User has no wallet address");

    const community = await Community.findById(communityId).lean();
    if (!community) throw new Error("Community not found");

    // ─── STAGE 1: Generate certificate image ───
    await updateJobStatus(jobId, "generating_metadata", "Generating certificate image...");
    emitProgress(jobId, userId, "generating_metadata", { message: "Generating certificate image..." });

    const certificateId = `CERT-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
    const certificatePath = await generateCertificate({
      studentName: recipient.name,
      communityName: community.name,
      collegeName: community.college_name || "Virtual Campus",
      certificateId,
    });

    await recordPipelineStep(jobId, "generating_metadata");

    // ─── STAGE 2: Upload to IPFS ───
    await updateJobStatus(jobId, "uploading_ipfs", "Uploading to IPFS...");
    emitProgress(jobId, userId, "uploading_ipfs", { message: "Uploading certificate to IPFS..." });

    const ipfsResult = await uploadCertificateToIPFS({
      certificatePath,
      studentName: recipient.name,
      communityName: community.name,
      collegeName: community.college_name || "Virtual Campus",
      certificateId,
    });

    await recordPipelineStep(jobId, "uploading_ipfs");

    await NFTJobQueue.findByIdAndUpdate(jobId, {
      $set: {
        certificateId,
        "metadata.certificatePath": certificatePath,
        "metadata.imageURI": ipfsResult.imageURI,
        "metadata.imageHTTPS": ipfsResult.imageHTTPS,
        "metadata.metadataURI": ipfsResult.metadataURI,
        "metadata.metadataHTTPS": ipfsResult.metadataHTTPS,
        "metadata.studentName": recipient.name,
        "metadata.communityName": community.name,
        "metadata.collegeName": community.college_name || "Virtual Campus",
      },
    });

    // ─── STAGE 3: Mint NFT on blockchain ───
    await updateJobStatus(jobId, "minting", "Minting NFT on Polygon Amoy...");
    emitProgress(jobId, userId, "minting", { message: "Minting NFT on blockchain..." });

    const mintResult = await mintCertificate(recipient.walletAddress, ipfsResult.metadataURI);

    await recordPipelineStep(jobId, "minting");

    // ─── STAGE 4: Confirm transaction ───
    await updateJobStatus(jobId, "confirming", "Confirming blockchain transaction...");
    emitProgress(jobId, userId, "confirming", { message: "Confirming transaction..." });

    await NFTJobQueue.findByIdAndUpdate(jobId, {
      $set: {
        "blockchainTx.txHash": mintResult.transactionHash,
        "blockchainTx.tokenId": mintResult.tokenId,
        "blockchainTx.blockNumber": mintResult.blockNumber,
        "blockchainTx.gasUsed": mintResult.gasUsed,
        "blockchainTx.contractAddress": mintResult.contractAddress,
        "blockchainTx.chainId": mintResult.chainId || 80002,
      },
    });

    await recordPipelineStep(jobId, "confirming");

    // ─── STAGE 5: Persist certificate ───
    const certDoc = {
      certificateId,
      userId: recipient._id,
      communityId,
      taskId: taskId || undefined,
      communityName: community.name,
      collegeName: community.college_name || "Virtual Campus",
      walletAddress: recipient.walletAddress,
      tokenId: mintResult.tokenId,
      transactionHash: mintResult.transactionHash,
      txHash: mintResult.transactionHash,
      contractAddress: mintResult.contractAddress || CONTRACT_ADDRESS,
      tokenURI: ipfsResult.metadataURI,
      metadataURI: ipfsResult.metadataURI,
      imageURI: ipfsResult.imageURI,
      imageHTTPS: ipfsResult.imageHTTPS || "",
      metadataHTTPS: ipfsResult.metadataHTTPS || "",
      issuedAt: new Date(),
      mintedAt: new Date(),
      status: "completed",
      claimed: true,
      walletClaimed: true,
      claimedAt: new Date(),
      blockNumber: mintResult.blockNumber || null,
      gasUsed: mintResult.gasUsed || null,
      issuanceId,
    };

    await Certificate.create(certDoc);

    await updateJobStatus(jobId, "completed", "Certificate minted successfully");
    await recordPipelineStep(jobId, "completed");

    // Notification
    try {
      await createNotification({
        userId,
        message: `NFT certificate issued for ${community.name}`,
        type: "certificate_issued",
        relatedId: community._id,
        relatedType: "certificate",
        redirectUrl: "/my-certificates",
      });
    } catch { /* non-blocking */ }

    const certificateResponse = {
      certificateId,
      transactionHash: mintResult.transactionHash,
      tokenId: mintResult.tokenId,
      metadataURI: ipfsResult.metadataURI,
      imageURI: ipfsResult.imageURI,
      imageHTTPS: ipfsResult.imageHTTPS,
      contractAddress: mintResult.contractAddress,
      network: "Polygon Amoy Testnet",
      studentName: recipient.name,
      communityName: community.name,
    };

    emitComplete(userId, certificateResponse);

    return certificateResponse;
  } catch (err) {
    console.error(`[NFT Queue] Job ${jobId} failed:`, err.message);

    const retryCount = (job.retryCount || 0) + 1;
    const nextStatus = retryCount >= (job.maxRetries || 3) ? "failed" : "retrying";

    await NFTJobQueue.findByIdAndUpdate(jobId, {
      $set: {
        status: nextStatus,
        retryCount,
        completedAt: nextStatus === "failed" ? new Date() : undefined,
        locked: false,
        lockedAt: null,
        lockToken: null,
      },
      $push: {
        errorLog: {
          message: err.message,
          stack: err.stack,
          stage: job.status,
          timestamp: new Date(),
        },
      },
    });

    if (nextStatus === "failed") {
      await Certificate.create({
        userId,
        communityId,
        taskId: taskId || undefined,
        communityName: job.metadata?.communityName || "",
        collegeName: job.metadata?.collegeName || "",
        status: "failed",
        failureReason: err.message,
        retryCount,
        issuanceId,
        certificateId: `CERT-FAILED-${Date.now()}`,
      }).catch(() => {});

      emitFailed(userId, jobId, err.message);
    }

    throw err;
  }
}

async function updateJobStatus(jobId, status, message) {
  await NFTJobQueue.findByIdAndUpdate(jobId, {
    $set: {
      status,
      ...(status === "generating_metadata" || status === "uploading_ipfs" ||
         status === "minting" || status === "confirming"
         ? { startedAt: new Date() } : {}),
      ...(status === "completed" || status === "failed" ? { completedAt: new Date() } : {}),
      locked: status === "completed" || status === "failed" ? false : undefined,
      lockedAt: status === "completed" || status === "failed" ? null : undefined,
      lockToken: status === "completed" || status === "failed" ? null : undefined,
    },
  });
}

async function recordPipelineStep(jobId, stage) {
  await NFTJobQueue.findByIdAndUpdate(jobId, {
    $push: {
      pipelineSteps: {
        stage,
        startedAt: new Date(),
        completedAt: new Date(),
        duration: 0,
      },
    },
  });
}

async function enqueueMintJob({ userId, communityId, taskId, priority = 0 }) {
  const issuanceKey = createIssuanceKey(userId, communityId, taskId);

  const existing = await NFTJobQueue.findOne({ issuanceId: issuanceKey }).lean();
  if (existing) {
    if (["pending", "retrying"].includes(existing.status)) {
      return { queued: false, reason: "already_queued", job: existing };
    }
    if (["generating_metadata", "uploading_ipfs", "minting", "confirming"].includes(existing.status)) {
      return { queued: false, reason: "in_progress", job: existing };
    }
    if (existing.status === "completed") {
      return { queued: false, reason: "already_minted", job: existing };
    }
  }

  const job = await NFTJobQueue.create({
    issuanceId: issuanceKey,
    userId,
    communityId,
    taskId: taskId || undefined,
    priority,
    status: "pending",
    queuedAt: new Date(),
  });

  return { queued: true, job };
}

async function getJobStatus(jobId) {
  return NFTJobQueue.findById(jobId).lean();
}

async function getUserQueueStatus(userId) {
  return NFTJobQueue.find({ userId })
    .sort({ queuedAt: -1 })
    .limit(20)
    .lean();
}

async function retryFailedJob(jobId) {
  const job = await NFTJobQueue.findById(jobId);
  if (!job) throw new Error("Job not found");
  if (job.status !== "failed") throw new Error(`Job is not in failed state (current: ${job.status})`);
  if (job.retryCount >= job.maxRetries) throw new Error("Max retries exceeded");

  job.status = "retrying";
  job.locked = false;
  job.lockedAt = null;
  job.lockToken = null;
  await job.save();

  return job;
}

function startQueueProcessor() {
  if (processingInterval) return;
  console.log("[NFT Queue] Starting queue processor...");
  processingInterval = setInterval(processQueue, PROCESSING_INTERVAL_MS);
}

function stopQueueProcessor() {
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
    console.log("[NFT Queue] Queue processor stopped");
  }
}

module.exports = {
  setSocketIO,
  enqueueMintJob,
  processQueue,
  processJob,
  getJobStatus,
  getUserQueueStatus,
  retryFailedJob,
  startQueueProcessor,
  stopQueueProcessor,
};
