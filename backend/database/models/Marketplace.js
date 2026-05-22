const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

const COLLAB_POST_TYPES = [
  "looking_for_dev",
  "looking_for_designer",
  "open_collaboration",
  "research_project",
  "community_recruitment",
];

const PROJECT_STATUSES = ["recruiting", "active", "reviewing", "completed", "archived"];

const CommentSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

const RoleRequirementSchema = new mongoose.Schema({
  role: { type: String, required: true, trim: true },
  count: { type: Number, default: 1, min: 1 },
  skills: [{ type: String, trim: true }],
  filled: { type: Boolean, default: false },
}, { _id: true });

const ShowcaseMediaSchema = new mongoose.Schema({
  type: { type: String, enum: ["image", "video", "link", "document"], required: true },
  url: { type: String, required: true },
  caption: { type: String, default: "" },
}, { _id: false });

const MarketplaceSchema = new mongoose.Schema({
  publicId: { type: String, unique: true },
  title: {
    type: String,
    required: [true, "Title is required"],
    trim: true,
    maxlength: 200,
  },
  description: {
    type: String,
    required: [true, "Description is required"],
    trim: true,
  },
  goals: { type: String, trim: true, default: "" },
  postType: {
    type: String,
    enum: COLLAB_POST_TYPES,
    default: "open_collaboration",
  },
  requiredRoles: [RoleRequirementSchema],
  skills: [{ type: String, trim: true }],
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Community",
    default: null,
  },
  tags: [{ type: String, trim: true }],
  status: {
    type: String,
    enum: PROJECT_STATUSES,
    default: "recruiting",
    index: true,
  },
  participants: [
    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  ],
  collaborators: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      role: { type: String, default: "", trim: true },
      status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
      requestedAt: { type: Date, default: Date.now },
    },
  ],
  comments: [CommentSchema],
  showcase: {
    summary: { type: String, default: "" },
    media: [ShowcaseMediaSchema],
    certificateIds: [{ type: String }],
    contributorList: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    publishedAt: { type: Date, default: null },
  },
  linkedTasks: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Task" },
  ],
  nftIssued: { type: Boolean, default: false },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

MarketplaceSchema.index({ createdAt: -1 });
MarketplaceSchema.index({ createdBy: 1, createdAt: -1 });
MarketplaceSchema.index({ postType: 1, status: 1 });
MarketplaceSchema.index({ "collaborators.user": 1 });
MarketplaceSchema.index({ status: 1, createdAt: -1 });
MarketplaceSchema.index({ skills: 1 });
MarketplaceSchema.index({ community: 1 });

MarketplaceSchema.pre("save", function (next) {
  if (!this.publicId) {
    this.publicId = `COLLAB-${nanoid(8).toUpperCase()}`;
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Marketplace", MarketplaceSchema);
module.exports.COLLAB_POST_TYPES = COLLAB_POST_TYPES;
module.exports.PROJECT_STATUSES = PROJECT_STATUSES;
