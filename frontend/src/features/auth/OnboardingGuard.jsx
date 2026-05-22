import { Navigate, Outlet } from "react-router-dom";
import PropTypes from "prop-types";
import { useAuth } from "../../shared/hooks/useAuth";

function OnboardingGuard({ children }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: "#060812" }}>
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const role = user?.role || "student";
  const completed = user?.onboardingCompleted === true;

  if (role === "admin" && !completed) {
    return <Navigate to="/org-setup" replace />;
  }

  const supportedVerificationRoles = ["student", "teacher", "admin"];
  if (!completed) {
    const verifyPath = supportedVerificationRoles.includes(role)
      ? `/verify-${role}`
      : "/verify-student";
    return <Navigate to={verifyPath} replace />;
  }

  return children || <Outlet />;
}

OnboardingGuard.propTypes = {
  children: PropTypes.node,
};

export default OnboardingGuard;
