import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion, useSpring } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import PropTypes from "prop-types";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { FollowProvider } from "./context/FollowContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import ProtectedRoute from "./components/ProtectedRoute";
import OnboardingGuard from "./components/OnboardingGuard";
import PageTransition from "./components/PageTransition";
import Dashboard from "./pages/Dashboard";
import Communities from "./pages/Communities";
import CommunityView from "./pages/CommunityView";
import Marketplace from "./pages/Marketplace";
import Servers from "./pages/Servers";
import Login from "./pages/Login";
import VerificationPage from "./pages/VerificationPage";
import OrganisationSetup from "./pages/OrganisationSetup";
import AdminSetup from "./pages/AdminSetup";
import AdminPanel from "./pages/AdminPanel";
import Profile from "./pages/Profile";
import UserProfile from "./pages/UserProfile";
import Discover from "./pages/Discover";
import Leaderboard from "./pages/Leaderboard";
import Connections from "./pages/Connections";
import ConnectWallet from "./pages/ConnectWallet";
import Messages from "./pages/Messages";
import MyCertificates from "./pages/MyCertificates";
import VerifyCertificate from "./pages/VerifyCertificate";
import ProfileSettings from "./pages/ProfileSettings";

import NotFound from "./pages/NotFound";
import { useAuth } from "./hooks/useAuth";

/* ── Scroll to Top Button ──────────────────────────── */
function ScrollToTopBtn() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const main = document.querySelector("main");
    const el = main || window;
    const onScroll = () => {
      const scrollY = main ? main.scrollTop : window.scrollY;
      setVisible(scrollY > 400);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => {
    const main = document.querySelector("main");
    if (main) {
      main.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Scroll to top"
        >
          <ChevronUp size={20} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/* ── Route Loading Progress Bar ──────────────────── */
function RouteProgressBar() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const scaleX = useSpring(0, { stiffness: 100, damping: 20 });
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (location.pathname !== prevPath.current) {
      prevPath.current = location.pathname;
      setLoading(true);
      scaleX.set(0.8);
      const t1 = setTimeout(() => {
        scaleX.set(1);
      }, 200);
      const t2 = setTimeout(() => {
        setLoading(false);
        scaleX.set(0);
      }, 500);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [location.pathname, scaleX]);

  if (!loading) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 right-0 z-[99999] h-[3px] bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 shadow-[0_0_12px_rgba(0,245,255,0.5)]"
      style={{ scaleX, transformOrigin: "left" }}
    />
  );
}

function AnimatedRoutes({ user }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/login"
          element={
            <PageTransition>
              <Login />
            </PageTransition>
          }
        />
        <Route
          path="/connect-wallet"
          element={
            <PageTransition>
              <ConnectWallet />
            </PageTransition>
          }
        />
        <Route
          path="/verify-student"
          element={
            <PageTransition>
              <VerificationPage />
            </PageTransition>
          }
        />
        <Route
          path="/verify-teacher"
          element={
            <PageTransition>
              <VerificationPage />
            </PageTransition>
          }
        />
        <Route
          path="/verify-admin"
          element={
            <PageTransition>
              <VerificationPage />
            </PageTransition>
          }
        />
        <Route
          path="/org-setup"
          element={
            <PageTransition>
              <OrganisationSetup />
            </PageTransition>
          }
        />
        <Route
          path="/admin/setup"
          element={
            <PageTransition>
              <AdminSetup />
            </PageTransition>
          }
        />
        <Route
          path="/admin/panel"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <PageTransition>
                <AdminPanel />
              </PageTransition>
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <OnboardingGuard>
                <PageTransition>
                  <Dashboard role={user?.role} />
                </PageTransition>
              </OnboardingGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/communities"
          element={
            <ProtectedRoute>
              <OnboardingGuard>
                <PageTransition>
                  <Communities />
                </PageTransition>
              </OnboardingGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/communities/:id"
          element={
            <ProtectedRoute>
              <OnboardingGuard>
                <PageTransition>
                  <CommunityView role={user?.role} />
                </PageTransition>
              </OnboardingGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servers"
          element={
            <ProtectedRoute>
              <OnboardingGuard>
                <PageTransition>
                  <Servers />
                </PageTransition>
              </OnboardingGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/servers/:id"
          element={
            <ProtectedRoute>
              <OnboardingGuard>
                <PageTransition>
                  <Servers />
                </PageTransition>
              </OnboardingGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketplace"
          element={
            <ProtectedRoute>
              <OnboardingGuard>
                <PageTransition>
                  <Marketplace role={user?.role} />
                </PageTransition>
              </OnboardingGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <OnboardingGuard>
                <PageTransition>
                  <Profile />
                </PageTransition>
              </OnboardingGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:userId"
          element={
            <ProtectedRoute>
              <OnboardingGuard>
                <PageTransition>
                  <UserProfile />
                </PageTransition>
              </OnboardingGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/discover"
          element={
            <ProtectedRoute>
              <OnboardingGuard>
                <PageTransition>
                  <Discover />
                </PageTransition>
              </OnboardingGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <OnboardingGuard>
                <PageTransition>
                  <Leaderboard />
                </PageTransition>
              </OnboardingGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/profile"
          element={
            <ProtectedRoute>
              <OnboardingGuard>
                <PageTransition>
                  <ProfileSettings />
                </PageTransition>
              </OnboardingGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <OnboardingGuard>
                <PageTransition>
                  <Messages />
                </PageTransition>
              </OnboardingGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/connections"
          element={
            <ProtectedRoute>
              <OnboardingGuard>
                <PageTransition>
                  <Connections />
                </PageTransition>
              </OnboardingGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-certificates"
          element={
            <ProtectedRoute>
              <OnboardingGuard>
                <PageTransition>
                  <MyCertificates />
                </PageTransition>
              </OnboardingGuard>
            </ProtectedRoute>
          }
        />
        <Route
          path="/verify/:certificateId"
          element={
            <PageTransition>
              <VerifyCertificate />
            </PageTransition>
          }
        />
        <Route
          path="*"
          element={
            <PageTransition>
              <NotFound />
            </PageTransition>
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

AnimatedRoutes.propTypes = {
  user: PropTypes.shape({
    role: PropTypes.string,
  }),
};

function AppRoutes() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isAuthenticated } = useAuth();

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <BrowserRouter>
      <RouteProgressBar />
      <ScrollToTopBtn />
      {isAuthenticated ? (
        <div className="flex h-screen overflow-x-hidden text-gray-100" style={{backgroundColor:"#060812"}}>
          <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
          <div className="flex flex-col flex-1 relative z-10">
            <Navbar onToggleSidebar={toggleSidebar} />
            <main className="flex-1 overflow-auto px-4 py-6 md:px-8">
              <AnimatedRoutes user={user} />
            </main>
          </div>
        </div>
      ) : (
        <div className="min-h-screen text-gray-100 relative z-10" style={{backgroundColor:"#060812"}}>
          <AnimatedRoutes user={user} />
        </div>
      )}
    </BrowserRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <FollowProvider>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </FollowProvider>
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
