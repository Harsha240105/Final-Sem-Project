const crypto = require("crypto");
const mongoose = require("mongoose");
const Certificate = require("../database/models/Certificate");
const NFTJobQueue = require("../database/models/NFTJobQueue");

function createIssuanceKey(userId, communityId, taskId) {
  const raw = `${String(userId)}:${String(communityId)}:${String(taskId || "none")}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

async function acquireMintLock(issuanceKey, ttlMs = 120000) {
  const lockToken = crypto.randomUUID();
  const acquired = await NFTJobQueue.findOneAndUpdate(
    {
      issuanceId: issuanceKey,
      $or: [
        { locked: false },
        { lockedAt: { $lt: new Date(Date.now() - ttlMs) } },
      ],
    },
    {
      $set: {
        locked: true,
        lockedAt: new Date(),
        lockToken,
      },
    },
    { new: true }
  );
  return acquired ? lockToken : null;
}

async function releaseMintLock(issuanceKey, lockToken) {
  const result = await NFTJobQueue.findOneAndUpdate(
    { issuanceId: issuanceKey, lockToken },
    { $set: { locked: false, lockedAt: null, lockToken: null } },
    { new: true }
  );
  return !!result;
}

async function isMintDuplicate(userId, communityId, taskId) {
  const issuanceKey = createIssuanceKey(userId, communityId, taskId);

  const existingCert = await Certificate.findOne({
    userId,
    communityId,
    ...(taskId ? { taskId } : { taskId: null }),
    status: { $in: ["completed", "claimed"] },
  }).lean();

  if (existingCert) return { isDuplicate: true, source: "certificate", certificateId: existingCert.certificateId };

  const existingJob = await NFTJobQueue.findOne({
    issuanceId: issuanceKey,
    status: { $nin: ["failed"] },
  }).lean();

  if (existingJob) return { isDuplicate: true, source: "queue", jobId: existingJob._id };

  return { isDuplicate: false };
}

async function ensureQueueEntry(issuanceKey, jobData) {
  const existing = await NFTJobQueue.findOne({ issuanceId: issuanceKey }).lean();
  if (existing) return { created: false, job: existing };

  const job = await NFTJobQueue.create({
    issuanceId: issuanceKey,
    ...jobData,
    queuedAt: new Date(),
  });
  return { created: true, job };
}

module.exports = {
  createIssuanceKey,
  acquireMintLock,
  releaseMintLock,
  isMintDuplicate,
  ensureQueueEntry,
};
