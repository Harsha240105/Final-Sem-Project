const fs = require("fs");
const multer = require("multer");
const path = require("path");

function sanitizeFilename(input) {
  return (input || "unknown").replace(/[^a-fA-F0-9x]/g, "").slice(0, 10);
}

const ID_STORAGE = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads", "ids"));
  },
  filename: (req, file, cb) => {
    const wallet = sanitizeFilename(req.body?.walletAddress);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `id-${wallet}-${Date.now()}${ext}`);
  },
});

const SIG_STORAGE = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads", "signatures"));
  },
  filename: (req, file, cb) => {
    const wallet = sanitizeFilename(req.body?.walletAddress);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `sig-${wallet}-${Date.now()}${ext}`);
  },
});

const ALLOWED_ID_EXTS = [".jpg", ".jpeg", ".png", ".pdf"];
const ALLOWED_SIG_EXTS = [".png", ".jpg", ".jpeg"];

function checkExt(ext, allowed) {
  return allowed.includes(ext);
}

const ID_FILTER = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (checkExt(ext, ALLOWED_ID_EXTS)) return cb(null, true);
  cb(new Error("Only JPG, PNG, and PDF files are allowed"));
};

const SIG_FILTER = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (checkExt(ext, ALLOWED_SIG_EXTS)) return cb(null, true);
  cb(new Error("Only PNG and JPG files are allowed for signatures"));
};

const uploadId = multer({
  storage: ID_STORAGE,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: ID_FILTER,
});

const uploadSignature = multer({
  storage: SIG_STORAGE,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: SIG_FILTER,
});

const COMBINED_STORAGE = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads", file.fieldname === "signature" ? "signatures" : "ids"));
  },
  filename: (req, file, cb) => {
    const wallet = sanitizeFilename(req.body?.walletAddress);
    const prefix = file.fieldname === "signature" ? "sig" : "id";
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${prefix}-${wallet}-${Date.now()}${ext}`);
  },
});

const COMBINED_FILTER = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = file.fieldname === "signature" ? ALLOWED_SIG_EXTS : ALLOWED_ID_EXTS;
  if (checkExt(ext, allowed)) return cb(null, true);
  cb(new Error(file.fieldname === "signature" ? "Only PNG and JPG files are allowed for signatures" : "Only JPG, PNG, and PDF files are allowed"));
};

const uploadVerification = multer({
  storage: COMBINED_STORAGE,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: COMBINED_FILTER,
});

const CHAT_STORAGE = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, "..", "uploads", "chat");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const userId = sanitizeFilename(req.user?.id || "anon");
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `chat-${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`);
  },
});

const CHAT_ALLOWED_MIMES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "video/mp4", "video/webm", "video/quicktime",
  "audio/webm", "audio/mp3", "audio/ogg", "audio/wav", "audio/mp4",
  "application/pdf", "application/zip", "application/x-zip-compressed",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/csv", "application/json",
];

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const AUDIO_MIMES = new Set(["audio/webm", "audio/mp3", "audio/ogg", "audio/wav", "audio/mp4"]);

function classifyMime(mime) {
  if (IMAGE_MIMES.has(mime)) return "image";
  if (VIDEO_MIMES.has(mime)) return "video";
  if (AUDIO_MIMES.has(mime)) return "audio";
  return "file";
}

function chatFileFilter(_req, file, cb) {
  if (CHAT_ALLOWED_MIMES.includes(file.mimetype)) return cb(null, true);
  cb(new Error(`File type ${file.mimetype} is not allowed`));
}

const uploadChat = multer({
  storage: CHAT_STORAGE,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: chatFileFilter,
});

module.exports = { uploadId, uploadSignature, uploadVerification, uploadChat, classifyMime };
