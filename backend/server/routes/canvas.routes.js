const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const canvasController = require("../controllers/canvasController");

router.use(authMiddleware);

router.get("/", canvasController.getMyCanvases);
router.get("/:id", canvasController.getCanvas);
router.post("/", canvasController.createCanvas);
router.put("/:id", canvasController.updateCanvas);
router.delete("/:id", canvasController.deleteCanvas);

router.post("/:id/collaborators", canvasController.addCollaborator);
router.delete("/:id/collaborators", canvasController.removeCollaborator);

router.post("/:id/nodes", canvasController.addNode);
router.put("/:id/nodes/:nodeId", canvasController.updateNode);
router.delete("/:id/nodes/:nodeId", canvasController.deleteNode);

router.post("/:id/edges", canvasController.addEdge);
router.delete("/:id/edges/:edgeId", canvasController.deleteEdge);

module.exports = router;
