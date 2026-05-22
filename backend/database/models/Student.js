const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

const StudentSchema = new mongoose.Schema(
  {
    publicId: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    displayName: { type: String, trim: true, default: "" },
    gmail: { type: String, trim: true, lowercase: true, default: "" },
    password: { type: String, default: "" },
    role: {
      type: String,
      enum: ["student"],
      default: "student",
    },
    did: { type: String, default: null, trim: true },
    collegeName: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    countryCode: { type: String, trim: true, default: "" },
    walletAddress: { type: String, default: null, trim: true, lowercase: true },
    avatar: { type: String, default: null },
    communities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Community",
      },
    ],
    completedTasks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
    nftCertificates: [
      {
        certificateId: { type: String, required: true },
        communityId: { type: mongoose.Schema.Types.ObjectId, ref: "Community" },
        taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
        communityName: { type: String },
        txHash: { type: String },
        transactionHash: { type: String },
        tokenId: { type: String },
        metadataURI: { type: String },
        imageURI: { type: String },
        // Certificate lifecycle status: pending -> minting -> confirmed or failed
        status: {
          type: String,
          enum: ["pending", "metadata_uploaded", "tx_submitted", "confirmed", "failed"],
          default: "pending",
        },
        // Last error message if status is 'failed'
        failureReason: { type: String },
        // Retries: tracks number of minting attempts
        retryCount: { type: Number, default: 0 },
        // When the certificate was first issued
        issuedAt: { type: Date, default: Date.now },
        // When the NFT was confirmed on-chain
        mintedAt: { type: Date },
        // Last attempt timestamp for retry logic
        lastAttemptedAt: { type: Date },
        // Block number where TX was confirmed
        blockNumber: { type: Number },
        // Gas used in transaction
        gasUsed: { type: String },
      },
    ],
  },
  { timestamps: true, collection: "students" }
);

StudentSchema.index({ walletAddress: 1 }, { sparse: true });
StudentSchema.index({ did: 1 }, { sparse: true });
StudentSchema.index({ communities: 1 });
StudentSchema.index({ "nftCertificates.certificateId": 1 });
StudentSchema.index({ createdAt: -1 });

StudentSchema.pre("save", function (next) {
  if (!this.publicId) {
    const year = new Date().getFullYear();
    this.publicId = `STU-${year}-${nanoid(6).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model("Student", StudentSchema);
