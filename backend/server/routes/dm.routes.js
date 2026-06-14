const express = require("express");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");
const Message = require("../../../database/models/Message");
const FriendRequest = require("../../../database/models/FriendRequest");
const Conversation = require("../../../database/models/Conversation");
const Follow = require("../../../database/models/Follow");
const User = require("../../../database/models/User");
const { authMiddleware } = require("../middleware/auth.middleware");
const { uploadChat, classifyMime } = require("../middleware/upload");

const router = express.Router();

function escapeRegex(rawValue = "") {
  return String(rawValue).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Search users for DM ──
router.get("/search", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const q = (req.query.q || "").trim().slice(0, 80);
    if (!q) return res.json({ users: [] });

    const searchRegex = new RegExp(escapeRegex(q), "i");
    const users = await User.find({
      _id: { $ne: userId },
      $or: [
        { name: searchRegex },
        { role: searchRegex },
        { collegeName: searchRegex },
        { institutionName: searchRegex },
      ],
    })
      .select("name avatar role collegeName institutionName")
      .limit(20)
      .lean();

    const results = users.map((u) => ({
      _id: u._id,
      id: u._id,
      name: u.name,
      avatar: u.avatar,
      role: u.role,
      collegeName: u.collegeName,
      institutionName: u.institutionName,
    }));

    res.json({ users: results });
  } catch (err) {
    console.error("searchUsers error:", err);
    res.status(500).json({ error: "Failed to search users" });
  }
});

router.get("/conversations", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const msgs = await Message.aggregate([
      { $match: { $or: [{ sender: userId }, { receiver: userId }], deleted: false } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: { $cond: [{ $eq: ["$sender", userId] }, "$receiver", "$sender"] }, lastMessage: { $first: "$$ROOT" }, unread: { $sum: { $cond: [{ $and: [{ $eq: ["$receiver", userId] }, { $eq: ["$read", false] }] }, 1, 0] } } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      { $project: { "user.password": 0, "user.nftCertificates": 0 } },
      { $sort: { "lastMessage.createdAt": -1 } },
    ]);

    const followedRecords = await Follow.find({ follower: userId })
      .populate("following", "name avatar role collegeName institutionName")
      .sort({ createdAt: -1 })
      .lean();

    const chatUserIds = new Set(msgs.map((m) => String(m._id)));
    const followedWithNoChat = followedRecords
      .map((f) => f.following)
      .filter(Boolean)
      .filter((u) => !chatUserIds.has(String(u._id)))
      .map((u) => ({
        _id: u._id,
        user: u,
        lastMessage: null,
        unread: 0,
      }));

    res.json({ conversations: [...msgs, ...followedWithNoChat] });
  } catch (err) {
    console.error("getConversations error:", err);
    res.status(500).json({ error: "Failed to load conversations" });
  }
});

router.get("/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const viewerId = req.user.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ error: "Invalid user id" });
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 30));
    const skip = (page - 1) * limit;
    const messages = await Message.find({
      $or: [
        { sender: viewerId, receiver: userId },
        { sender: userId, receiver: viewerId },
      ],
      deleted: false,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("sender", "name avatar role")
      .populate("receiver", "name avatar role")
      .populate("replyTo")
      .lean();
    await Message.updateMany(
      { sender: userId, receiver: viewerId, read: false },
      { $set: { read: true, readAt: new Date() } }
    );
    res.json({ messages: messages.reverse(), page, limit });
  } catch (err) {
    console.error("getMessages error:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

async function autoCreateConversation(userId, otherId) {
  try {
    const existing = await Conversation.findOne({ participants: { $all: [userId, otherId] } });
    if (!existing) {
      await Conversation.create({ participants: [userId, otherId] });
    }
    return true;
  } catch { return false; }
}

async function updateConversationLastMessage(userId, otherId, msg) {
  try {
    await Conversation.findOneAndUpdate(
      { participants: { $all: [userId, otherId] } },
      {
        $set: {
          lastMessage: {
            text: msg.text || (msg.attachments?.length ? `[${msg.messageType}]` : ""),
            sender: msg.sender,
            createdAt: msg.createdAt,
            messageType: msg.messageType || "text",
            hasAttachments: (msg.attachments?.length || 0) > 0,
          },
          updatedAt: new Date(),
        },
      }
    );
  } catch { /* silent */ }
}

function emitToBoth(io, userId, otherId, event, data) {
  if (io) {
    io.to(otherId).emit(event, data);
    io.to(userId).emit(event, data);
  }
}

router.post(
  "/send",
  authMiddleware,
  [body("text").trim().notEmpty().isLength({ max: 2000 }).withMessage("Text is required (max 2000 chars)"),
   body("receiver").notEmpty().withMessage("Receiver id is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: "Validation failed", details: errors.array() });
      const { text, receiver, image, gif, replyTo, messageType, attachments } = req.body;
      if (!mongoose.Types.ObjectId.isValid(receiver)) return res.status(400).json({ error: "Invalid receiver id" });
      if (receiver === req.user.id) return res.status(400).json({ error: "Cannot message yourself" });
      await autoCreateConversation(req.user.id, receiver);
      const msgData = {
        sender: req.user.id,
        receiver,
        text,
        messageType: messageType || "text",
        image: image || null,
        gif: gif || null,
        replyTo: replyTo || null,
        attachments: attachments || [],
      };
      const msg = await Message.create(msgData);
      const populated = await Message.findById(msg._id)
        .populate("sender", "name avatar role")
        .populate("receiver", "name avatar role")
        .populate("replyTo")
        .lean();
      const io = req.app.get("io");
      emitToBoth(io, req.user.id, receiver, "new_message", populated);
      await updateConversationLastMessage(req.user.id, receiver, populated);
      res.status(201).json({ message: populated });
    } catch (err) {
      console.error("sendMessage error:", err);
      res.status(500).json({ error: "Failed to send message" });
    }
  }
);

// ── Upload file to chat ──
router.post(
  "/upload",
  authMiddleware,
  uploadChat.single("file"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });
      const { receiver, replyTo } = req.body;
      if (!receiver) return res.status(400).json({ error: "Receiver id is required" });
      if (!mongoose.Types.ObjectId.isValid(receiver)) return res.status(400).json({ error: "Invalid receiver id" });
      const url = `/uploads/chat/${req.file.filename}`;
      const mediaType = classifyMime(req.file.mimetype);
      const attachment = {
        url,
        type: mediaType,
        name: req.file.originalname,
        size: req.file.size,
        mime: req.file.mimetype,
      };
      await autoCreateConversation(req.user.id, receiver);
      const msgData = {
        sender: req.user.id,
        receiver,
        text: req.body.text || "",
        messageType: mediaType === "image" ? "image" : mediaType === "audio" ? "voice" : "file",
        attachments: [attachment],
        replyTo: replyTo || null,
      };
      if (mediaType === "image") msgData.image = url;
      if (mediaType === "audio") msgData.audioUrl = url;
      const msg = await Message.create(msgData);
      const populated = await Message.findById(msg._id)
        .populate("sender", "name avatar role")
        .populate("receiver", "name avatar role")
        .populate("replyTo")
        .lean();
      const io = req.app.get("io");
      emitToBoth(io, req.user.id, receiver, "new_message", populated);
      await updateConversationLastMessage(req.user.id, receiver, populated);
      res.status(201).json({ message: populated, file: { url, type: mediaType, name: req.file.originalname } });
    } catch (err) {
      console.error("uploadMessageFile error:", err);
      res.status(500).json({ error: "Failed to upload file" });
    }
  }
);

// ── Send voice note ──
router.post(
  "/send/voice",
  authMiddleware,
  uploadChat.single("audio"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No audio provided" });
      const { receiver, duration } = req.body;
      if (!receiver) return res.status(400).json({ error: "Receiver id is required" });
      if (!mongoose.Types.ObjectId.isValid(receiver)) return res.status(400).json({ error: "Invalid receiver id" });
      const url = `/uploads/chat/${req.file.filename}`;
      await autoCreateConversation(req.user.id, receiver);
      const msg = await Message.create({
        sender: req.user.id,
        receiver,
        text: "",
        messageType: "voice",
        audioUrl: url,
        audioDuration: parseInt(duration) || 0,
        attachments: [{ url, type: "audio", name: "Voice note", size: req.file.size, mime: req.file.mimetype }],
      });
      const populated = await Message.findById(msg._id)
        .populate("sender", "name avatar role")
        .populate("receiver", "name avatar role")
        .lean();
      const io = req.app.get("io");
      emitToBoth(io, req.user.id, receiver, "new_message", populated);
      await updateConversationLastMessage(req.user.id, receiver, populated);
      res.status(201).json({ message: populated });
    } catch (err) {
      console.error("sendVoiceMessage error:", err);
      res.status(500).json({ error: "Failed to send voice message" });
    }
  }
);

// ── Edit message ──
router.put("/:messageId/edit", authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: "Text is required" });
    if (!mongoose.Types.ObjectId.isValid(messageId)) return res.status(400).json({ error: "Invalid message id" });
    const msg = await Message.findOne({ _id: messageId, sender: req.user.id, deleted: false });
    if (!msg) return res.status(404).json({ error: "Message not found or not yours" });
    msg.editHistory.push({ text: msg.text, editedAt: new Date() });
    msg.text = text.trim();
    msg.edited = true;
    await msg.save();
    const populated = await Message.findById(msg._id)
      .populate("sender", "name avatar role")
      .populate("receiver", "name avatar role")
      .lean();
    const io = req.app.get("io");
    emitToBoth(io, req.user.id, msg.receiver.toString(), "message_edited", populated);
    res.json({ message: populated });
  } catch (err) {
    console.error("editMessage error:", err);
    res.status(500).json({ error: "Failed to edit message" });
  }
});

// ── Toggle pin ──
router.put("/:messageId/pin", authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) return res.status(400).json({ error: "Invalid message id" });
    const msg = await Message.findOne({
      _id: messageId,
      $or: [{ sender: req.user.id }, { receiver: req.user.id }],
      deleted: false,
    });
    if (!msg) return res.status(404).json({ error: "Message not found" });
    msg.pinned = !msg.pinned;
    msg.pinnedAt = msg.pinned ? new Date() : null;
    msg.pinnedBy = msg.pinned ? req.user.id : null;
    await msg.save();
    // Also update conversation pinned list
    const otherId = msg.sender.toString() === req.user.id ? msg.receiver : msg.sender;
    if (msg.pinned) {
      await Conversation.findOneAndUpdate(
        { participants: { $all: [req.user.id, otherId] } },
        { $addToSet: { pinnedMessages: msg._id } }
      );
    } else {
      await Conversation.findOneAndUpdate(
        { participants: { $all: [req.user.id, otherId] } },
        { $pull: { pinnedMessages: msg._id } }
      );
    }
    const io = req.app.get("io");
    emitToBoth(io, req.user.id, otherId, "pin_toggled", {
      messageId: msg._id,
      pinned: msg.pinned,
      pinnedBy: req.user.id,
      message: msg,
    });
    res.json({ pinned: msg.pinned, messageId: msg._id });
  } catch (err) {
    console.error("pinMessage error:", err);
    res.status(500).json({ error: "Failed to toggle pin" });
  }
});

// ── Toggle reaction ──
router.post("/:messageId/react", authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: "Emoji is required" });
    if (!mongoose.Types.ObjectId.isValid(messageId)) return res.status(400).json({ error: "Invalid message id" });
    const msg = await Message.findOne({ _id: messageId, deleted: false });
    if (!msg) return res.status(404).json({ error: "Message not found" });
    const existingReaction = msg.reactions.find((r) => r.emoji === emoji);
    const userId = req.user.id;
    if (existingReaction) {
      const userIndex = existingReaction.users.indexOf(userId);
      if (userIndex > -1) {
        existingReaction.users.splice(userIndex, 1);
        if (existingReaction.users.length === 0) {
          msg.reactions.pull({ _id: existingReaction._id });
        }
      } else {
        existingReaction.users.push(userId);
      }
    } else {
      msg.reactions.push({ emoji, users: [userId] });
    }
    await msg.save();
    const otherId = msg.sender.toString() === userId ? msg.receiver : msg.sender;
    const io = req.app.get("io");
    emitToBoth(io, userId, otherId, "reaction_updated", {
      messageId: msg._id,
      reactions: msg.reactions,
    });
    res.json({ reactions: msg.reactions });
  } catch (err) {
    console.error("reactToMessage error:", err);
    res.status(500).json({ error: "Failed to react" });
  }
});

// ── Search messages ──
router.get("/search/messages", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const q = (req.query.q || "").trim();
    const withUserId = req.query.with;
    if (!q) return res.json({ messages: [] });
    const query = {
      $or: [
        { sender: userId, receiver: withUserId || { $exists: true } },
        { receiver: userId, sender: withUserId || { $exists: true } },
      ],
      deleted: false,
      text: { $regex: escapeRegex(q), $options: "i" },
    };
    if (withUserId && mongoose.Types.ObjectId.isValid(withUserId)) {
      query.$or = [
        { sender: userId, receiver: withUserId },
        { sender: withUserId, receiver: userId },
      ];
    }
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("sender", "name avatar role")
      .populate("receiver", "name avatar role")
      .lean();
    res.json({ messages: messages.reverse() });
  } catch (err) {
    console.error("searchMessages error:", err);
    res.status(500).json({ error: "Failed to search messages" });
  }
});

// ── Get pinned messages ──
router.get("/pinned/:userId", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const viewerId = req.user.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ error: "Invalid user id" });
    const messages = await Message.find({
      $or: [
        { sender: viewerId, receiver: userId },
        { sender: userId, receiver: viewerId },
      ],
      pinned: true,
      deleted: false,
    })
      .sort({ pinnedAt: -1 })
      .populate("sender", "name avatar role")
      .lean();
    res.json({ messages });
  } catch (err) {
    console.error("getPinnedMessages error:", err);
    res.status(500).json({ error: "Failed to load pinned messages" });
  }
});

// ── Delete message (with socket emit) ──
router.delete("/:messageId", authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(messageId)) return res.status(400).json({ error: "Invalid message id" });
    const msg = await Message.findOneAndUpdate(
      { _id: messageId, sender: req.user.id },
      { $set: { deleted: true } },
      { new: true }
    );
    if (!msg) return res.status(404).json({ error: "Message not found or not yours" });
    const otherId = msg.receiver.toString() === req.user.id ? msg.sender : msg.receiver;
    const io = req.app.get("io");
    emitToBoth(io, req.user.id, otherId, "message_deleted", {
      messageId: msg._id,
      deleted: true,
    });
    res.json({ message: "Message deleted" });
  } catch (err) {
    console.error("deleteMessage error:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

// ── Existing friend/follow routes (unchanged) ──
router.get("/followed", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const follows = await Follow.find({ follower: userId })
      .populate("following", "name avatar role collegeName institutionName")
      .sort({ createdAt: -1 })
      .lean();
    const followedUsers = follows.map((f) => f.following).filter(Boolean);
    res.json({ users: followedUsers });
  } catch (err) {
    console.error("getFollowed error:", err);
    res.status(500).json({ error: "Failed to load followed users" });
  }
});

router.get("/friends/requests", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const [incoming, outgoing] = await Promise.all([
      FriendRequest.find({ recipient: userId, status: "pending" }).populate("requester", "name avatar role collegeName institutionName").sort({ createdAt: -1 }).lean(),
      FriendRequest.find({ requester: userId }).populate("recipient", "name avatar role collegeName institutionName").sort({ createdAt: -1 }).lean(),
    ]);
    res.json({ incoming, outgoing });
  } catch (err) {
    console.error("getFriendRequests error:", err);
    res.status(500).json({ error: "Failed to load requests" });
  }
});

router.post("/friends/request", authMiddleware, async (req, res) => {
  try {
    const { recipientId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(recipientId)) return res.status(400).json({ error: "Invalid user id" });
    if (recipientId === req.user.id) return res.status(400).json({ error: "Cannot friend yourself" });
    const existing = await FriendRequest.findOne({ requester: req.user.id, recipient: recipientId });
    if (existing) return res.status(409).json({ error: "Request already sent" });
    const request = await FriendRequest.create({ requester: req.user.id, recipient: recipientId });
    res.status(201).json({ request });
  } catch (err) {
    console.error("sendFriendRequest error:", err);
    res.status(500).json({ error: "Failed to send request" });
  }
});

router.post("/friends/respond", authMiddleware, async (req, res) => {
  try {
    const { requestId, accept } = req.body;
    if (!mongoose.Types.ObjectId.isValid(requestId)) return res.status(400).json({ error: "Invalid request id" });
    const request = await FriendRequest.findOneAndUpdate(
      { _id: requestId, recipient: req.user.id, status: "pending" },
      { $set: { status: accept ? "accepted" : "rejected" } },
      { new: true }
    );
    if (!request) return res.status(404).json({ error: "Request not found" });
    res.json({ request, message: accept ? "Friend request accepted" : "Friend request rejected" });
  } catch (err) {
    console.error("respondFriendRequest error:", err);
    res.status(500).json({ error: "Failed to respond" });
  }
});

router.get("/friends/list", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const accepted = await FriendRequest.find({
      $or: [{ requester: userId, status: "accepted" }, { recipient: userId, status: "accepted" }],
    }).populate("requester recipient", "name avatar role collegeName institutionName walletAddress").lean();
    const friends = accepted.map((f) => {
      const friend = f.requester._id.toString() === userId ? f.recipient : f.requester;
      return { ...friend, friendSince: f.updatedAt };
    });
    res.json({ friends });
  } catch (err) {
    console.error("getFriendsList error:", err);
    res.status(500).json({ error: "Failed to load friends" });
  }
});

router.delete("/friends/:friendId", authMiddleware, async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.user.id;
    if (!mongoose.Types.ObjectId.isValid(friendId)) return res.status(400).json({ error: "Invalid friend id" });
    await FriendRequest.deleteMany({
      $or: [
        { requester: userId, recipient: friendId },
        { requester: friendId, recipient: userId },
      ],
    });
    res.json({ message: "Friend removed" });
  } catch (err) {
    console.error("removeFriend error:", err);
    res.status(500).json({ error: "Failed to remove friend" });
  }
});

module.exports = router;
