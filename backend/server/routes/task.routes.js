const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/role.middleware");
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

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "video/mp4", "video/webm", "video/ogg",
  "text/plain", "text/csv",
  "application/zip", "application/x-zip-compressed", "application/x-rar-compressed", "application/x-7z-compressed",
  "application/json", "text/javascript",
];

function fileFilter(_req, file, cb) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type "${file.mimetype}" is not allowed. Allowed types: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, images, videos, archives, plain text, CSV, JSON, JS`), false);
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tasksUploadDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    cb(null, `${timestamp}-${randomStr}-${safeName}`);
  },
});

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 1 * 1024 * 1024 * 1024, // 1GB per file
    files: 20, // Allow up to 20 files per request
  },
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

// POST /api/tasks/upload/:taskId — Upload task submission file
router.post("/upload/:taskId", authMiddleware, upload.single("file"), uploadTaskFile);

// POST /api/tasks/chat/:taskId — Add task chat message
router.post("/chat/:taskId", authMiddleware, addTaskChatMessage);

// GET /api/tasks/chat/:taskId — Fetch task chat messages
router.get("/chat/:taskId", authMiddleware, getTaskChatMessages);

module.exports = router;

