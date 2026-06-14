const mongoose = require("mongoose");

const DeletedUserSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  walletAddress: { type: String, lowercase: true, trim: true },
  role: { type: String, enum: ["student", "teacher", "admin", ""], default: "" },
  collegeName: { type: String, default: "" },
  totalCertificates: { type: Number, default: 0 },
  totalTasks: { type: Number, default: 0 },
  reason: { type: String, default: "" },
  deletedAt: { type: Date, default: Date.now },
}, { timestamps: false });

DeletedUserSchema.index({ walletAddress: 1 });
DeletedUserSchema.index({ deletedAt: -1 });

module.exports = mongoose.model("DeletedUser", DeletedUserSchema);
