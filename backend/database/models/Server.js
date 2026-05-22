const mongoose = require("mongoose");

const ChannelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  type: { type: String, enum: ["text", "voice", "stage", "announcements"], default: "text" },
  createdAt: { type: Date, default: Date.now },
});

const MemberRoleSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["owner", "admin", "teacher", "moderator", "student", "guest"], default: "student" },
}, { _id: false });

const ServerSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 500, default: "" },
  icon: { type: String, default: null },
  banner: { type: String, default: null },
  preset: { type: String, default: null },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  memberRoles: [MemberRoleSchema],
  channels: [ChannelSchema],
  moderators: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  isPublic: { type: Boolean, default: true },
  inviteCode: { type: String, unique: true, sparse: true },
}, { timestamps: true });

ServerSchema.index({ members: 1 });
ServerSchema.index({ owner: 1 });

module.exports = mongoose.model("Server", ServerSchema);
