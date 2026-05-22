import { useCallback, useState, useEffect, useRef } from "react";
import { getCommunity } from "../../../shared/services/api";

export function useCommunity(communityId) {
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetch = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token || !communityId) return;
      const data = await getCommunity(communityId, token);
      setCommunity(data);
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    fetch();
    intervalRef.current = setInterval(fetch, 30000);
    return () => { clearInterval(intervalRef.current); };
  }, [fetch]);

  const isAdmin = community ? (() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return false;
      const payload = JSON.parse(atob(token.split(".")[1]));
      const uid = payload.id;
      const isCreator = String(community.createdBy?._id || community.createdBy) === uid;
      const isTeacher = payload.role === "teacher" || payload.role === "admin";
      return isCreator || isTeacher;
    } catch { return false; }
  })() : false;

  const isMember = community ? (() => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return false;
      const payload = JSON.parse(atob(token.split(".")[1]));
      const uid = payload.id;
      return (community.members || []).some(m => String(m._id || m) === uid);
    } catch { return false; }
  })() : false;

  const isArchived = community?.status === "archived";

  return { community, loading, error, fetch, isAdmin, isMember, isArchived, setCommunity };
}
