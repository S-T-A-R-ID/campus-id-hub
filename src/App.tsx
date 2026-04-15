import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPortalMode, type PortalMode } from "@/lib/portalMode";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Application from "./pages/Application";
import VirtualID from "./pages/VirtualID";
import LostID from "./pages/LostID";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Verification from "./pages/admin/Verification";
import Management from "./pages/admin/Management";
import AuditLogs from "./pages/admin/AuditLogs";
import LostIDManagement from "./pages/admin/LostIDManagement";
import AdminApproval from "./pages/admin/AdminApproval";
import Verify from "./pages/Verify";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function getLandingPath(isAdmin: boolean, portalMode: PortalMode | null) {
  if (isAdmin && portalMode === "admin") return "/admin";
  return "/dashboard";
}

function FullScreenLoader({ label }: { label: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function AuthRedirect() {
  const { user, loading, emailVerified, isAdmin, roleLoaded } = useAuth();
  const [searchParams] = useSearchParams();
  const portalMode = getPortalMode();
  const requestedPortal = searchParams.get("portal") === "admin"
    ? "admin"
    : searchParams.get("portal") === "student"
      ? "student"
      : null;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_IN") {
        // Check if this is from email verification by looking at URL hash
        const hash = window.location.hash;
        if (hash && (hash.includes("type=signup") || hash.includes("type=email"))) {
          // User clicked email verification link - they are now verified and logged in
          toast.success("Email verified! You're now logged in.");
          // Clear the hash to clean up the URL
          window.location.hash = "";
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <FullScreenLoader label="Loading..." />;
  if (user && !roleLoaded) return <FullScreenLoader label="Checking access..." />;
  if (user && !emailVerified) return <Auth />;
  if (user) {
    if (requestedPortal === "admin") {
      if (portalMode === "admin" && isAdmin) return <Navigate to="/admin" replace />;
      return <Auth />;
    }
    if (requestedPortal === "student") return <Navigate to="/dashboard" replace />;
    return <Navigate to={getLandingPath(isAdmin, portalMode)} replace />;
  }
  return <Auth />;
}

function RootRedirect() {
  const { user, loading, emailVerified, isAdmin, roleLoaded } = useAuth();
  const portalMode = getPortalMode();
  if (loading) return <FullScreenLoader label="Loading..." />;
  if (user && !roleLoaded) return <FullScreenLoader label="Checking access..." />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!emailVerified) return <Navigate to="/auth?verification=required" replace />;
  return <Navigate to={getLandingPath(isAdmin, portalMode)} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/auth" element={<AuthRedirect />} />
            <Route path="/verify/:id" element={<Verify />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            <Route element={<ProtectedRoute studentOnly><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/application" element={<Application />} />
              <Route path="/virtual-id" element={<VirtualID />} />
              <Route path="/lost-id" element={<LostID />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            <Route element={<ProtectedRoute adminOnly><AppLayout /></ProtectedRoute>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/verification" element={<Verification />} />
              <Route path="/admin/management" element={<Management />} />
              <Route path="/admin/audit" element={<AuditLogs />} />
              <Route path="/admin/lost-ids" element={<LostIDManagement />} />
            </Route>

            <Route element={<ProtectedRoute superAdminOnly><AppLayout /></ProtectedRoute>}>
              <Route path="/admin/manage-admins" element={<AdminApproval />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
