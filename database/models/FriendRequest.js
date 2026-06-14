const mongoose = require("mongoose");

const FriendRequestSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "accepted", "rejected", "blocked"], default: "pending" },
}, { timestamps: true });

FriendRequestSchema.index({ requester: 1, recipient: 1 }, { unique: true });
FriendRequestSchema.index({ recipient: 1, status: 1 });

module.exports = mongoose.model("FriendRequest", FriendRequestSchema);
