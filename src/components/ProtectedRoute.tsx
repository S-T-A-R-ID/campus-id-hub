import { useAuth } from "@/lib/auth";
import { Navigate } from "react-router-dom";

export function ProtectedRoute({
  children,
  adminOnly = false,
  superAdminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}) {
  const { user, loading, isAdmin, isSuperAdmin, roleLoaded } = useAuth();

  if (loading || (user && !roleLoaded)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (superAdminOnly && !isSuperAdmin) return <Navigate to="/admin" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
