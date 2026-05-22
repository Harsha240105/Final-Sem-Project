import PropTypes from "prop-types";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AnimatePresence, motion } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { API_BASE_URL as API_URL } from "../services/api";
import NotificationBell from "./NotificationBell";
const BASE_URL = API_URL.replace("/api", "");

function getInitials(name) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function Navbar({ onToggleSidebar }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const dropdownRef = useRef(null);

  const fetchAvatar = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      const res = await axios.get(`${API_URL}/user/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data?.avatar) {
        setAvatarUrl(`${BASE_URL}${res.data.avatar}`);
      }
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => { fetchAvatar(); }, [fetchAvatar]);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail?.avatar) setAvatarUrl(`${BASE_URL}${e.detail.avatar}`);
      else setAvatarUrl(null);
    };
    window.addEventListener("avatar-updated", handler);
    return () => window.removeEventListener("avatar-updated", handler);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close dropdown on route change
  useEffect(() => { setDropdownOpen(false); }, [location.pathname]);

  if (!user) return null;

  const goTo = (path) => {
    setDropdownOpen(false);
    setTimeout(() => navigate(path), 0);
  };

  return (
    <header className="relative z-[70] w-full overflow-visible border-b border-cyan-500/10 bg-[rgba(7,17,31,0.92)] backdrop-blur-md">
      <div className="relative z-[70] flex items-center justify-between overflow-visible px-4 py-2.5 md:px-6">
        <div className="relative z-[80] flex items-center gap-3 overflow-visible">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-cyan-500/10 hover:text-cyan-400 md:hidden"
            aria-label="Toggle sidebar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg overflow-hidden bg-gradient-to-br from-cyan-500 to-purple-600">
              <span className="text-lg font-black font-display bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">VC</span>
            </div>
            <span className="text-base font-bold tracking-tight text-white">Web3Connect</span>
          </div>
        </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <span className="hidden text-sm font-medium text-gray-300 md:block">{user.name}</span>

            {/* Notification Bell */}
            <NotificationBell />

            {/* Avatar + Dropdown */}
            <div className="relative z-[90]" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((p) => !p)}
                className="relative flex h-9 w-9 items-center justify-center rounded-full overflow-hidden ring-2 ring-cyan-500/10 transition hover:ring-cyan-500/30 focus:outline-none hover:shadow-lg hover:shadow-cyan-500/10"
              >
              {avatarUrl ? (
                <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" onError={() => setAvatarUrl(null)} />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-500 to-purple-500 text-xs font-bold text-white">
                  {getInitials(user.name)}
                </div>
              )}
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-green-400 ring-[1.5px] ring-[#050816]" />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full z-[120] mt-2 w-52 overflow-hidden rounded-xl border border-cyan-500/15 bg-[rgba(7,17,31,0.96)] shadow-2xl shadow-black/60 backdrop-blur-md"
                >
                  <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 bg-gradient-to-r from-cyan-500/[0.04] to-purple-500/[0.03]">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden ring-1 ring-white/10">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-500 to-purple-500 text-[10px] font-bold text-white">
                          {getInitials(user.name)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{user.gmail}</p>
                    </div>
                  </div>

                  <div className="py-1">
                    <button onClick={() => goTo("/profile")} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-300 transition hover:bg-cyan-500/10 hover:text-cyan-400">
                      <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                      My Profile
                    </button>
                    <button onClick={() => goTo("/")} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-300 transition hover:bg-cyan-500/10 hover:text-cyan-400">
                      <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
                      Dashboard
                    </button>
                    <button onClick={() => goTo("/settings/profile")} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-gray-300 transition hover:bg-cyan-500/10 hover:text-cyan-400">
                      <svg className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      Settings
                    </button>
                  </div>

                  <div className="border-t border-white/[0.06] py-1">
                    <button onClick={() => { setDropdownOpen(false); logout(); }} className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/10 hover:text-red-300 hover:shadow-[0_0_8px_rgba(255,77,109,0.15)]">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" /></svg>
                      Logout
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

Navbar.propTypes = {
  onToggleSidebar: PropTypes.func.isRequired,
};

export default Navbar;
