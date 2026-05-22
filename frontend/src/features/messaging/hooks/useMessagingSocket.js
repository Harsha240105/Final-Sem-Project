import { useCallback, useEffect, useRef, useState } from "react";

export function useMessagingSocket(socket, activeChat, activeUserId) {
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimers = useRef({});

  useEffect(() => {
    if (!socket) return;

    const onTyping = ({ userId: uid, userName }) => {
      setTypingUsers(prev => ({ ...prev, [uid]: userName }));
    };
    const onStopTyping = ({ userId: uid }) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[uid];
        return next;
      });
    };

    socket.on("user_typing", onTyping);
    socket.on("user_stop_typing", onStopTyping);
    return () => {
      socket.off("user_typing", onTyping);
      socket.off("user_stop_typing", onStopTyping);
    };
  }, [socket]);

  const emitTyping = useCallback((receiverId) => {
    if (!socket || !receiverId) return;
    socket.emit("typing", { receiverId });
    const key = `stop:${receiverId}`;
    clearTimeout(typingTimers.current[key]);
    typingTimers.current[key] = setTimeout(() => {
      socket.emit("stop_typing", { receiverId });
    }, 1500);
  }, [socket]);

  const cleanup = useCallback(() => {
    Object.values(typingTimers.current).forEach(clearTimeout);
    typingTimers.current = {};
  }, []);

  return { typingUsers, emitTyping, cleanup };
}
