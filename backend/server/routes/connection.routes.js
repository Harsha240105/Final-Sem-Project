const express = require("express");
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  getConnectionOverview,
  followUser,
  unfollowUser,
  getDashboardStats,
  getUserProfileWithFollowStatus,
  discoverUsers,
} = require("../controllers/connectionController");
const Follow = require("../../database/models/Follow");

const router = express.Router();

router.get("/overview", authMiddleware, getConnectionOverview);
router.get("/dashboard-stats", authMiddleware, getDashboardStats);
router.get("/user/:userId", authMiddleware, getUserProfileWithFollowStatus);
router.get("/users/discover", authMiddleware, discoverUsers);
router.post("/:targetUserId/follow", authMiddleware, followUser);
router.delete("/:targetUserId/follow", authMiddleware, unfollowUser);

// Cleanup duplicate follow records (admin only)
router.post("/cleanup-duplicates", authMiddleware, async (req, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }
    const duplicates = await Follow.aggregate([
      { $group: { _id: { follower: "$follower", following: "$following" }, count: { $sum: 1 }, ids: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } },
    ]);
    let removed = 0;
    for (const dup of duplicates) {
      const [, ...remove] = dup.ids;
      const result = await Follow.deleteMany({ _id: { $in: remove } });
      removed += result.deletedCount;
    }
    console.log(`[CLEANUP] Removed ${removed} duplicate follow records`);
    res.json({ success: true, removed });
  } catch (err) {
    console.error("[CLEANUP] Error:", err);
    res.status(500).json({ error: "Cleanup failed" });
  }
});

module.exports = router;
