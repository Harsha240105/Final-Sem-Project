const mongoose = require("mongoose");

const ServerMessageSchema = new mongoose.Schema({
  server: { type: mongoose.Schema.Types.ObjectId, ref: "Server", required: true },
  channel: { type: String, required: true }, // channel name
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, trim: true, maxlength: 2000 },
  image: { type: String, default: null },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "ServerMessage", default: null },
  edited: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
}, { timestamps: true });

ServerMessageSchema.index({ server: 1, channel: 1, createdAt: -1 });

module.exports = mongoose.model("ServerMessage", ServerMessageSchema);
