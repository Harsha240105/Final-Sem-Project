const jwt = require("jsonwebtoken");
const Message = require("../../database/models/Message");

const voiceRooms = new Map();

const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX = 10;
const TYPING_DEBOUNCE_MS = 300;

function setupSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error("Authentication required"));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userName = decoded.name;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;
    const userVoiceRooms = new Set();
    socket.join(userId);
    socket.broadcast.emit("user_online", { userId, online: true });

    // ── Per-socket rate limiting ──
    socket.use((packet, next) => {
      const now = Date.now();
      if (!socket._rateLimit) {
        socket._rateLimit = { count: 1, start: now };
        return next();
      }
      if (now - socket._rateLimit.start > RATE_LIMIT_WINDOW_MS) {
        socket._rateLimit = { count: 1, start: now };
        return next();
      }
      socket._rateLimit.count++;
      if (socket._rateLimit.count > RATE_LIMIT_MAX) {
        return next(new Error("Rate limit exceeded"));
      }
      next();
    });

    // ── DM Typing (debounced) ──
    const typingTimers = new Map();
    socket.on("typing", ({ receiverId }) => {
      const key = `${userId}:${receiverId}`;
      if (typingTimers.has(key)) return;
      typingTimers.set(key, setTimeout(() => typingTimers.delete(key), TYPING_DEBOUNCE_MS));
      io.to(receiverId).emit("user_typing", { userId, userName: socket.userName });
    });

    socket.on("stop_typing", ({ receiverId }) => {
      const key = `${userId}:${receiverId}`;
      clearTimeout(typingTimers.get(key));
      typingTimers.delete(key);
      io.to(receiverId).emit("user_stop_typing", { userId });
    });

    // ── DM Read Receipt ──
    socket.on("mark_read", async ({ messageIds }) => {
      if (messageIds?.length) {
        await Message.updateMany(
          { _id: { $in: messageIds }, receiver: userId },
          { $set: { read: true, readAt: new Date() } }
        );
      }
    });

    // ── Server Room Join/Leave ──
    socket.on("join_server", ({ serverId }) => {
      socket.join(`server:${serverId}`);
    });

    socket.on("leave_server", ({ serverId }) => {
      socket.leave(`server:${serverId}`);
    });

    socket.on("join_server_channel", ({ serverId, channel }) => {
      socket.join(`server:${serverId}:${channel}`);
    });

    socket.on("leave_server_channel", ({ serverId, channel }) => {
      socket.leave(`server:${serverId}:${channel}`);
    });

    // ── Canvas Room Join/Leave ──
    socket.on("canvas:join", ({ canvasId }) => {
      socket.join(`canvas:${canvasId}`);
      socket.to(`canvas:${canvasId}`).emit("canvas:presence", {
        userId,
        userName: socket.userName,
        action: "joined",
      });
    });

    socket.on("canvas:leave", ({ canvasId }) => {
      socket.leave(`canvas:${canvasId}`);
      socket.to(`canvas:${canvasId}`).emit("canvas:presence", {
        userId,
        userName: socket.userName,
        action: "left",
      });
    });

    socket.on("canvas:node-move", ({ canvasId, nodeId, position }) => {
      socket.to(`canvas:${canvasId}`).emit("canvas:node-moved", {
        nodeId,
        position,
        userId,
        timestamp: Date.now(),
      });
    });

    socket.on("canvas:node-add", ({ canvasId, node }) => {
      socket.to(`canvas:${canvasId}`).emit("canvas:node-added", {
        node,
        userId,
        timestamp: Date.now(),
      });
    });

    socket.on("canvas:node-remove", ({ canvasId, nodeId }) => {
      socket.to(`canvas:${canvasId}`).emit("canvas:node-removed", {
        nodeId,
        userId,
        timestamp: Date.now(),
      });
    });

    socket.on("canvas:node-update", ({ canvasId, nodeId, data }) => {
      socket.to(`canvas:${canvasId}`).emit("canvas:node-updated", {
        nodeId,
        data,
        userId,
        timestamp: Date.now(),
      });
    });

    socket.on("canvas:edge-add", ({ canvasId, edge }) => {
      socket.to(`canvas:${canvasId}`).emit("canvas:edge-added", {
        edge,
        userId,
        timestamp: Date.now(),
      });
    });

    socket.on("canvas:edge-remove", ({ canvasId, edgeId }) => {
      socket.to(`canvas:${canvasId}`).emit("canvas:edge-removed", {
        edgeId,
        userId,
        timestamp: Date.now(),
      });
    });

    socket.on("canvas:viewport", ({ canvasId, viewport }) => {
      socket.to(`canvas:${canvasId}`).emit("canvas:viewport-updated", {
        viewport,
        userId,
        timestamp: Date.now(),
      });
    });

    // ── Community Room Join/Leave ──
    socket.on("join_community", ({ communityId }) => {
      socket.join(`community:${communityId}`);
    });

    socket.on("leave_community", ({ communityId }) => {
      socket.leave(`community:${communityId}`);
    });

    // ── Task Room Join/Leave ──
    socket.on("join_task", ({ taskId }) => {
      socket.join(`task:${taskId}`);
    });

    socket.on("leave_task", ({ taskId }) => {
      socket.leave(`task:${taskId}`);
    });

    // ── Server Typing (debounced) ──
    const serverTypingTimers = new Map();
    socket.on("server_typing", ({ serverId, channel }) => {
      const key = `${serverId}:${channel}:${userId}`;
      if (serverTypingTimers.has(key)) return;
      serverTypingTimers.set(key, setTimeout(() => serverTypingTimers.delete(key), TYPING_DEBOUNCE_MS));
      socket.to(`server:${serverId}:${channel}`).emit("server_user_typing", {
        userId,
        userName: socket.userName,
        channel,
      });
    });

    socket.on("server_stop_typing", ({ serverId, channel }) => {
      const key = `${serverId}:${channel}:${userId}`;
      clearTimeout(serverTypingTimers.get(key));
      serverTypingTimers.delete(key);
      socket.to(`server:${serverId}:${channel}`).emit("server_user_stop_typing", {
        userId,
        channel,
      });
    });

    // ═══════════════════════════════════════════════
    //  WEBRTC VOICE / VIDEO / SCREEN SHARE SIGNALING
    // ═══════════════════════════════════════════════

    socket.on("voice-join", ({ serverId, channel }) => {
      const roomKey = `${serverId}:${channel}`;
      if (!voiceRooms.has(roomKey)) voiceRooms.set(roomKey, new Map());
      const room = voiceRooms.get(roomKey);
      room.set(userId, { userId, userName: socket.userName, joinedAt: Date.now() });
      userVoiceRooms.add(roomKey);
      socket.join(`voice:${roomKey}`);
      const participants = Array.from(room.values());
      socket.emit("voice-room-state", { participants, roomKey });
      socket.to(`voice:${roomKey}`).emit("voice-user-joined", {
        userId,
        userName: socket.userName,
        participants,
      });
    });

    socket.on("voice-leave", ({ serverId, channel }) => {
      const roomKey = `${serverId}:${channel}`;
      const room = voiceRooms.get(roomKey);
      if (room && room.has(userId)) {
        room.delete(userId);
        userVoiceRooms.delete(roomKey);
        if (room.size === 0) voiceRooms.delete(roomKey);
        socket.leave(`voice:${roomKey}`);
        const participants = Array.from(room.values());
        socket.to(`voice:${roomKey}`).emit("voice-user-left", { userId, participants });
      }
    });

    socket.on("video-offer", ({ to, offer, serverId, channel }) => {
      io.to(to).emit("video-offer", { from: userId, offer, serverId, channel });
    });

    socket.on("video-answer", ({ to, answer, serverId, channel }) => {
      io.to(to).emit("video-answer", { from: userId, answer, serverId, channel });
    });

    socket.on("ice-candidate", ({ to, candidate, serverId, channel }) => {
      io.to(to).emit("ice-candidate", { from: userId, candidate, serverId, channel });
    });

    socket.on("screen-offer", ({ to, offer, serverId, channel }) => {
      io.to(to).emit("screen-offer", { from: userId, offer, serverId, channel });
    });

    socket.on("screen-answer", ({ to, answer, serverId, channel }) => {
      io.to(to).emit("screen-answer", { from: userId, answer, serverId, channel });
    });

    socket.on("screen-ice-candidate", ({ to, candidate, serverId, channel }) => {
      io.to(to).emit("screen-ice-candidate", { from: userId, candidate, serverId, channel });
    });

    socket.on("speaking", ({ serverId, channel, speaking }) => {
      const roomKey = `${serverId}:${channel}`;
      socket.to(`voice:${roomKey}`).emit("speaking", { userId, speaking });
    });

    socket.on("video-toggle", ({ serverId, channel, enabled }) => {
      const roomKey = `${serverId}:${channel}`;
      socket.to(`voice:${roomKey}`).emit("video-toggle", { userId, enabled });
    });

    socket.on("screen-share-start", ({ serverId, channel }) => {
      const roomKey = `${serverId}:${channel}`;
      socket.to(`voice:${roomKey}`).emit("screen-share-started", { userId, userName: socket.userName });
    });

    socket.on("screen-share-stop", ({ serverId, channel }) => {
      const roomKey = `${serverId}:${channel}`;
      socket.to(`voice:${roomKey}`).emit("screen-share-stopped", { userId });
    });

    socket.on("disconnect", () => {
      for (const roomKey of userVoiceRooms) {
        const room = voiceRooms.get(roomKey);
        if (room && room.has(userId)) {
          room.delete(userId);
          if (room.size === 0) voiceRooms.delete(roomKey);
          const participants = Array.from(room?.values() || []);
          socket.to(`voice:${roomKey}`).emit("voice-user-left", { userId, participants });
        }
      }
      userVoiceRooms.clear();
      socket.broadcast.emit("user_offline", { userId });
    });
  });

  return io;
}

module.exports = setupSocket;
