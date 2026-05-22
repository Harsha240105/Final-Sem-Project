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

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, trim: true, maxlength: 2000 },
  messageType: { type: String, enum: ["text", "image", "voice", "file", "gif"], default: "text" },
  attachments: [attachmentSchema],
  image: { type: String, default: null },
  gif: { type: String, default: null },
  audioUrl: { type: String, default: null },
  audioDuration: { type: Number, default: null },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
  reactions: [reactionSchema],
  edited: { type: Boolean, default: false },
  editHistory: [{ text: String, editedAt: { type: Date, default: Date.now } }],
  pinned: { type: Boolean, default: false },
  pinnedAt: { type: Date, default: null },
  pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  read: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  deleted: { type: Boolean, default: false },
}, { timestamps: true });

MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
MessageSchema.index({ receiver: 1, read: 1 });
MessageSchema.index({ pinned: 1, receiver: 1 });
MessageSchema.index({ text: "text" });

module.exports = mongoose.model("Message", MessageSchema);
