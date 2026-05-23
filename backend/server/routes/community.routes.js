const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const { adminOnly, elevatedAuth } = require("../middleware/admin.middleware");
const { teacherApprovedAuth } = require("../middleware/role.middleware");
const { uploadChat } = require("../middleware/upload");
const {
  getCommunities,
  getCommunity,
  createCommunity,
  joinCommunity,
  leaveCommunity,
  addComment,
  deleteComment,
  addContribution,
  deleteCommunity,
  uploadFiles,
  updateCommunity,
  removeMember,
  assignManager,
  createCollab,
  joinCollab,
  sendCollabMessage,
  getCollabMessages,
  sendCommunityMessage,
  sendCommunityVoiceMessage,
  deleteCommunityMessage,
  deleteCollabMessage,
  completeCommunityTask,
  archiveCommunity,
  addResource,
  deleteResource,
  getTimeline,
  getCommunityStats,
} = require("../controllers/communityController");
// ── Multer config for community uploads ──
const uploadDir = path.join(__dirname, "..", "uploads", "communities");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, "-").slice(0, 40);
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = [
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
    "video/mp4", "video/webm", "video/ogg", "video/quicktime",
    "application/pdf",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/zip", "application/x-zip-compressed",
  ];
  cb(null, allowed.includes(file.mimetype));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 100 * 1024 * 1024 } });

const communityUpload = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "logo", maxCount: 1 },
  { name: "files", maxCount: 5 },
]);

// ─── Community CRUD ───
router.get("/", authMiddleware, getCommunities);
router.get("/:id", authMiddleware, getCommunity);
router.post("/", authMiddleware, teacherApprovedAuth, communityUpload, createCommunity);
router.put("/:id", authMiddleware, communityUpload, updateCommunity);
router.delete("/:id", adminOnly, deleteCommunity);

// ─── Membership ───
router.post("/:id/join", authMiddleware, joinCommunity);
router.post("/:id/leave", authMiddleware, leaveCommunity);
router.delete("/:id/members/:memberId", elevatedAuth, removeMember);

// ─── Admin actions ───
router.post("/:id/assign-manager", adminOnly, assignManager);

// ─── Comments ───
router.post("/:id/comment", authMiddleware, addComment);
router.delete("/:communityId/comments/:commentId", authMiddleware, deleteComment);

// ─── Contributions (admin / community_manager) ───
router.post("/:id/contribution", authMiddleware, addContribution);

// ─── File uploads (admin / community_manager) ───
router.post("/:id/upload", authMiddleware, communityUpload, uploadFiles);

// ─── Collaborations ───
router.post("/:id/collab/create", authMiddleware, createCollab);
router.post("/:id/collab/:collabId/join", authMiddleware, joinCollab);
router.post("/:id/collab/:collabId/message", authMiddleware, sendCollabMessage);
router.get("/:id/collab/:collabId/messages", authMiddleware, getCollabMessages);
router.delete("/:id/collab/:collabId/message/:messageId", authMiddleware, deleteCollabMessage);

// ─── Community Public Chat ───
router.post("/:id/messages", authMiddleware, sendCommunityMessage);
router.post("/:id/voice", authMiddleware, uploadChat.single("audio"), sendCommunityVoiceMessage);
router.delete("/:id/messages/:messageId", authMiddleware, deleteCommunityMessage);

// ─── Phase 4: Completion & Archive ───
router.post("/:id/complete-task", authMiddleware, completeCommunityTask);
router.post("/:id/archive", authMiddleware, archiveCommunity);

// ─── Phase 4: Resources ───
const singleUpload = upload.single("file");
router.post("/:id/resources", authMiddleware, singleUpload, addResource);
router.delete("/:id/resources/:resourceId", authMiddleware, deleteResource);

// ─── Phase 4: Timeline & Stats ───
router.get("/:id/timeline", authMiddleware, getTimeline);
router.get("/:id/stats", authMiddleware, getCommunityStats);

module.exports = router;
