const mongoose = require("mongoose");

const reactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { _id: false });

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  type: { type: String, enum: ["image", "video", "audio", "file"], required: true },
  name: { type: String, default: "" },
  size: { type: Number, default: 0 },
  mime: { type: String, default: "" },
}, { _id: false });

const ServerMessageSchema = new mongoose.Schema({
  server: { type: mongoose.Schema.Types.ObjectId, ref: "Server", required: true },
  channel: { type: String, required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, trim: true, maxlength: 2000 },
  messageType: { type: String, enum: ["text", "image", "voice", "file", "gif"], default: "text" },
  attachments: [attachmentSchema],
  image: { type: String, default: null },
  audioUrl: { type: String, default: null },
  audioDuration: { type: Number, default: null },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "ServerMessage", default: null },
  reactions: [reactionSchema],
  edited: { type: Boolean, default: false },
  editHistory: [{ text: String, editedAt: { type: Date, default: Date.now } }],
  pinned: { type: Boolean, default: false },
  pinnedAt: { type: Date, default: null },
  pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  deleted: { type: Boolean, default: false },
}, { timestamps: true });

ServerMessageSchema.index({ server: 1, channel: 1, createdAt: -1 });
ServerMessageSchema.index({ pinned: 1, server: 1, channel: 1 });
ServerMessageSchema.index({ text: "text" });

module.exports = mongoose.model("ServerMessage", ServerMessageSchema);
