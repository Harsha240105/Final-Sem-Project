const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

const UserSchema = new mongoose.Schema(
  {
    publicId: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    username: { type: String, unique: true, sparse: true, trim: true, lowercase: true },
    displayName: { type: String, trim: true, default: "" },
    bio: { type: String, trim: true, default: "", maxlength: 500 },
    banner: { type: String, default: null },
    backgroundVideo: { type: String, default: null },
    did: { type: String, default: null, trim: true },
    authMethod: {
      type: String,
      enum: ["wallet"],
      default: "wallet",
    },
    role: {
      type: String,
      enum: ["student", "teacher", "admin", "community_manager"],
      default: "student",
    },
    collegeName: { type: String, trim: true, default: "" },
    institutionType: { type: String, enum: ["school", "college", "university", "other", ""], default: "" },
    institutionName: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    countryCode: { type: String, trim: true, default: "" },
    // ── Verification & Onboarding Fields ──
    fullName: { type: String, trim: true, default: "" },
    registrationNumber: { type: String, trim: true, default: "" },
    employeeId: { type: String, trim: true, default: "" },
    gmail: { type: String, trim: true, lowercase: true, default: "" },
    collegeEmail: { type: String, trim: true, lowercase: true, default: "" },
    collegeIdImage: { type: String, default: null },
    signatureImage: { type: String, default: null },
    verificationStatus: {
      type: String,
      enum: ["pending", "pending_approval", "approved", "verified", "rejected", "error"],
      default: "pending",
    },
    onboardingCompleted: { type: Boolean, default: false },
    verificationSubmitted: { type: Boolean, default: false },
    teacherProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", default: null },
    verificationError: { type: String, default: null },
    approved: {
      type: Boolean,
      default: function approvedByRole() {
        return this.role !== "teacher";
      },
    },
    managedCommunity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      default: null,
    },
    walletAddress: { type: String, required: true, unique: true, trim: true, lowercase: true },
    avatar: { type: String, default: null },
    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
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
    // ── NFT Certificates earned by completing all community tasks ──
    // Each entry records the on-chain NFT certificate details
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
  { timestamps: true }
);

UserSchema.index({ did: 1 }, { sparse: true });
UserSchema.index({ role: 1, verificationStatus: 1 });
UserSchema.index({ role: 1, approved: 1 });
UserSchema.index({ verificationStatus: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ communities: 1 });
UserSchema.index({ "nftCertificates.certificateId": 1 });
UserSchema.index({ "nftCertificates.communityId": 1 });
UserSchema.index({ teacherProfileId: 1 }, { sparse: true });

UserSchema.pre("save", function (next) {
  if (!this.publicId) {
    const year = new Date().getFullYear();
    this.publicId = `USR-${year}-${nanoid(6).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model("User", UserSchema);
