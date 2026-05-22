const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Marketplace = require("../../database/models/Marketplace");
const NFTCertificate = require("../../database/models/NFTCertificate");
const { authMiddleware } = require("../middleware/auth.middleware");

// POST /api/marketplace — Create a new marketplace listing (protected)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { title, description, type, community, tags } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ error: "Description is required" });
    }

    const parsedTags = Array.isArray(tags)
      ? tags.map((t) => t.trim()).filter(Boolean)
      : typeof tags === "string"
        ? tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [];

    const post = await Marketplace.create({
      title: title.trim(),
      description: description.trim(),
      type: type || "Job",
      community: community ? community.trim() : "",
      tags: parsedTags,
      createdBy: req.user.id,
    });

    const populated = await post.populate("createdBy", "name gmail");

    res.status(201).json(populated);
  } catch (err) {
    console.error("Marketplace POST error:", err);
    res.status(500).json({ error: "Failed to create listing" });
  }
});

// GET /api/marketplace — Get all marketplace listings (authenticated)
router.get("/", authMiddleware, async (_req, res) => {
  try {
    const limit = Math.min(Number(_req.query.limit) || 60, 120);
    const posts = await Marketplace.find()
      .select("title description type community tags status nftIssued participants collaborators comments createdBy createdAt")
      .limit(limit)
      .sort({ createdAt: -1 })
      .populate("createdBy", "name gmail avatar")
      .populate("comments.author", "name gmail avatar")
      .populate("collaborators.user", "name gmail avatar")
      .populate("participants", "name gmail avatar")
      .lean();

    res.json(posts);
  } catch (err) {
    console.error("Marketplace GET error:", err);
    res.status(500).json({ error: "Failed to fetch listings" });
  }
});

// POST /api/marketplace/:id/comment — Add a comment (protected)
router.post("/:id/comment", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid post ID" });
    }
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Comment text is required" });
    }

    const post = await Marketplace.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    post.comments.push({ text: text.trim(), author: req.user.id });
    await post.save();

    const updated = await Marketplace.findById(post._id)
      .populate("createdBy", "name gmail")
      .populate("comments.author", "name gmail")
      .populate("collaborators.user", "name gmail");

    res.status(201).json(updated);
  } catch (err) {
    console.error("Comment POST error:", err);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// POST /api/marketplace/:id/collab — Request to collaborate (protected)
router.post("/:id/collab", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid post ID" });
    }
    const post = await Marketplace.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (post.status === "closed") {
      return res.status(400).json({ error: "Cannot collaborate on a closed post" });
    }

    const alreadyRequested = post.collaborators.some(
      (c) => c.user.toString() === req.user.id
    );
    if (alreadyRequested) {
      return res.status(400).json({ error: "Already requested collaboration" });
    }

    if (post.createdBy.toString() === req.user.id) {
      return res.status(400).json({ error: "You cannot collaborate on your own post" });
    }

    post.collaborators.push({ user: req.user.id, status: "pending" });
    await post.save();

    const updated = await Marketplace.findById(post._id)
      .populate("createdBy", "name gmail")
      .populate("comments.author", "name gmail")
      .populate("collaborators.user", "name gmail");

    res.json(updated);
  } catch (err) {
    console.error("Collab POST error:", err);
    res.status(500).json({ error: "Failed to request collaboration" });
  }
});

// DELETE /api/marketplace/:id/delete — Delete permanently (creator only, must be open/active)
router.delete("/:id/delete", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid post ID" });
    }

    const post = await Marketplace.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (post.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only the creator can delete this post" });
    }

    if (post.status === "closed") {
      return res.status(400).json({ error: "Cannot delete a closed post" });
    }

    await Marketplace.findByIdAndDelete(req.params.id);
    res.json({ message: "Post deleted permanently", id: req.params.id });
  } catch (err) {
    console.error("Marketplace DELETE permanently error:", err);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// POST /api/marketplace/:id/reward-nft — Issue NFT certificates & close (creator only)
router.post("/:id/reward-nft", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid post ID" });
    }

    const post = await Marketplace.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (post.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: "Only the creator can issue rewards" });
    }

    if (post.status === "closed") {
      return res.status(400).json({ error: "Post is already closed" });
    }

    if (post.nftIssued) {
      return res.status(400).json({ error: "NFT rewards have already been issued" });
    }

    // Determine recipients: accepted collaborators + participants
    const recipientIds = new Set();
    post.collaborators.forEach((c) => {
      if (c.status === "accepted") recipientIds.add(c.user.toString());
    });
    post.participants.forEach((p) => recipientIds.add(p.toString()));

    if (recipientIds.size === 0) {
      return res.status(400).json({ error: "No accepted collaborators or participants to reward" });
    }

    // Create NFT certificates for each recipient
    const certificates = [];
    for (const userId of recipientIds) {
      const cert = await NFTCertificate.create({
        marketplaceItem: post._id,
        issuedTo: userId,
        issuedBy: req.user.id,
        title: post.title,
        description: post.description,
        type: post.type,
      });
      certificates.push(cert);
    }

    // Close the post
    post.status = "closed";
    post.nftIssued = true;
    await post.save();

    const updated = await Marketplace.findById(post._id)
      .populate("createdBy", "name gmail")
      .populate("comments.author", "name gmail")
      .populate("collaborators.user", "name gmail")
      .populate("participants", "name gmail");

    res.json({
      post: updated,
      certificates: certificates.length,
      message: `Issued ${certificates.length} NFT certificate(s) and closed the post`,
    });
  } catch (err) {
    console.error("Reward NFT error:", err);
    res.status(500).json({ error: "Failed to issue rewards" });
  }
});

// DELETE /api/marketplace/:id — Delete a marketplace post (only owner)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid post ID" });
    }
    const post = await Marketplace.findById(req.params.id);
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (post.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ error: "You can only delete your own posts" });
    }

    await Marketplace.findByIdAndDelete(req.params.id);
    res.json({ message: "Post deleted successfully", id: req.params.id });
  } catch (err) {
    console.error("Marketplace DELETE error:", err);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

// GET /api/marketplace/me/nfts — Get NFT certificates earned by current user
router.get("/me/nfts", authMiddleware, async (req, res) => {
  try {
    const certs = await NFTCertificate.find({ issuedTo: req.user.id })
      .sort({ createdAt: -1 })
      .populate("marketplaceItem", "title type publicId")
      .populate("issuedBy", "name");
    res.json(certs);
  } catch (err) {
    console.error("NFT GET error:", err);
    res.status(500).json({ error: "Failed to fetch NFT certificates" });
  }
});

// GET /api/marketplace/me/dashboard — Get current user's dashboard data (protected)
router.get("/me/dashboard", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Posts created by user
    const myPosts = await Marketplace.find({ createdBy: userId })
      .select("title type createdAt comments collaborators")
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("createdBy", "name gmail")
      .populate("comments.author", "name gmail")
      .populate("collaborators.user", "name gmail")
      .lean();

    // Posts where user is a collaborator
    const collabPosts = await Marketplace.find({ "collaborators.user": userId })
      .select("title type createdAt createdBy")
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("createdBy", "name gmail")
      .lean();

    // All posts to compute comments by user
    const allPosts = await Marketplace.find({ "comments.author": userId })
      .select("title comments")
      .populate("comments.author", "name gmail")
      .lean();

    const myComments = [];
    allPosts.forEach((post) => {
      post.comments.forEach((c) => {
        if (c.author && c.author._id.toString() === userId) {
          myComments.push({
            _id: c._id,
            text: c.text,
            createdAt: c.createdAt,
            postId: post._id,
            postTitle: post.title,
          });
        }
      });
    });
    myComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Compute stats
    const totalPosts = myPosts.length;
    const totalComments = myComments.length;
    const totalCollabs = collabPosts.length;
    const totalCommentsReceived = myPosts.reduce((sum, p) => sum + (p.comments?.length || 0), 0);
    const totalCollabRequests = myPosts.reduce((sum, p) => sum + (p.collaborators?.length || 0), 0);

    const byType = { Job: 0, Event: 0, Project: 0 };
    myPosts.forEach((p) => { if (byType[p.type] !== undefined) byType[p.type]++; });

    res.json({
      stats: {
        totalPosts,
        totalComments,
        totalCollabs,
        totalCommentsReceived,
        totalCollabRequests,
        byType,
      },
      myPosts,
      collabPosts,
      recentComments: myComments.slice(0, 10),
    });
  } catch (err) {
    console.error("Dashboard GET error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

module.exports = router;
