const mongoose = require("mongoose");
const { nanoid } = require("nanoid");

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now },
});

const contributionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: "" },
  completedProjects: { type: Number, default: 0 },
  achievements: { type: Number, default: 0 },
});

const collabMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  fileUrl: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

const communityMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now },
});

const collaborationSchema = new mongoose.Schema({
  publicId: { type: String },
  projectTitle: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, default: "", maxlength: 1000 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  messages: [collabMessageSchema],
  files: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

const communitySchema = new mongoose.Schema(
  {
    publicId: { type: String, unique: true },
    name: {
      type: String,
      required: [true, "Community name is required"],
      trim: true,
      maxlength: 100,
    },
    college_name: {
      type: String,
      trim: true,
      default: "",
      maxlength: 200,
    },
    certificate_template_id: {
      type: String,
      default: null,
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: 2000,
    },
    image: { type: String, default: null },
    logo: { type: String, default: null },
    files: [{ type: String }],
    category: {
      type: String,
      default: "Other",
      enum: ["Academic", "Technology", "Arts", "Science", "Sports", "Cultural", "Social", "Career", "Other"],
    },
    tags: [{ type: String, trim: true }],
    type: {
      type: String,
      default: "public",
      enum: ["public", "private"],
    },
    privacy: {
      type: String,
      default: "open",
      enum: ["open", "approval", "invite"],
    },
    activityStatus: {
      type: String,
      default: "active",
      enum: ["active", "moderate", "quiet"],
    },
    activityScore: { type: Number, default: 0 },
    communityType: { type: String, default: "", trim: true },
    rules: { type: String, default: "", trim: true, maxlength: 3000 },
    colorAccent: { type: String, default: "", trim: true },
    linkedSubjects: [{ type: String, trim: true }],
    mapPosition: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
    invitedMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    ],
    comments: [commentSchema],
    contributions: [contributionSchema],
    collaborations: [collaborationSchema],
    communityMessages: [communityMessageSchema],
  },
  { timestamps: true }
);

communitySchema.index({ createdAt: -1 });
communitySchema.index({ members: 1 });
communitySchema.index({ createdBy: 1 });

communitySchema.pre("save", function (next) {
  if (!this.publicId) {
    const year = new Date().getFullYear();
    this.publicId = `COM-${year}-${nanoid(6).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model("Community", communitySchema);
