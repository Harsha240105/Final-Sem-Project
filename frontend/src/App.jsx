import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./shared/components/AuthContext";
import { SocketProvider } from "./shared/services/SocketContext";
import { FollowProvider } from "./shared/components/FollowContext";
import ErrorBoundary from "./shared/components/ErrorBoundary";
import ProtectedRoute from "./features/auth/ProtectedRoute";
import OnboardingGuard from "./features/auth/OnboardingGuard";
import MainLayout from "./shared/layouts/MainLayout";
import { CardSkeleton, ProfileSkeleton, MessageSkeleton, MarketplaceSkeleton } from "./shared/components/LoadingSkeleton";

const Login = lazy(() => import("./features/auth/Login"));
const ConnectWallet = lazy(() => import("./features/auth/ConnectWallet"));
const VerificationPage = lazy(() => import("./features/auth/VerificationPage"));
const OrganisationSetup = lazy(() => import("./features/auth/OrganisationSetup"));
const AdminSetup = lazy(() => import("./features/auth/AdminSetup"));
const AdminPanel = lazy(() => import("./features/admin/AdminPanel"));
const Dashboard = lazy(() => import("./features/dashboard/Dashboard"));
const Communities = lazy(() => import("./features/communities/Communities"));
const CommunityView = lazy(() => import("./features/communities/CommunityView"));
const CollaborationHub = lazy(() => import("./features/collaboration/pages/CollaborationHub"));
const Marketplace = lazy(() => import("./features/marketplace/Marketplace"));
const Profile = lazy(() => import("./features/profiles/Profile"));
const UserProfile = lazy(() => import("./features/profiles/UserProfile"));
const Discover = lazy(() => import("./features/profiles/Discover"));
const Connections = lazy(() => import("./features/profiles/Connections"));
const ProfileSettings = lazy(() => import("./features/profiles/ProfileSettings"));
const Messages = lazy(() => import("./features/messaging/Messages"));
const MyCertificates = lazy(() => import("./features/certificates/MyCertificates"));
const VerifyCertificate = lazy(() => import("./features/certificates/VerifyCertificate"));
const NotFound = lazy(() => import("./features/NotFound"));

function PageFallback({ children }) {
  return (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: "#060812" }}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
    </div>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Suspense fallback={<PageFallback />}><Login /></Suspense>} />
        <Route path="/connect-wallet" element={<Suspense fallback={<PageFallback />}><ConnectWallet /></Suspense>} />
        <Route path="/verify-student" element={<Suspense fallback={<PageFallback />}><VerificationPage /></Suspense>} />
        <Route path="/verify-teacher" element={<Suspense fallback={<PageFallback />}><VerificationPage /></Suspense>} />
        <Route path="/verify-admin" element={<Suspense fallback={<PageFallback />}><VerificationPage /></Suspense>} />
        <Route path="/org-setup" element={<Suspense fallback={<PageFallback />}><OrganisationSetup /></Suspense>} />
        <Route path="/admin/setup" element={<Suspense fallback={<PageFallback />}><AdminSetup /></Suspense>} />
        <Route path="/verify/:certificateId" element={<Suspense fallback={<PageFallback />}><VerifyCertificate /></Suspense>} />

        {/* Admin route */}
        <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
          <Route path="/admin/panel" element={
            <MainLayout>
              <Suspense fallback={<CardSkeleton count={4} />}><AdminPanel /></Suspense>
            </MainLayout>
          } />
        </Route>

        {/* Protected routes with onboarding guard */}
        <Route element={<ProtectedRoute />}>
          <Route element={<OnboardingGuard />}>
            <Route path="/" element={
              <MainLayout>
                <Suspense fallback={<CardSkeleton count={4} />}><Dashboard /></Suspense>
              </MainLayout>
            } />
            <Route path="/communities" element={
              <MainLayout>
                <Suspense fallback={<CardSkeleton count={6} />}><Communities /></Suspense>
              </MainLayout>
            } />
            <Route path="/communities/:id" element={
              <MainLayout>
                <Suspense fallback={<CardSkeleton count={3} />}><CommunityView /></Suspense>
              </MainLayout>
            } />
            <Route path="/marketplace" element={
              <MainLayout>
                <Suspense fallback={<MarketplaceSkeleton />}><Marketplace /></Suspense>
              </MainLayout>
            } />
            <Route path="/collaboration" element={
              <MainLayout>
                <Suspense fallback={<CardSkeleton count={4} />}><CollaborationHub /></Suspense>
              </MainLayout>
            } />
            <Route path="/collaboration/:canvasId" element={
              <MainLayout>
                <Suspense fallback={<CardSkeleton count={4} />}><CollaborationHub /></Suspense>
              </MainLayout>
            } />
            <Route path="/profile" element={
              <MainLayout>
                <Suspense fallback={<ProfileSkeleton />}><Profile /></Suspense>
              </MainLayout>
            } />
            <Route path="/profile/:userId" element={
              <MainLayout>
                <Suspense fallback={<ProfileSkeleton />}><UserProfile /></Suspense>
              </MainLayout>
            } />
            <Route path="/discover" element={
              <MainLayout>
                <Suspense fallback={<CardSkeleton count={4} />}><Discover /></Suspense>
              </MainLayout>
            } />
            <Route path="/connections" element={
              <MainLayout>
                <Suspense fallback={<CardSkeleton count={3} />}><Connections /></Suspense>
              </MainLayout>
            } />
            <Route path="/settings/profile" element={
              <MainLayout>
                <Suspense fallback={<ProfileSkeleton />}><ProfileSettings /></Suspense>
              </MainLayout>
            } />
            <Route path="/messages" element={
              <MainLayout>
                <Suspense fallback={<MessageSkeleton />}><Messages /></Suspense>
              </MainLayout>
            } />
            <Route path="/messages/:userId" element={
              <MainLayout>
                <Suspense fallback={<MessageSkeleton />}><Messages /></Suspense>
              </MainLayout>
            } />
            <Route path="/my-certificates" element={
              <MainLayout>
                <Suspense fallback={<CardSkeleton count={4} />}><MyCertificates /></Suspense>
              </MainLayout>
            } />
          </Route>
        </Route>

        <Route path="*" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <FollowProvider>
            <AppRoutes />
          </FollowProvider>
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
