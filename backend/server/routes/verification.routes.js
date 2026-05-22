const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const { uploadVerification } = require("../middleware/upload");
const {
  submitVerification,
  getVerificationStatus,
  saveSignature,
  completeOnboarding,
  triggerReVerification,
  checkVerification,
  updateProfile,
} = require("../controllers/verificationController");

router.post("/submit", authMiddleware, uploadVerification.fields([
  { name: "collegeId", maxCount: 1 },
  { name: "signature", maxCount: 1 },
]), submitVerification);

router.get("/status", authMiddleware, getVerificationStatus);
router.post("/signature", authMiddleware, saveSignature);
router.post("/complete", authMiddleware, completeOnboarding);
router.post("/re-verify", authMiddleware, triggerReVerification);

router.get("/check", authMiddleware, checkVerification);
router.put("/profile", authMiddleware, updateProfile);

// Role-specific verification submission
router.post("/student", authMiddleware, uploadVerification.fields([
  { name: "collegeId", maxCount: 1 },
  { name: "signature", maxCount: 1 },
]), (req, res, next) => {
  req.body.role = "student";
  next();
}, submitVerification);

router.post("/teacher", authMiddleware, uploadVerification.fields([
  { name: "collegeId", maxCount: 1 },
  { name: "signature", maxCount: 1 },
]), (req, res, next) => {
  req.body.role = "teacher";
  next();
}, submitVerification);

module.exports = router;
