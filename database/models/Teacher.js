const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

const TeacherSchema = new mongoose.Schema(
  {
    publicId: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    displayName: { type: String, trim: true, default: "" },
    gmail: { type: String, trim: true, lowercase: true, default: "" },
    password: { type: String, default: "" },
    role: {
      type: String,
      enum: ["teacher"],
      default: "teacher",
    },
    did: { type: String, default: null, trim: true },
    collegeName: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    countryCode: { type: String, trim: true, default: "" },
    fullName: { type: String, trim: true, default: "" },
    employeeId: { type: String, trim: true, default: "" },
    collegeEmail: { type: String, trim: true, lowercase: true, default: "" },
    collegeIdImage: { type: String, default: null },
    signatureImage: { type: String, default: null },
    walletAddress: { type: String, default: null, trim: true, lowercase: true },
    avatar: { type: String, default: null },
    managedCommunity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      default: null,
    },
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
        status: {
          type: String,
          enum: ["pending", "metadata_uploaded", "tx_submitted", "confirmed", "failed"],
          default: "pending",
        },
        failureReason: { type: String },
        retryCount: { type: Number, default: 0 },
        issuedAt: { type: Date, default: Date.now },
        mintedAt: { type: Date },
        lastAttemptedAt: { type: Date },
        blockNumber: { type: Number },
        gasUsed: { type: String },
      },
    ],
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    verificationSubmitted: { type: Boolean, default: false },
    approved: { type: Boolean, default: false },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: "teachers" }
);

TeacherSchema.index({ walletAddress: 1 }, { sparse: true });
TeacherSchema.index({ did: 1 }, { sparse: true });
TeacherSchema.index({ approvalStatus: 1 });
TeacherSchema.index({ approved: 1, approvalStatus: 1 });
TeacherSchema.index({ approvedAt: 1 });
TeacherSchema.index({ communities: 1 });
TeacherSchema.index({ "nftCertificates.certificateId": 1 });
TeacherSchema.index({ createdAt: -1 });

TeacherSchema.pre("save", async function () {
  if (!this.publicId) {
    const year = new Date().getFullYear();
    this.publicId = `TEACH-${year}-${nanoid(6).toUpperCase()}`;
  }
});

module.exports = mongoose.model("Teacher", TeacherSchema);
