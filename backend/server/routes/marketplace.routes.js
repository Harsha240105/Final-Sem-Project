const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const ctrl = require("../controllers/marketplaceController");

router.post("/", authMiddleware, ctrl.createPost);
router.get("/", authMiddleware, ctrl.getPosts);
router.get("/my", authMiddleware, ctrl.getMyPosts);
router.get("/collaborations", authMiddleware, ctrl.getMyCollaborations);
router.get("/:id", authMiddleware, ctrl.getPost);
router.put("/:id", authMiddleware, ctrl.updatePost);
router.delete("/:id", authMiddleware, ctrl.deletePost);

router.post("/:id/comment", authMiddleware, ctrl.addComment);

router.post("/:id/collab", authMiddleware, ctrl.requestCollaboration);
router.put("/:id/collab", authMiddleware, ctrl.updateCollaborationStatus);

router.put("/:id/status", authMiddleware, ctrl.updateProjectStatus);
router.post("/:id/showcase", authMiddleware, ctrl.publishShowcase);

// ── Collaboration Workspace routes ──
router.post("/:id/workspace", authMiddleware, ctrl.createWorkspace);
router.get("/:id/workspace", authMiddleware, ctrl.getWorkspace);
router.post("/:id/workspace/message/:channelName", authMiddleware, ctrl.sendWorkspaceMessage);
router.post("/:id/workspace/task", authMiddleware, ctrl.addWorkspaceTask);
router.put("/:id/workspace/task/:taskId", authMiddleware, ctrl.updateWorkspaceTask);
router.post("/:id/workspace/invite", authMiddleware, ctrl.inviteToWorkspace);

module.exports = router;
