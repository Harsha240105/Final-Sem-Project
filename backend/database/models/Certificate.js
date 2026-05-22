const mongoose = require("mongoose");

const CertificateSchema = new mongoose.Schema(
  {
    certificateId: { type: String, required: true, index: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: false,
    },
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      required: false,
    },
    communityName: { type: String, trim: true, default: "" },
    collegeName: { type: String, trim: true, default: "" },
    walletAddress: { type: String, trim: true, default: "" },
    tokenId: { type: String, trim: true, default: "" },
    transactionHash: { type: String, trim: true, default: "" },
    txHash: { type: String, trim: true, default: "" },
    contractAddress: { type: String, trim: true, default: "" },
    tokenURI: { type: String, trim: true, default: "" },
    metadataURI: { type: String, trim: true, default: "" },
    imageURI: { type: String, trim: true, default: "" },
    imageHTTPS: { type: String, trim: true, default: "" },
    metadataHTTPS: { type: String, trim: true, default: "" },
    issuedAt: { type: Date, default: Date.now },
    mintedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["issued", "claimed", "completed", "failed", "tx_submitted"],
      default: "issued",
      trim: true,
    },
    claimed: { type: Boolean, default: false },
    walletClaimed: { type: Boolean, default: false },
    claimedAt: { type: Date, default: null },
    blockNumber: { type: Number, default: null },
    gasUsed: { type: Number, default: null },
    failureReason: { type: String, trim: true, default: "" },
    retryCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

CertificateSchema.index({ userId: 1, createdAt: -1 });
CertificateSchema.index({ status: 1, claimed: 1 });
CertificateSchema.index({ userId: 1, communityId: 1, taskId: 1 }, { unique: true, partialFilterExpression: { taskId: { $type: "objectId" } } });
CertificateSchema.index({ userId: 1, communityId: 1 }, { unique: true, partialFilterExpression: { taskId: { $eq: null } } });

module.exports = mongoose.model("Certificate", CertificateSchema);
