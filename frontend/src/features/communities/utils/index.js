import { formatTime, resolveAvatar, getInitials } from "../../messaging/utils";

const API_ORIGIN = (() => {
  try {
    const base = window.__API_BASE_URL__ || localStorage.getItem("apiBaseUrl") || "http://localhost:5001";
    return base.replace(/\/api\/?$/, "");
  } catch { return "http://localhost:5001"; }
})();

export function resolvePath(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

export { formatTime, resolveAvatar, getInitials };
