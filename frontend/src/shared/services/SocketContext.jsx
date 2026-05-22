import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { io } from "socket.io-client";
import { API_BASE_URL } from "./api";

const SocketContext = createContext(null);

const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, "");

export function SocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [tokenVersion, setTokenVersion] = useState(0);
  const [liveActivities, setLiveActivities] = useState([]);
  const activityRef = useRef([]);
  const socketRef = useRef(null);

  useEffect(() => {
    const handler = () => setTokenVersion((v) => v + 1);
    window.addEventListener("auth-changed", handler);
    return () => window.removeEventListener("auth-changed", handler);
  }, []);

  const addActivity = useCallback((event) => {
    const activity = {
      _id: event._id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: event.type || "generic",
      message: event.message || "",
      userId: event.userId || null,
      meta: event.meta || {},
      createdAt: event.createdAt || new Date().toISOString(),
    };
    activityRef.current = [activity, ...activityRef.current].slice(0, 50);
    setLiveActivities(activityRef.current);
  }, []);

  const clearActivities = useCallback(() => {
    activityRef.current = [];
    setLiveActivities([]);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      if (socketRef.current?.connected) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setConnected(false);
      return;
    }

    if (socketRef.current?.connected) {
      socketRef.current.disconnect();
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("user_online", ({ userId }) => {
      setOnlineUsers((prev) => new Set(prev).add(userId));
    });

    socket.on("user_offline", ({ userId }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    socket.on("activity", (event) => {
      addActivity(event);
    });

    socket.on("task_completed", (event) => {
      addActivity({ ...event, type: "task_completed" });
      window.dispatchEvent(new CustomEvent("dashboard-updated"));
    });

    socket.on("nft_minted", (event) => {
      addActivity({ ...event, type: "nft_minted" });
      window.dispatchEvent(new CustomEvent("certificates-updated"));
    });

    socket.on("certificate_claimed", (event) => {
      addActivity({ ...event, type: "certificate_claimed" });
      window.dispatchEvent(new CustomEvent("certificates-updated"));
    });

    socket.on("community_joined", (event) => {
      addActivity({ ...event, type: "community_joined" });
      window.dispatchEvent(new CustomEvent("dashboard-updated"));
    });

    socket.on("followCreated", (event) => {
      addActivity({ ...event, type: "follow" });
      window.dispatchEvent(new CustomEvent("dashboard-updated"));
    });

    socket.on("followRemoved", () => {
      window.dispatchEvent(new CustomEvent("dashboard-updated"));
    });

    socket.on("followCountUpdate", ({ userId, followerCount, followingCount }) => {
      window.dispatchEvent(new CustomEvent("live:followCountUpdate", {
        detail: { userId, followerCount, followingCount },
      }));
    });

    socket.on("marketplace_post", (event) => {
      addActivity({ ...event, type: "marketplace_post" });
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [tokenVersion, addActivity]);

  const value = useMemo(() => ({
    socket: socketRef.current,
    connected,
    onlineUsers,
    liveActivities,
    clearActivities,
  }), [connected, onlineUsers, liveActivities, clearActivities]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

SocketProvider.propTypes = { children: PropTypes.node.isRequired };

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
}
