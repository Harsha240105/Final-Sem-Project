import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import PropTypes from "prop-types";
import { useSocket } from "./SocketContext";
import {
  getConnectionsOverview,
  followStudent,
  unfollowStudent,
} from "../services/api";

const FollowContext = createContext(null);

function getToken() {
  return localStorage.getItem("token");
}

export function FollowProvider({ children }) {
  const { socket } = useSocket();
  const [followingIds, setFollowingIds] = useState(new Set());
  const [followerIds, setFollowerIds] = useState(new Set());
  const [version, setVersion] = useState(0);
  const loadingRef = useRef(false);

  const loadFollowState = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const data = await getConnectionsOverview(token);
      const following = new Set(
        (data.following || []).map((u) => u._id || u.id).filter(Boolean)
      );
      const followers = new Set(
        (data.followers || []).map((u) => u._id || u.id).filter(Boolean)
      );
      setFollowingIds(following);
      setFollowerIds(followers);
    } catch {
      /* silent */
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadFollowState();
  }, [loadFollowState]);

  useEffect(() => {
    if (!socket) return;

    const handleFollow = ({ followerId, followingId }) => {
      const myId = (() => {
        try {
          const t = getToken();
          if (!t) return null;
          return JSON.parse(atob(t.split(".")[1])).id;
        } catch { return null; }
      })();
      if (!myId) return;

      if (followerId === myId) {
        setFollowingIds((prev) => new Set(prev).add(followingId));
      }
      if (followingId === myId) {
        setFollowerIds((prev) => new Set(prev).add(followerId));
      }
      setVersion((v) => v + 1);
      window.dispatchEvent(new CustomEvent("dashboard-updated"));
    };

    const handleUnfollow = ({ followerId, followingId }) => {
      const myId = (() => {
        try {
          const t = getToken();
          if (!t) return null;
          return JSON.parse(atob(t.split(".")[1])).id;
        } catch { return null; }
      })();
      if (!myId) return;

      if (followerId === myId) {
        setFollowingIds((prev) => {
          const next = new Set(prev);
          next.delete(followingId);
          return next;
        });
      }
      if (followingId === myId) {
        setFollowerIds((prev) => {
          const next = new Set(prev);
          next.delete(followerId);
          return next;
        });
      }
      setVersion((v) => v + 1);
      window.dispatchEvent(new CustomEvent("dashboard-updated"));
    };

    socket.on("followCreated", handleFollow);
    socket.on("followRemoved", handleUnfollow);
    socket.on("follow", handleFollow);

    return () => {
      socket.off("followCreated", handleFollow);
      socket.off("followRemoved", handleUnfollow);
      socket.off("follow", handleFollow);
    };
  }, [socket]);

  const follow = useCallback(async (targetUserId) => {
    const token = getToken();
    if (!token) throw new Error("Not authenticated");
    setFollowingIds((prev) => new Set(prev).add(targetUserId));
    try {
      await followStudent(targetUserId, token);
      setVersion((v) => v + 1);
      window.dispatchEvent(new CustomEvent("dashboard-updated"));
    } catch (err) {
      setFollowingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
      throw err;
    }
  }, []);

  const unfollow = useCallback(async (targetUserId) => {
    const token = getToken();
    if (!token) throw new Error("Not authenticated");
    setFollowingIds((prev) => {
      const next = new Set(prev);
      next.delete(targetUserId);
      return next;
    });
    try {
      await unfollowStudent(targetUserId, token);
      setVersion((v) => v + 1);
      window.dispatchEvent(new CustomEvent("dashboard-updated"));
    } catch (err) {
      setFollowingIds((prev) => new Set(prev).add(targetUserId));
      throw err;
    }
  }, []);

  const isFollowing = useCallback(
    (userId) => followingIds.has(userId),
    [followingIds]
  );

  const isFollower = useCallback(
    (userId) => followerIds.has(userId),
    [followerIds]
  );

  const isMutual = useCallback(
    (userId) => followingIds.has(userId) && followerIds.has(userId),
    [followingIds, followerIds]
  );

  const value = useMemo(
    () => ({
      followingIds,
      followerIds,
      version,
      follow,
      unfollow,
      isFollowing,
      isFollower,
      isMutual,
      loadFollowState,
    }),
    [
      followingIds,
      followerIds,
      version,
      follow,
      unfollow,
      isFollowing,
      isFollower,
      isMutual,
      loadFollowState,
    ]
  );

  return (
    <FollowContext.Provider value={value}>{children}</FollowContext.Provider>
  );
}

FollowProvider.propTypes = { children: PropTypes.node.isRequired };

export function useFollow() {
  const ctx = useContext(FollowContext);
  if (!ctx) throw new Error("useFollow must be used within FollowProvider");
  return ctx;
}

export default FollowContext;
