import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import {
  LayoutDashboard, MessageSquare, Gamepad2, Monitor,
  ShoppingCart, Compass, Award, Link2, Settings,
} from "lucide-react";

const baseLinks = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, color: "from-cyan-500 to-blue-500", glow: "shadow-cyan-500/20" },
  { to: "/messages", label: "Messages", icon: MessageSquare, color: "from-pink-500 to-rose-500", glow: "shadow-pink-500/20" },
  { to: "/communities", label: "Communities", icon: Gamepad2, color: "from-purple-500 to-indigo-500", glow: "shadow-purple-500/20" },
  { to: "/servers", label: "Servers", icon: Monitor, color: "from-green-500 to-teal-500", glow: "shadow-green-500/20" },
  { to: "/marketplace", label: "Marketplace", icon: ShoppingCart, color: "from-orange-500 to-red-500", glow: "shadow-orange-500/20" },
  { to: "/discover", label: "Discover", icon: Compass, color: "from-cyan-500 to-purple-500", glow: "shadow-cyan-500/20" },
  { to: "/connections", label: "Connections", icon: Link2, color: "from-cyan-500 to-green-500", glow: "shadow-cyan-500/20" },
];

const certLink = { to: "/my-certificates", label: "Certificates", icon: Award, color: "from-yellow-500 to-orange-500", glow: "shadow-yellow-500/20" };

function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();

  const isElevated = ["admin", "teacher"].includes(user?.role);
  const links = isElevated
    ? [
        ...baseLinks,
        ...(user?.role === "admin"
          ? [{ to: "/admin/panel", label: "Admin Panel", icon: Settings, color: "from-emerald-500 to-teal-500", glow: "shadow-emerald-500/20" }]
          : []),
      ]
    : [...baseLinks, certLink];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  };

  return (
    <>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed md:static left-0 top-0 z-30 h-full w-64 border-r border-cyan-500/10 bg-[rgba(7,17,31,0.96)] backdrop-blur-md transition-transform duration-300 md:translate-x-0 overflow-y-auto custom-scrollbar ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative h-full flex flex-col">
          {/* Gradient glow orbs */}
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-cyan-500/5 rounded-full blur-[60px] pointer-events-none" />
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-500/5 rounded-full blur-[60px] pointer-events-none" />

          {/* Logo Section */}
          <motion.div 
            className="mb-6 flex items-center gap-3 px-4 pt-4"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden bg-gradient-to-br from-cyan-500 to-purple-600 shadow-lg shadow-cyan-500/30">
              <span className="text-lg font-black font-display bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">VC</span>
              <div className="absolute inset-0 rounded-xl ring-1 ring-white/10" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-white">Web3Connect</div>
              <div className="text-xs text-gray-500">Virtual Campus</div>
            </div>
          </motion.div>

          {/* Navigation */}
          <nav className="flex-1 flex flex-col px-3 gap-1">
            <motion.div
              className="px-2 py-2 text-[10px] font-semibold text-gray-600 uppercase tracking-[0.15em]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              Navigation
            </motion.div>

            <motion.div
              className="space-y-1"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {links.map((link) => (
                <motion.div key={link.to} variants={itemVariants}>
                  <NavLink
                    to={link.to}
                    end={link.to === "/"}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "text-white bg-gradient-to-r from-cyan-500/10 to-purple-500/5 border border-cyan-500/20 shadow-[0_0_15px_rgba(0,245,255,0.08)]"
                          : "text-gray-400 hover:text-cyan-400 hover:bg-white/[0.03] border border-transparent"
                      }`
                    }
                    onClick={onClose}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.div
                            className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-gradient-to-b from-cyan-400 to-purple-500 shadow-[0_0_8px_rgba(0,245,255,0.5)]"
                            layoutId="activeIndicator"
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          />
                        )}

                        <motion.span
                          className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ${
                            isActive
                              ? `bg-gradient-to-br ${link.color} shadow-lg ${link.glow}`
                              : "bg-white/[0.04] group-hover:bg-cyan-500/10"
                          }`}
                          whileHover={{ scale: isActive ? 1.05 : 1.08 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <link.icon size={16} />
                        </motion.span>

                        <span className="relative z-10 flex-1 font-medium truncate">{link.label}</span>

                        {isActive && (
                          <motion.div
                            className="relative z-10 h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(0,245,255,0.6)]"
                            layoutId="activeDot"
                            transition={{ type: "spring", stiffness: 380, damping: 32 }}
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                </motion.div>
              ))}
            </motion.div>
          </nav>

          {/* Footer Section */}
          <motion.div
            className="mt-auto px-3 pb-4 pt-4 border-t border-white/[0.06]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="relative rounded-xl bg-gradient-to-br from-cyan-500/[0.08] to-purple-500/[0.06] border border-cyan-500/10 px-4 py-3 overflow-hidden group hover:border-cyan-500/20 transition-colors">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/5 to-purple-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity blur-lg" />
              <div className="relative z-10 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-cyan-500/20 shrink-0">
                  {user?.name ? user.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-white truncate">{user?.name || "User"}</p>
                  <p className="text-[10px] text-gray-500 capitalize truncate">{user?.role || "Student"}</p>
                </div>
                <span className="pulse-dot shrink-0" />
              </div>
            </div>
          </motion.div>
        </div>
      </aside>
    </>
  );
}

Sidebar.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default Sidebar;
