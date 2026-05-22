const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  addComment,
  requestCollaboration,
  updateCollaborationStatus,
  updateProjectStatus,
  publishShowcase,
  getMyPosts,
  getMyCollaborations,
} = require("../controllers/marketplaceController");

// CRUD
router.post("/", authMiddleware, createPost);
router.get("/", authMiddleware, getPosts);
router.get("/my", authMiddleware, getMyPosts);
router.get("/collaborations", authMiddleware, getMyCollaborations);
router.get("/:id", authMiddleware, getPost);
router.put("/:id", authMiddleware, updatePost);
router.delete("/:id", authMiddleware, deletePost);

// Comments
router.post("/:id/comment", authMiddleware, addComment);

// Collaboration
router.post("/:id/collab", authMiddleware, requestCollaboration);
router.put("/:id/collab", authMiddleware, updateCollaborationStatus);

// Project workflow
router.put("/:id/status", authMiddleware, updateProjectStatus);
router.post("/:id/showcase", authMiddleware, publishShowcase);

module.exports = router;
