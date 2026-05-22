const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, trim: true, maxlength: 2000 },
  image: { type: String, default: null },
  gif: { type: String, default: null },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
  read: { type: Boolean, default: false },
  readAt: { type: Date, default: null },
  deleted: { type: Boolean, default: false },
}, { timestamps: true });

MessageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
MessageSchema.index({ receiver: 1, read: 1 });

module.exports = mongoose.model("Message", MessageSchema);
