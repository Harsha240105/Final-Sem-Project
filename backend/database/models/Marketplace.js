const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

const CommentSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

const MarketplaceSchema = new mongoose.Schema({
  publicId: { type: String, unique: true },
  title: {
    type: String,
    required: [true, "Title is required"],
    trim: true,
  },
  description: {
    type: String,
    required: [true, "Description is required"],
    trim: true,
  },
  type: {
    type: String,
    enum: ["Job", "Event", "Project"],
    default: "Job",
  },
  community: {
    type: String,
    trim: true,
    default: "",
  },
  tags: [{ type: String, trim: true }],
  status: {
    type: String,
    enum: ["open", "active", "closed"],
    default: "open",
  },
  participants: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  ],
  nftIssued: { type: Boolean, default: false },
  collaborators: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
      requestedAt: { type: Date, default: Date.now },
    },
  ],
  comments: [CommentSchema],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

MarketplaceSchema.index({ createdAt: -1 });
MarketplaceSchema.index({ createdBy: 1, createdAt: -1 });
MarketplaceSchema.index({ type: 1, status: 1 });
MarketplaceSchema.index({ "collaborators.user": 1 });

MarketplaceSchema.pre("save", function (next) {
  if (!this.publicId) {
    this.publicId = `MKT-${nanoid(8).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model("Marketplace", MarketplaceSchema);
