const mongoose = require("mongoose");

const RoomMessageSchema = new mongoose.Schema({
  text: { type: String, trim: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  attachments: [{ url: String, name: String, size: Number, mime: String }],
  createdAt: { type: Date, default: Date.now },
});

const RoomChannelSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ["text", "voice", "files"], default: "text" },
  messages: [RoomMessageSchema],
  createdAt: { type: Date, default: Date.now },
});

const RoomFileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  mime: { type: String, default: "" },
  size: { type: Number, default: 0 },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

const RoomTaskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  status: { type: String, enum: ["todo", "in_progress", "done"], default: "todo" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

const CollaborationRoomSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Marketplace", required: true },
  name: { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  channels: [RoomChannelSchema],
  files: [RoomFileSchema],
  tasks: [RoomTaskSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

CollaborationRoomSchema.index({ postId: 1 });
CollaborationRoomSchema.index({ members: 1 });

module.exports = mongoose.model("CollaborationRoom", CollaborationRoomSchema);
