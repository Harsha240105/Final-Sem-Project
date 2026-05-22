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

module.exports = { uploadId, uploadSignature, uploadVerification };
