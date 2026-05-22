import { Navigate } from "react-router-dom";
import PropTypes from "prop-types";
import { useAuth } from "../hooks/useAuth";

function OnboardingGuard({ children }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-purple-500/30 border-t-purple-500" />
          <p className="text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const role = user?.role || "student";
  const completed = user?.onboardingCompleted === true;

  // Admin must complete organisation setup before accessing dashboard
  if (role === "admin" && !completed) {
    return <Navigate to="/org-setup" replace />;
  }

  // Student/teacher must complete verification
  const supportedVerificationRoles = ["student", "teacher", "admin"];
  if (!completed) {
    const verifyPath = supportedVerificationRoles.includes(role)
      ? `/verify-${role}`
      : "/verify-student";
    return <Navigate to={verifyPath} replace />;
  }

  return children;
}

OnboardingGuard.propTypes = {
  children: PropTypes.node.isRequired,
};

export default OnboardingGuard;
