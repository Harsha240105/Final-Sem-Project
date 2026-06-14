const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

const AdminUserSchema = new mongoose.Schema(
  {
    publicId: { type: String, unique: true },
    name: { type: String, required: true, trim: true },
    displayName: { type: String, trim: true, default: "" },
    gmail: { type: String, trim: true, lowercase: true, default: "" },
    password: { type: String, default: "" },
    role: {
      type: String,
      enum: ["admin"],
      default: "admin",
    },
    did: { type: String, default: null, trim: true },
    collegeName: { type: String, trim: true, default: "" },
    organisationName: { type: String, trim: true, default: "" },
    organisationType: { type: String, trim: true, default: "" },
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
  },
  { timestamps: true, collection: "admin_users" }
);

AdminUserSchema.index({ walletAddress: 1 }, { sparse: true });
AdminUserSchema.index({ did: 1 }, { sparse: true });
AdminUserSchema.index({ communities: 1 });
AdminUserSchema.index({ "nftCertificates.certificateId": 1 });
AdminUserSchema.index({ createdAt: -1 });

AdminUserSchema.pre("save", async function () {
  if (!this.publicId) {
    const year = new Date().getFullYear();
    this.publicId = `ADMIN-${year}-${nanoid(6).toUpperCase()}`;
  }
});

module.exports = mongoose.model("AdminUser", AdminUserSchema);
