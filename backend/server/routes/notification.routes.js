const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controllers/notificationController");

/**
 * GET /api/notifications
 * Get all notifications for logged-in user
 */
router.get("/", authMiddleware, getNotifications);

/**
 * PUT /api/notifications/:notificationId/read
 * Mark a specific notification as read
 */
router.put("/:notificationId/read", authMiddleware, markNotificationRead);

/**
 * PUT /api/notifications/read-all
 * Mark all notifications as read
 */
router.put("/read-all", authMiddleware, markAllNotificationsRead);

module.exports = router;
