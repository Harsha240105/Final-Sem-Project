const express = require("express");
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  getUserPublicProfile,
  getUserFollowers,
  getUserFollowing,
  getUserMutuals,
  getLeaderboard,
} = require("../controllers/socialController");

const router = express.Router();

router.get("/profile/:userId", authMiddleware, getUserPublicProfile);
router.get("/:userId/followers", authMiddleware, getUserFollowers);
router.get("/:userId/following", authMiddleware, getUserFollowing);
router.get("/:userId/mutuals", authMiddleware, getUserMutuals);
router.get("/leaderboard", authMiddleware, getLeaderboard);

module.exports = router;
