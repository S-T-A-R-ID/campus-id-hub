import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
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

function AuthRedirect() {
  const { user, loading, isAdmin, roleLoaded } = useAuth();
  if (loading || (user && !roleLoaded)) return null;
  if (user) return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
  return <Auth />;
}

function RootRedirect() {
  const { user, loading, isAdmin, roleLoaded } = useAuth();
  if (loading || (user && !roleLoaded)) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
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
            
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
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
