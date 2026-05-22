const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const Server = require("../../database/models/Server");
const ServerMessage = require("../../database/models/ServerMessage");
const { authMiddleware } = require("../middleware/auth.middleware");

const router = express.Router();

const SERVER_PRESETS = {
  "Study Group": {
    channels: [
      { name: "general", type: "text" },
      { name: "announcements", type: "announcements" },
      { name: "assignments", type: "text" },
      { name: "resources", type: "text" },
      { name: "questions", type: "text" },
      { name: "projects", type: "text" },
      { name: "Study Room", type: "voice" },
      { name: "Group Discussion", type: "voice" },
      { name: "Live Lecture", type: "stage" },
    ],
  },
  "College Community": {
    channels: [
      { name: "general", type: "text" },
      { name: "announcements", type: "announcements" },
      { name: "events", type: "text" },
      { name: "discussions", type: "text" },
      { name: "Study Room", type: "voice" },
      { name: "Town Hall", type: "stage" },
    ],
  },
  "Department Hub": {
    channels: [
      { name: "general", type: "text" },
      { name: "announcements", type: "announcements" },
      { name: "syllabus", type: "text" },
      { name: "lecture-notes", type: "text" },
      { name: "assignments", type: "text" },
      { name: "Lecture Hall", type: "stage" },
    ],
  },
  "Teacher Classroom": {
    channels: [
      { name: "general", type: "text" },
      { name: "announcements", type: "announcements" },
      { name: "lectures", type: "text" },
      { name: "assignments", type: "text" },
      { name: "q-and-a", type: "text" },
      { name: "Classroom", type: "stage" },
      { name: "Office Hours", type: "voice" },
    ],
  },
  "Coding Club": {
    channels: [
      { name: "general", type: "text" },
      { name: "announcements", type: "announcements" },
      { name: "code-reviews", type: "text" },
      { name: "projects", type: "text" },
      { name: "help", type: "text" },
      { name: "Code Together", type: "voice" },
      { name: "Tech Talks", type: "stage" },
    ],
  },
  "Hackathon Team": {
    channels: [
      { name: "general", type: "text" },
      { name: "updates", type: "announcements" },
      { name: "ideas", type: "text" },
      { name: "dev-chat", type: "text" },
      { name: "War Room", type: "voice" },
      { name: "Pitch Practice", type: "stage" },
    ],
  },
  "Workshop Hub": {
    channels: [
      { name: "general", type: "text" },
      { name: "announcements", type: "announcements" },
      { name: "materials", type: "text" },
      { name: "feedback", type: "text" },
      { name: "Workshop", type: "stage" },
      { name: "Discussion Room", type: "voice" },
    ],
  },
  "Chill Zone": {
    channels: [
      { name: "general", type: "text" },
      { name: "memes", type: "text" },
      { name: "music", type: "text" },
      { name: "gaming", type: "text" },
      { name: "Lounge", type: "voice" },
    ],
  },
  "Gaming Club": {
    channels: [
      { name: "general", type: "text" },
      { name: "announcements", type: "announcements" },
      { name: "looking-for-group", type: "text" },
      { name: "clips", type: "text" },
      { name: "Game Chat", type: "voice" },
      { name: "Tournament", type: "stage" },
    ],
  },
  "NFT/Web3 Club": {
    channels: [
      { name: "general", type: "text" },
      { name: "announcements", type: "announcements" },
      { name: "trading", type: "text" },
      { name: "projects", type: "text" },
      { name: "alpha", type: "text" },
      { name: "Voice Chat", type: "voice" },
      { name: "AMAs", type: "stage" },
    ],
  },
  "Personal Friends Group": {
    channels: [
      { name: "general", type: "text" },
      { name: "plans", type: "text" },
      { name: "media", type: "text" },
      { name: "Hangout", type: "voice" },
    ],
  },
};

// ── Get all servers the user is a member of ──
router.get("/", authMiddleware, async (req, res) => {
  try {
    const servers = await Server.find({ members: req.user.id })
      .populate("owner", "name avatar")
      .select("-__v")
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ servers });
  } catch (err) {
    console.error("getServers error:", err);
    res.status(500).json({ error: "Failed to load servers" });
  }
});

// ── Get discoverable public servers ──
router.get("/discover", authMiddleware, async (req, res) => {
  try {
    const servers = await Server.find({ isPublic: true, members: { $ne: req.user.id } })
      .populate("owner", "name avatar")
      .select("name description icon members owner createdAt")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ servers });
  } catch (err) {
    console.error("discoverServers error:", err);
    res.status(500).json({ error: "Failed to discover servers" });
  }
});

// ── Get a single server ──
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid server id" });
    const server = await Server.findById(id)
      .populate("owner", "name avatar")
      .populate("members", "name avatar role")
      .populate("moderators", "name avatar")
      .lean();
    if (!server) return res.status(404).json({ error: "Server not found" });
    const isMember = server.members.some((m) => m._id.toString() === req.user.id);
    if (!isMember && !server.isPublic) return res.status(403).json({ error: "Not a member of this server" });
    res.json({ server, isMember });
  } catch (err) {
    console.error("getServer error:", err);
    res.status(500).json({ error: "Failed to load server" });
  }
});

// ── Create a server (students only — admins/teachers can only join) ──
router.post(["/", ""], authMiddleware, [
  body("name").trim().notEmpty().isLength({ max: 100 }).withMessage("Server name is required (max 100 chars)"),
  body("description").optional().trim().isLength({ max: 500 }),
], async (req, res) => {
  try {
    if (["admin", "teacher"].includes(req.user?.role)) {
      return res.status(403).json({ error: "Admins and teachers cannot create servers. They can only join existing servers." });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: "Validation failed", details: errors.array() });
    const { name, description, isPublic, preset } = req.body;
    let channels = [{ name: "general", type: "text" }];
    if (preset && SERVER_PRESETS[preset]) {
      channels = SERVER_PRESETS[preset].channels;
    }
    const inviteCode = crypto.randomBytes(4).toString("hex");
    const server = await Server.create({
      owner: req.user.id,
      name,
      description: description || "",
      isPublic: isPublic !== false,
      preset: preset || null,
      inviteCode,
      members: [req.user.id],
      memberRoles: [{ user: req.user.id, role: "owner" }],
      channels,
    });
    const populated = await Server.findById(server._id)
      .populate("owner", "name avatar")
      .lean();
    res.status(201).json({ server: populated });
  } catch (err) {
    console.error("createServer error:", err);
    res.status(500).json({ error: "Failed to create server" });
  }
});

// ── Join a server ──
router.post("/:id/join", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid server id" });
    const server = await Server.findOneAndUpdate(
      { _id: id, members: { $ne: req.user.id } },
      { $addToSet: { members: req.user.id } },
      { new: true }
    );
    if (!server) return res.status(404).json({ error: "Server not found or already a member" });
    res.json({ message: "Joined server", server });
  } catch (err) {
    console.error("joinServer error:", err);
    res.status(500).json({ error: "Failed to join server" });
  }
});

// ── Join by invite code ──
router.post("/join/:code", authMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const server = await Server.findOneAndUpdate(
      { inviteCode: code, members: { $ne: req.user.id } },
      { $addToSet: { members: req.user.id } },
      { new: true }
    );
    if (!server) return res.status(404).json({ error: "Invalid invite code or already a member" });
    res.json({ message: "Joined server", server });
  } catch (err) {
    console.error("joinByCode error:", err);
    res.status(500).json({ error: "Failed to join server" });
  }
});

// ── Leave a server ──
router.post("/:id/leave", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid server id" });
    const server = await Server.findById(id);
    if (!server) return res.status(404).json({ error: "Server not found" });
    if (server.owner.toString() === req.user.id) return res.status(400).json({ error: "Owner cannot leave. Transfer ownership or delete the server." });
    await Server.findByIdAndUpdate(id, { $pull: { members: req.user.id } });
    res.json({ message: "Left server" });
  } catch (err) {
    console.error("leaveServer error:", err);
    res.status(500).json({ error: "Failed to leave server" });
  }
});

// ── Delete a server (owner only) ──
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid server id" });
    const server = await Server.findOneAndDelete({ _id: id, owner: req.user.id });
    if (!server) return res.status(404).json({ error: "Server not found or not the owner" });
    await ServerMessage.deleteMany({ server: id });
    res.json({ message: "Server deleted" });
  } catch (err) {
    console.error("deleteServer error:", err);
    res.status(500).json({ error: "Failed to delete server" });
  }
});

// ── Add channel to server ──
router.post("/:id/channels", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid server id" });
    const { name, type } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Channel name is required" });
    const server = await Server.findOneAndUpdate(
      { _id: id, owner: req.user.id },
      { $push: { channels: { name: name.trim(), type: type || "text" } } },
      { new: true }
    );
    if (!server) return res.status(404).json({ error: "Server not found or not the owner" });
    res.json({ server });
  } catch (err) {
    console.error("addChannel error:", err);
    res.status(500).json({ error: "Failed to add channel" });
  }
});

// ── Remove channel from server ──
router.delete("/:id/channels/:channelId", authMiddleware, async (req, res) => {
  try {
    const { id, channelId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid server id" });
    if (!mongoose.Types.ObjectId.isValid(channelId)) return res.status(400).json({ error: "Invalid channel id" });
    const server = await Server.findOneAndUpdate(
      { _id: id, owner: req.user.id },
      { $pull: { channels: { _id: channelId } } },
      { new: true }
    );
    if (!server) return res.status(404).json({ error: "Server not found or not the owner" });
    res.json({ server });
  } catch (err) {
    console.error("removeChannel error:", err);
    res.status(500).json({ error: "Failed to remove channel" });
  }
});

// ── Get messages for a server channel ──
router.get("/:id/messages/:channel", authMiddleware, async (req, res) => {
  try {
    const { id, channel } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid server id" });
    const isMember = await Server.exists({ _id: id, members: req.user.id });
    if (!isMember) return res.status(403).json({ error: "Not a member" });
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 30));
    const skip = (page - 1) * limit;
    const messages = await ServerMessage.find({ server: id, channel, deleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("sender", "name avatar role")
      .lean();
    res.json({ messages: messages.reverse(), page, limit });
  } catch (err) {
    console.error("getServerMessages error:", err);
    res.status(500).json({ error: "Failed to load messages" });
  }
});

// ── Send a message to a server channel ──
router.post("/:id/messages/:channel", authMiddleware, [
  body("text").optional().trim().isLength({ max: 2000 }),
], async (req, res) => {
  try {
    const { id, channel } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid server id" });
    const { text, image } = req.body;
    if (!text && !image) return res.status(400).json({ error: "Message text or image is required" });
    const isMember = await Server.exists({ _id: id, members: req.user.id });
    if (!isMember) return res.status(403).json({ error: "Not a member of this server" });
    const channelExists = await Server.exists({ _id: id, "channels.name": channel });
    if (!channelExists) return res.status(404).json({ error: "Channel not found" });
    const msg = await ServerMessage.create({ server: id, channel, sender: req.user.id, text, image });
    const populated = await ServerMessage.findById(msg._id)
      .populate("sender", "name avatar role")
      .lean();
    const io = req.app.get("io");
    if (io) {
      io.to(`server:${id}:${channel}`).emit("server_message", populated);
    }
    res.status(201).json({ message: populated });
  } catch (err) {
    console.error("sendServerMessage error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ── Delete a server message ──
router.delete("/:id/messages/:messageId", authMiddleware, async (req, res) => {
  try {
    const { id, messageId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid server id" });
    if (!mongoose.Types.ObjectId.isValid(messageId)) return res.status(400).json({ error: "Invalid message id" });
    const msg = await ServerMessage.findOneAndUpdate(
      { _id: messageId, server: id, sender: req.user.id },
      { $set: { deleted: true } },
      { new: true }
    );
    if (!msg) return res.status(404).json({ error: "Message not found or not yours" });
    res.json({ message: "Message deleted" });
  } catch (err) {
    console.error("deleteServerMessage error:", err);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

module.exports = router;
