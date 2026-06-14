const mongoose = require("mongoose");

const ConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
  pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],
  lastMessage: {
    text: { type: String, default: "" },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date },
    messageType: { type: String, default: "text" },
    hasAttachments: { type: Boolean, default: false },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ updatedAt: -1 });

module.exports = mongoose.model("Conversation", ConversationSchema);
