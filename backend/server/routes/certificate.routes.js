const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  getUserCertificates,
  verifyCertificate,
  saveCertificateAfterMint,
  syncCertificateStatus,
  debugGetUserCertificatesRaw,
  debugCheckCertificateCollection,
  refreshCertificateMetadata,
} = require("../controllers/certificateController");

router.get("/my", authMiddleware, getUserCertificates);

router.post("/sync", authMiddleware, syncCertificateStatus);

router.get("/debug/raw", authMiddleware, debugGetUserCertificatesRaw);

router.get("/debug/collection", authMiddleware, debugCheckCertificateCollection);

router.post("/save", authMiddleware, saveCertificateAfterMint);

router.post("/refresh-metadata/:certificateId", authMiddleware, refreshCertificateMetadata);

router.get("/:certificateId", verifyCertificate);

module.exports = router;
