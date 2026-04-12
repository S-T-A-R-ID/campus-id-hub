import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import NotificationsDropdown from "./NotificationsDropdown";

export default function AppLayout() {
  const { profile, isAdmin, isSuperAdmin } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdminRoute = location.pathname.startsWith("/admin");

  const fallbackName = isAdminRoute
    ? (isSuperAdmin ? "Super Admin" : isAdmin ? "Admin" : "Admin")
    : "Student";

  return (
    <div className="flex h-screen overflow-hidden">
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setSidebarOpen(false)} />
      )}

      <div className={isMobile ? `fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}` : ""}>
        <AppSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b px-4 sm:px-6 bg-card">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <h2 className="text-base sm:text-lg font-semibold font-sans truncate">
              Welcome, {profile?.full_name || fallbackName}
            </h2>
          </div>
          <NotificationsDropdown />
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}