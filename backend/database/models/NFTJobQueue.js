const mongoose = require("mongoose");

const NFTPipelineStepSchema = new mongoose.Schema({
  stage: {
    type: String,
    enum: ["generating_metadata", "uploading_ipfs", "minting", "confirming", "completed", "failed"],
  },
  startedAt: Date,
  completedAt: Date,
  duration: Number,
  error: String,
}, { _id: false });

const NFTJobQueueSchema = new mongoose.Schema({
  issuanceId: {
    type: String,
    required: true,
    unique: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  communityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Community",
    required: true,
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Task",
    default: null,
  },
  certificateId: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: [
      "pending",
      "generating_metadata",
      "uploading_ipfs",
      "minting",
      "confirming",
      "completed",
      "failed",
      "retrying",
    ],
    default: "pending",
    index: true,
  },
  priority: {
    type: Number,
    default: 0,
    min: -10,
    max: 10,
  },
  pipelineSteps: [NFTPipelineStepSchema],
  metadata: {
    studentName: String,
    communityName: String,
    collegeName: String,
    certificatePath: String,
    imageURI: String,
    imageHTTPS: String,
    metadataURI: String,
    metadataHTTPS: String,
  },
  blockchainTx: {
    txHash: String,
    tokenId: String,
    blockNumber: Number,
    gasUsed: Number,
    contractAddress: String,
    chainId: Number,
    confirmationBlocks: { type: Number, default: 0 },
    requiredConfirmations: { type: Number, default: 1 },
  },
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  errorLog: [{
    message: String,
    stack: String,
    stage: String,
    timestamp: { type: Date, default: Date.now },
  }],
  locked: { type: Boolean, default: false },
  lockedAt: Date,
  lockToken: String,
  queuedAt: { type: Date, default: Date.now },
  startedAt: Date,
  completedAt: Date,
}, { timestamps: true });

NFTJobQueueSchema.index({ status: 1, priority: -1, queuedAt: 1 });
NFTJobQueueSchema.index({ locked: 1, status: 1 });
NFTJobQueueSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("NFTJobQueue", NFTJobQueueSchema);
