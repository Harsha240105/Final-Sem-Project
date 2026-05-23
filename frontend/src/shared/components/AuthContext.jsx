import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { getCurrentUser } from "../services/api";

const AuthContext = createContext(null);

function decodeToken(token) {
  try {
    const encodedPayload = token.split(".")[1];
    if (!encodedPayload) return null;
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return payload;
  } catch {
    return null;
  }
}

function notifyAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth-changed"));
  }
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const loadUserFromToken = useCallback(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = decodeToken(token);
      if (decoded && decoded.exp * 1000 > Date.now()) {
        setUser(decoded);
        setLoading(false);
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("walletConnected");
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUserFromToken();
    const onAuthChanged = () => loadUserFromToken();
    window.addEventListener("auth-changed", onAuthChanged);
    return () => window.removeEventListener("auth-changed", onAuthChanged);
  }, [loadUserFromToken]);

  const login = useCallback(async (token, userObj) => {
    localStorage.setItem("token", token);
    localStorage.setItem("walletConnected", "true");
    if (userObj) {
      setUser(userObj);
    } else {
      const decoded = decodeToken(token);
      setUser(decoded);
    }
    notifyAuthChanged();
    return userObj || decodeToken(token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("walletConnected");
    setUser(null);
    notifyAuthChanged();
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
      const data = await getCurrentUser(token);
      if (data) {
        const decoded = decodeToken(token);
        const merged = { ...decoded, ...data };
        setUser(merged);
        return merged;
      }
    } catch {
      // silent
    }
    return null;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading: loading || !mounted,
      login,
      logout,
      refreshUser,
      isAuthenticated: mounted && Boolean(user),
    }),
    [user, loading, mounted, login, logout, refreshUser]
  );

  if (!mounted) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export { AuthContext, AuthProvider };
