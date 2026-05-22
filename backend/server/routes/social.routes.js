const express = require("express");
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  getUserPublicProfile,
  getUserFollowers,
  getUserFollowing,
  getUserMutuals,
} = require("../controllers/socialController");

const router = express.Router();

router.get("/profile/:userId", authMiddleware, getUserPublicProfile);
router.get("/:userId/followers", authMiddleware, getUserFollowers);
router.get("/:userId/following", authMiddleware, getUserFollowing);
router.get("/:userId/mutuals", authMiddleware, getUserMutuals);

module.exports = router;
