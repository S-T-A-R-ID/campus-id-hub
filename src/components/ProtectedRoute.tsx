import { useAuth } from "@/lib/auth";
import { getPortalMode } from "@/lib/portalMode";
import { Navigate } from "react-router-dom";
import AdminPendingApproval from "@/pages/AdminPendingApproval";

export function ProtectedRoute({
  children,
  adminOnly = false,
  superAdminOnly = false,
  studentOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
  studentOnly?: boolean;
}) {
  const { user, loading, isAdmin, isSuperAdmin, isAdminApproved, pinChanged, roleLoaded } = useAuth();
  const portalMode = getPortalMode();

  if (loading || (user && !roleLoaded)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    if (adminOnly || superAdminOnly) return <Navigate to="/auth?portal=admin" replace />;
    if (studentOnly) return <Navigate to="/auth?portal=student" replace />;
    return <Navigate to="/auth" replace />;
  }

  if (studentOnly && portalMode !== "student") {
    return <Navigate to="/auth?portal=student" replace />;
  }

  if ((adminOnly || superAdminOnly) && portalMode !== "admin") {
    return <Navigate to="/auth?portal=admin" replace />;
  }

  // Show pending approval screen for unapproved admins
  if (isAdmin && !isSuperAdmin && !isAdminApproved && (adminOnly || superAdminOnly)) {
    return <AdminPendingApproval />;
  }

  if (superAdminOnly && !isSuperAdmin) return <Navigate to="/admin" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
