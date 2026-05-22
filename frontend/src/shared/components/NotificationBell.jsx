import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { getNotifications, markNotificationRead, markAllNotificationsRead } from "../services/api";
import propTypes from "prop-types";

function NotificationItem({ notification, onMarkRead, onNavigate }) {
  const getIcon = () => {
    switch (notification.type) {
      case "community_joined":
        return "👥";
      case "task_assigned":
        return "📋";
      case "task_completed":
        return "✓";
      case "certificate_issued":
        return "🎓";
      default:
        return "📢";
    }
  };

  const getColor = () => {
    if (notification.read) return "opacity-60";
    return "bg-purple-900/20";
  };

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification._id);
    }
    if (notification.redirectUrl) {
      onNavigate(notification.redirectUrl);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      onClick={handleClick}
      className={`group cursor-pointer rounded-lg border border-white/[0.08] p-3 transition hover:border-cyan-500/30 hover:bg-cyan-500/5 hover:shadow-[0_0_15px_rgba(0,245,255,0.1)] ${getColor()}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">{getIcon()}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{notification.message}</p>
          <p className="text-xs text-gray-500 mt-1">
            {new Date(notification.createdAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        {!notification.read && (
          <div className="mt-1.5 h-2 w-2 rounded-full bg-cyan-400 flex-shrink-0 animate-pulse shadow-[0_0_8px_rgba(0,245,255,0.6)]" />
        )}
      </div>
    </motion.div>
  );
}

NotificationItem.propTypes = {
  notification: propTypes.object.isRequired,
  onMarkRead: propTypes.func.isRequired,
  onNavigate: propTypes.func.isRequired,
};

export default function NotificationBell() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const bellRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      setLoading(true);
      const data = await getNotifications(token);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
    window.addEventListener("notifications-updated", fetchNotifications);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notifications-updated", fetchNotifications);
    };
  }, [fetchNotifications]);

  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }
  }, [isOpen]);

  const handleMarkRead = async (notificationId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      await markNotificationRead(notificationId, token);
      await fetchNotifications();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      await markAllNotificationsRead(token);
      await fetchNotifications();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  return (
    <div className="relative z-[100]" ref={bellRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-cyan-500/10 hover:text-cyan-400 hover:shadow-[0_0_12px_rgba(0,245,255,0.2)]"
        aria-label="Notifications"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31M5 19.5A2.5 2.5 0 017.5 22h9a2.5 2.5 0 012.5-2.5M5 19.5a2.5 2.5 0 012.5-2.5m9 0a2.5 2.5 0 012.5-2.5m0 0V9.75c0-1.577-.912-2.969-2.312-3.678M15 19.5v.75a2.25 2.25 0 01-4.5 0v-.75m3-12a3 3 0 00-6 0"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-xs font-bold text-black shadow-[0_0_10px_rgba(0,245,255,0.6)] animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute right-0 top-full z-[130] mt-2 w-96 rounded-xl border border-cyan-500/20 bg-[rgba(7,17,31,0.96)] shadow-xl shadow-cyan-500/10 backdrop-blur-md"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <h3 className="font-semibold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-cyan-400 transition hover:text-cyan-300 hover:shadow-[0_0_8px_rgba(0,245,255,0.3)]"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-sm text-gray-400">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <span className="text-3xl mb-2">🔔</span>
                  <p className="text-sm text-gray-400">No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-2 p-3">
                  <AnimatePresence>
                    {notifications.map((notification) => (
                      <NotificationItem
                        key={notification._id}
                        notification={notification}
                        onMarkRead={handleMarkRead}
                        onNavigate={(url) => {
                          setIsOpen(false);
                          navigate(url);
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
