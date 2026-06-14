const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const Student = require("../../../database/models/Student");
const Teacher = require("../../../database/models/Teacher");
const AdminUser = require("../../../database/models/AdminUser");
const User = require("../../../database/models/User");
const DeletedUser = require("../../../database/models/DeletedUser");
const Notification = require("../../../database/models/Notification");
const ServerMessage = require("../../../database/models/ServerMessage");
const Message = require("../../../database/models/Message");
const { syncLegacyUserRecord, findUserByAnyId } = require("../utils/userSync");
const { authMiddleware } = require("../middleware/auth.middleware");
const { getUserCertificatesArray } = require("../controllers/certificateController");

function probeVideoDuration(filePath) {
  return new Promise((resolve, reject) => {
    execFile("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      filePath,
    ], { timeout: 10000 }, (err, stdout) => {
      if (err) return reject(err);
      const secs = parseFloat(stdout.trim());
      resolve(Number.isFinite(secs) ? secs : null);
    });
  });
}

const router = express.Router();

function getUserModelByRole(role) {
  if (role === "student") return Student;
  if (role === "teacher") return Teacher;
  if (role === "admin") return AdminUser;
  return User;
}

async function findWalletOwnerInAnotherAccount(walletAddress, currentUserId) {
  const walletRegex = new RegExp(`^${walletAddress}$`, "i");
  const checks = [
    { model: Student, source: "student" },
    { model: Teacher, source: "teacher" },
    { model: AdminUser, source: "admin" },
    { model: User, source: "legacy_user" },
  ];

  for (const { model, source } of checks) {
    const owner = await model.findOne({
      _id: { $ne: currentUserId },
      walletAddress: walletRegex,
    }).select("_id name gmail role");

    if (owner) {
      return { owner, source };
    }
  }

  return null;
}

async function findCurrentUser(authUser, projection = null) {
  if (!authUser?.id) {
    return null;
  }

  const userId = authUser.id;
  const models = [getUserModelByRole(authUser?.role), Student, Teacher, User, AdminUser].filter(
    (m, i, arr) => m && arr.indexOf(m) === i
  );

  for (const model of models) {
    let query = model.findById(userId);
    if (projection) query = query.select(projection);
    const doc = await query;
    if (doc) return doc;
  }
  return null;
}

function resolveStoredFilePath(storedPath) {
  if (!storedPath || typeof storedPath !== "string") {
    return null;
  }

  const normalizedRelativePath = storedPath.replace(/^[/\\]+/, "");
  return path.join(__dirname, "..", normalizedRelativePath);
}

const uploadDir = path.join(__dirname, "..", "uploads", "avatars");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${req.user.id}-${Date.now()}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "video/mp4", "video/webm",
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, GIF, WebP, MP4 and WebM files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.post("/avatar", authMiddleware, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const isVideo = /^video\//.test(req.file.mimetype);
    if (isVideo) {
      try {
        const duration = await probeVideoDuration(req.file.path);
        if (duration !== null) {
          if (duration < 10) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: "Video must be at least 10 seconds long" });
          }
          if (duration > 30) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: "Video must be 30 seconds or less" });
          }
        }
      } catch (probeErr) {
        console.warn("Could not probe video duration:", probeErr.message);
      }
    }

    const user = await findCurrentUser(req.user);
    if (!user) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "User not found" });
    }

    const previousAvatarPath = resolveStoredFilePath(user.avatar);
    if (previousAvatarPath && fs.existsSync(previousAvatarPath)) {
      try { fs.unlinkSync(previousAvatarPath); } catch {}
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    user.avatar = avatarUrl;
    await user.save();
    await syncLegacyUserRecord(user);

    return res.json({
      message: "Avatar updated",
      avatar: avatarUrl,
      avatarType: isVideo ? "video" : "image",
      data: {
        id: user._id,
        name: user.name,
        gmail: user.gmail,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error("Avatar upload error:", err);
    return res.status(500).json({ error: err.message || "Failed to upload avatar" });
  }
});

router.delete("/avatar", authMiddleware, async (req, res) => {
  try {
    const user = await findCurrentUser(req.user);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const previousAvatarPath = resolveStoredFilePath(user.avatar);
    if (previousAvatarPath && fs.existsSync(previousAvatarPath)) {
      fs.unlinkSync(previousAvatarPath);
    }

    user.avatar = null;
    await user.save();
    await syncLegacyUserRecord(user);

    return res.json({ message: "Avatar removed" });
  } catch (err) {
    console.error("Avatar delete error:", err);
    return res.status(500).json({ error: "Failed to remove avatar" });
  }
});

// Returns user data with wallet excluded for privacy.
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await findCurrentUser(req.user, "-password -walletAddress");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(user);
  } catch (err) {
    console.error("User GET error:", err);
    return res.status(500).json({ error: "Failed to get user" });
  }
});

router.get("/certificates", authMiddleware, getUserCertificatesArray);

async function upsertWalletAddress(req, res) {
  try {
    const role = req.user?.role;
    const model = getUserModelByRole(role);

    if (!model || !req.user?.id) {
      return res.status(404).json({ error: "User not found" });
    }

    if (role === "admin") {
      return res.status(403).json({
        error: "Wallet management is available only for student and teacher accounts.",
      });
    }

    const { walletAddress } = req.body;
    let normalizedWallet = null;

    if (typeof walletAddress === "string") {
      const trimmed = walletAddress.trim();
      if (trimmed) {
        const addressRegex = /^0x[a-fA-F0-9]{40}$/;
        if (!addressRegex.test(trimmed)) {
          return res.status(400).json({ error: "Invalid Ethereum wallet address" });
        }
        normalizedWallet = trimmed.toLowerCase();
      }
    } else if (walletAddress !== null && walletAddress !== undefined) {
      return res.status(400).json({
        error: "Wallet address must be a valid Ethereum address or null to remove",
      });
    }

    if (normalizedWallet) {
      const existingOwner = await findWalletOwnerInAnotherAccount(normalizedWallet, req.user.id);
      if (existingOwner) {
        return res.status(409).json({
          error: "This wallet is already linked to another account. Remove it there first.",
        });
      }
    }

    const user = await model.findByIdAndUpdate(
      req.user.id,
      { walletAddress: normalizedWallet },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await syncLegacyUserRecord(user);

    return res.json({
      message: "Wallet address updated",
      walletAddress: user.walletAddress || null,
    });
  } catch (err) {
    console.error("Wallet save error:", err);
    return res.status(500).json({ error: "Failed to save wallet address" });
  }
}

router.put("/wallet", authMiddleware, upsertWalletAddress);
router.patch("/wallet", authMiddleware, upsertWalletAddress);

router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const allowedFields = ["name", "displayName", "username", "bio", "collegeName", "phone", "collegeEmail", "registrationNumber"];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    }
    const sensitiveFields = ["name", "collegeName", "registrationNumber"];
    const touchedSensitive = sensitiveFields.some((f) => req.body[f] !== undefined);
    if (touchedSensitive) {
      user.verificationStatus = "pending";
    }
    await user.save();
    await syncLegacyUserRecord(user);
    const token = require("jsonwebtoken").sign(
      {
        id: user._id.toString(),
        name: user.name,
        role: user.role,
        walletAddress: user.walletAddress,
        did: user.did,
        authMethod: "wallet",
        verificationStatus: user.verificationStatus,
        onboardingCompleted: user.onboardingCompleted,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ success: true, user, token });
  } catch (err) {
    console.error("updateProfile error:", err);
    if (err.code === 11000 && err.keyPattern?.username) {
      return res.status(409).json({ error: "Username already taken" });
    }
    res.status(500).json({ error: "Failed to update profile" });
  }
});

/**
 * GET /api/user/:id/stats
 * Get certificate count and community count for a user by ID
 */
router.get("/:id/stats", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    if (!require("mongoose").Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    let user = await User.findById(id).select("nftCertificates communities").lean();
    if (!user) user = await Student.findById(id).select("nftCertificates communities").lean();
    if (!user) user = await Teacher.findById(id).select("nftCertificates communities").lean();

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({
      certificateCount: Array.isArray(user.nftCertificates) ? user.nftCertificates.length : 0,
      communityCount: Array.isArray(user.communities) ? user.communities.length : 0,
    });
  } catch (err) {
    console.error("[User Stats] Error:", err);
    res.status(500).json({ error: "Failed to fetch user stats" });
  }
});

router.get("/check-username", authMiddleware, async (req, res) => {
  try {
    const username = (req.query.username || "").trim().toLowerCase();
    if (!username || username.length < 3 || username.length > 20) {
      return res.json({ available: false, error: "Username must be 3-20 characters" });
    }
    const existing = await User.findOne({ username, _id: { $ne: req.user.id } });
    res.json({ available: !existing });
  } catch (err) {
    console.error("checkUsername error:", err);
    res.status(500).json({ error: "Failed to check username" });
  }
});

router.put("/banner", authMiddleware, upload.single("banner"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const bannerUrl = `/uploads/avatars/${req.file.filename}`;
    user.banner = bannerUrl;
    await user.save();
    await syncLegacyUserRecord(user);
    res.json({ banner: bannerUrl });
  } catch (err) {
    console.error("banner upload error:", err);
    res.status(500).json({ error: "Failed to upload banner" });
  }
});

router.get("/nfts", authMiddleware, async (req, res) => {
  try {
    if (!["student", "teacher"].includes(req.user?.role)) {
      return res.json([]);
    }

    const model = req.user.role === "teacher" ? Teacher : Student;
    let account = await model.findById(req.user.id).select("nftCertificates");

    if ((!account || !Array.isArray(account.nftCertificates) || account.nftCertificates.length === 0) && req.user?.id) {
      account = await User.findById(req.user.id).select("nftCertificates");
    }

    if (!account) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(account.nftCertificates || []);
  } catch (err) {
    console.error("NFT GET error:", err);
    return res.status(500).json({ error: "Failed to fetch NFT certificates" });
  }
});

/**
 * DELETE /api/user/account
 * Permanently delete user account but preserve NFTs on blockchain
 */
router.delete("/account", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Find user in all collections
    const user = await User.findById(userId)
      || await Student.findById(userId)
      || await Teacher.findById(userId)
      || await AdminUser.findById(userId);

    if (!user) return res.status(404).json({ error: "User not found" });

    // Save deletion record before removing
    const certCount = Array.isArray(user.nftCertificates) ? user.nftCertificates.length : 0;
    await DeletedUser.create({
      name: user.name || "Unknown",
      walletAddress: user.walletAddress || "",
      role: user.role || "",
      collegeName: user.collegeName || "",
      totalCertificates: certCount,
      totalTasks: Array.isArray(user.completedTasks) ? user.completedTasks.length : 0,
      deletedAt: new Date(),
    });

    // Cascade: remove related data
    await Promise.all([
      Notification.deleteMany({ userId }),
      ServerMessage.deleteMany({ sender: userId }),
      Message.deleteMany({ $or: [{ sender: userId }, { receiver: userId }] }),
    ]);

    // Remove from all collections
    await Promise.all([
      User.findByIdAndDelete(userId),
      Student.findByIdAndDelete(userId),
      Teacher.findByIdAndDelete(userId),
      AdminUser.findByIdAndDelete(userId),
      User.findOneAndDelete({ walletAddress: user.walletAddress }),
      Student.findOneAndDelete({ walletAddress: user.walletAddress }),
      Teacher.findOneAndDelete({ walletAddress: user.walletAddress }),
      AdminUser.findOneAndDelete({ walletAddress: user.walletAddress }),
    ]);

    console.log(`[DELETE ACCOUNT] User ${userId} (${user.name}) deleted. NFTs preserved on blockchain.`);
    res.json({ message: "Account deleted successfully. Your NFT certificates remain on the blockchain permanently." });
  } catch (err) {
    console.error("[DELETE ACCOUNT] Error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

/**
 * POST /api/user/wallet/sync
 * Reconcile wallet address across all models for a user.
 * Resolves dual-model mismatches where wallet is on Student/Teacher
 * but not synced to the User model (or vice versa).
 */
router.post("/wallet/sync", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id?.toString();
    if (!userId) {
      return res.status(400).json({ error: "User ID not found" });
    }

    // Find user across all models
    const userDoc = await findUserByAnyId(userId);
    if (!userDoc) {
      return res.status(404).json({ error: "User not found" });
    }

    // Collect wallet from any model that has it
    const models = [User, Student, Teacher, AdminUser];
    let resolvedWallet = null;
    const walletSources = [];

    for (const model of models) {
      try {
        const doc = await model.findById(userId).select("walletAddress").lean();
        if (doc?.walletAddress?.trim()) {
          const w = doc.walletAddress.trim().toLowerCase();
          if (!resolvedWallet) {
            resolvedWallet = w;
          }
          walletSources.push({ model: model.modelName, wallet: w });
        }
      } catch { /* model may not exist for this id */ }
    }

    // Also search by wallet address across models in case user has
    // different _ids on different models (SIWE dual-id scenario)
    if (!resolvedWallet) {
      const gmail = userDoc.gmail;
      if (gmail) {
        for (const model of models) {
          try {
            const doc = await model.findOne({ gmail }).select("walletAddress _id").lean();
            if (doc?.walletAddress?.trim() && doc._id.toString() !== userId) {
              const w = doc.walletAddress.trim().toLowerCase();
              if (!resolvedWallet) {
                resolvedWallet = w;
              }
              walletSources.push({ model: model.modelName, wallet: w, via: "gmail" });
            }
          } catch { /* skip */ }
        }
      }
    }

    if (!resolvedWallet) {
      return res.json({
        synced: false,
        message: "No wallet address found on any model for this user.",
        walletSources,
      });
    }

    // Sync resolved wallet to all models
    const results = [];
    for (const model of [User, Student, Teacher, AdminUser]) {
      try {
        const updated = await model.findByIdAndUpdate(
          userId,
          { walletAddress: resolvedWallet },
          { new: true }
        );
        if (updated) {
          results.push({ model: model.modelName, status: "updated" });
        } else {
          results.push({ model: model.modelName, status: "not_found" });
        }
      } catch (e) {
        results.push({ model: model.modelName, status: "error", error: e.message });
      }
    }

    // Also sync to User record found by gmail (handles SIWE dual-id)
    for (const source of walletSources) {
      if (source.via === "gmail") {
        const userByGmail = await User.findOne({ gmail: userDoc.gmail }).select("_id").lean();
        if (userByGmail && userByGmail._id.toString() !== userId) {
          await User.findByIdAndUpdate(userByGmail._id, { walletAddress: resolvedWallet });
          results.push({ model: "User(gmail-match)", status: "updated" });
        }
      }
    }

    return res.json({
      synced: true,
      message: `Wallet ${resolvedWallet.substring(0, 10)}... synced across all models.`,
      walletAddress: resolvedWallet,
      walletSources,
      results,
    });
  } catch (err) {
    console.error("[Wallet Sync] Error:", err);
    return res.status(500).json({ error: "Failed to sync wallet address" });
  }
});

module.exports = router;
