const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");
const Submission = require("../../database/models/Submission");
const {
  createTask,
  getTasksByCommunity,
  completeTask,
  markTaskCompletedByStudent,
  completeTaskAndIssueCertificates,
  getMyTasks,
  uploadTaskFile,
  addTaskChatMessage,
  getTaskChatMessages,
} = require("../controllers/taskController");

const tasksUploadDir = path.join(__dirname, "..", "uploads", "tasks");
if (!fs.existsSync(tasksUploadDir)) {
  fs.mkdirSync(tasksUploadDir, { recursive: true });
}

function sanitizeFilename(file) {
  const safeName = file.originalname.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(7);
  return `${timestamp}-${randomStr}-${safeName}`;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, tasksUploadDir),
  filename: (_req, file, cb) => cb(null, sanitizeFilename(file)),
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024, files: 50 },
});

router.use((req, _res, next) => {
  console.log(`[TASK ROUTE] ${req.method} ${req.originalUrl}`);
  next();
});

// POST /api/tasks — Create task with file attachments (teachers, admins, community managers)
router.post("/", authMiddleware, authorizeRoles("teacher", "admin", "community_manager"), upload.array("attachments", 20), createTask);

// GET /api/tasks/my — Get tasks assigned to current user
router.get("/my", authMiddleware, getMyTasks);

// GET /api/tasks/community/:communityId — Get tasks for a community
router.get("/community/:communityId", authMiddleware, getTasksByCommunity);

// PATCH /api/tasks/:taskId/mark-complete — Student marks their own task completion
router.patch("/:taskId/mark-complete", authMiddleware, markTaskCompletedByStudent);

// PATCH /api/tasks/:taskId/complete — Mark task as complete (legacy - for backward compatibility)
router.patch("/:taskId/complete", authMiddleware, completeTask);

// POST /api/tasks/:taskId/complete — Community creator completes task and issues certificates
router.post("/:taskId/complete", authMiddleware, (req, res, next) => {
  console.log(`[TASK ROUTE] completeTaskAndIssueCertificates taskId=${req.params.taskId} userId=${req.user?.id || "unknown"}`);
  next();
}, completeTaskAndIssueCertificates);

// POST /api/tasks/upload/:taskId — Upload single task file
router.post("/upload/:taskId", authMiddleware, upload.single("file"), uploadTaskFile);

// POST /api/tasks/upload-multiple/:taskId — Upload multiple task files (no limit)
router.post("/upload-multiple/:taskId", authMiddleware, upload.array("files", 50), async (req, res) => {
  try {
    const { taskId } = req.params;
    const Task = require("../../database/models/task.model");
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });
    const userId = req.user._id || req.user.id;
    const files = (req.files || []).map(f => ({
      fileName: f.originalname,
      fileUrl: `/uploads/tasks/${f.filename}`,
      mimeType: f.mimetype,
      uploadedBy: userId,
    }));
    task.attachments = [...(task.attachments || []), ...files];
    await task.save();
    res.json({ files, message: `${files.length} file(s) uploaded` });
  } catch (err) {
    console.error("batchUpload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// POST /api/tasks/chat/:taskId — Add task chat message
router.post("/chat/:taskId", authMiddleware, addTaskChatMessage);

// GET /api/tasks/chat/:taskId — Fetch task chat messages
router.get("/chat/:taskId", authMiddleware, getTaskChatMessages);

// ─── Phase 4: Submissions ───

// POST /api/tasks/:taskId/submit — Student submits work
router.post("/:taskId/submit", authMiddleware, upload.array("files", 10), async (req, res) => {
  try {
    const { taskId } = req.params;
    const { links, notes, isFinal } = req.body;
    if (!mongoose.Types.ObjectId.isValid(taskId)) return res.status(400).json({ error: "Invalid task ID" });
    const Task = require("../../database/models/task.model");
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });
    const userId = req.user._id || req.user.id;
    let submission = await Submission.findOne({ task: taskId, student: userId });
    const files = (req.files || []).map(f => ({
      fileName: f.originalname, fileUrl: `/uploads/tasks/${f.filename}`, mimeType: f.mimetype, size: f.size,
    }));
    const linksArr = links ? (Array.isArray(links) ? links : [links]) : [];
    if (submission) {
      submission.previousVersions.push({
        files: submission.files, links: submission.links, notes: submission.notes, submittedAt: submission.createdAt,
      });
      submission.files = files;
      submission.links = linksArr;
      submission.notes = notes || "";
      submission.version += 1;
      submission.status = "submitted";
      if (isFinal === "true" || isFinal === true) submission.isFinal = true;
    } else {
      submission = await Submission.create({
        community: task.community_id, task: taskId, student: userId, files, links: linksArr, notes: notes || "",
        isFinal: isFinal === "true" || isFinal === true,
      });
    }
    await submission.save();
    const populated = await Submission.findById(submission._id).populate("student", "name avatar").lean();
    res.status(201).json({ submission: populated });
  } catch (err) {
    console.error("submitTask error:", err);
    res.status(500).json({ error: "Failed to submit" });
  }
});

// GET /api/tasks/:taskId/submissions — Teacher views all submissions
router.get("/:taskId/submissions", authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(taskId)) return res.status(400).json({ error: "Invalid task ID" });
    const Task = require("../../database/models/task.model");
    const task = await Task.findById(taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });
    const submissions = await Submission.find({ task: taskId })
      .populate("student", "name avatar role")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ submissions });
  } catch (err) {
    console.error("getSubmissions error:", err);
    res.status(500).json({ error: "Failed to load submissions" });
  }
});

// GET /api/tasks/:taskId/my-submission — Student views own submission
router.get("/:taskId/my-submission", authMiddleware, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user._id || req.user.id;
    const submission = await Submission.findOne({ task: taskId, student: userId }).populate("student", "name avatar").lean();
    res.json({ submission: submission || null });
  } catch (err) {
    console.error("getMySubmission error:", err);
    res.status(500).json({ error: "Failed to load submission" });
  }
});

// PUT /api/tasks/:taskId/submissions/:submissionId/review — Teacher reviews
router.put("/:taskId/submissions/:submissionId/review", authMiddleware, async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { status, feedback } = req.body;
    if (!["reviewed", "approved", "rejected"].includes(status)) return res.status(400).json({ error: "Invalid status" });
    const submission = await Submission.findById(submissionId);
    if (!submission) return res.status(404).json({ error: "Submission not found" });
    submission.status = status;
    submission.feedback = { text: feedback || "", givenBy: req.user._id || req.user.id, givenAt: new Date() };
    await submission.save();
    const populated = await Submission.findById(submission._id).populate("student", "name avatar").populate("feedback.givenBy", "name").lean();
    res.json({ submission: populated });
  } catch (err) {
    console.error("reviewSubmission error:", err);
    res.status(500).json({ error: "Failed to review" });
  }
});

module.exports = router;

