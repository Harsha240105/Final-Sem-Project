const mongoose = require("mongoose");
const Notification = require("../../database/models/Notification");

/**
 * Get all notifications for the logged-in user
 * Sorted by newest first
 */
async function getNotifications(req, res) {
  try {
    const userId = req.user.id;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("userId", "name avatar")
      .lean();

    const unreadCount = await Notification.countDocuments({
      userId,
      read: false,
    });

    res.json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (err) {
    console.error("getNotifications error:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
}

/**
 * Mark a notification as read
 */
async function markNotificationRead(req, res) {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ error: "Invalid notification ID" });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ success: true, notification });
  } catch (err) {
    console.error("markNotificationRead error:", err);
    res.status(500).json({ error: "Failed to update notification" });
  }
}

/**
 * Mark all notifications as read for user
 */
async function markAllNotificationsRead(req, res) {
  try {
    const userId = req.user.id;

    const result = await Notification.updateMany(
      { userId, read: false },
      { read: true }
    );

    res.json({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("markAllNotificationsRead error:", err);
    res.status(500).json({ error: "Failed to update notifications" });
  }
}

/**
 * Create a notification (internal helper, not exposed as route)
 */
async function createNotification({
  userId,
  message,
  type = "general",
  relatedId = null,
  relatedType = "none",
  redirectUrl = null,
}) {
  try {
    const notification = new Notification({
      userId,
      message,
      type,
      relatedId,
      relatedType,
      redirectUrl,
    });
    await notification.save();
    return notification;
  } catch (err) {
    console.error("createNotification error:", err);
    return null;
  }
}

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  createNotification,
};
