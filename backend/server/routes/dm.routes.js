const express = require("express");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");
const Message = require("../../database/models/Message");
const FriendRequest = require("../../database/models/FriendRequest");
const Conversation = require("../../database/models/Conversation");
const Follow = require("../../database/models/Follow");
const User = require("../../database/models/User");
const { authMiddleware } = require("../middleware/auth.middleware");

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
      { $match: { $or: [{ sender: new mongoose.Types.ObjectId(userId) }, { receiver: new mongoose.Types.ObjectId(userId) }], deleted: false } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: { $cond: [{ $eq: ["$sender", new mongoose.Types.ObjectId(userId)] }, "$receiver", "$sender"] }, lastMessage: { $first: "$$ROOT" }, unread: { $sum: { $cond: [{ $and: [{ $eq: ["$receiver", new mongoose.Types.ObjectId(userId)] }, { $eq: ["$read", false] }] }, 1, 0] } } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      { $project: { "user.password": 0, "user.nftCertificates": 0 } },
      { $sort: { "lastMessage.createdAt": -1 } },
    ]);

    // Also get followed users who have no messages yet
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

router.post(
  "/send",
  authMiddleware,
  [body("text").trim().notEmpty().isLength({ max: 2000 }).withMessage("Text is required (max 2000 chars)"),
   body("receiver").notEmpty().withMessage("Receiver id is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ error: "Validation failed", details: errors.array() });
      const { text, receiver, image, gif, replyTo } = req.body;
      if (!mongoose.Types.ObjectId.isValid(receiver)) return res.status(400).json({ error: "Invalid receiver id" });
      if (receiver === req.user.id) return res.status(400).json({ error: "Cannot message yourself" });
      // Auto-create conversation if it doesn't exist
      try {
        const existingConv = await Conversation.findOne({
          participants: { $all: [req.user.id, receiver] }
        });
        if (!existingConv) {
          await Conversation.create({
            participants: [req.user.id, receiver],
          });
        }
      } catch (convErr) {
        console.error("Auto-create conversation on message error:", convErr);
      }
      const msg = await Message.create({ sender: req.user.id, receiver, text, image, gif, replyTo });
      const populated = await Message.findById(msg._id).populate("sender", "name avatar role").populate("receiver", "name avatar role").lean();
      const io = req.app.get("io");
      if (io) {
        io.to(receiver).emit("new_message", populated);
        io.to(req.user.id).emit("new_message", populated);
      }
      res.status(201).json({ message: populated });
    } catch (err) {
      console.error("sendMessage error:", err);
      res.status(500).json({ error: "Failed to send message" });
    }
  }
);

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
    res.json({ message: "Message deleted" });
  } catch (err) {
    console.error("deleteMessage error:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

router.get("/followed", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const Follow = require("../../database/models/Follow");
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
