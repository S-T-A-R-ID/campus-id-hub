import { useAuth } from "@/lib/auth";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, CreditCard, FileText, AlertTriangle,
  Users, CheckSquare, LogOut, GraduationCap, Shield, X, UserCog
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

const studentLinks = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/application", label: "Apply for ID", icon: FileText },
  { to: "/virtual-id", label: "Virtual ID", icon: CreditCard },
  { to: "/lost-id", label: "Lost ID", icon: AlertTriangle },
  { to: "/profile", label: "Profile Settings", icon: Users },
];

const adminLinks = [
  { to: "/admin", label: "Admin Dashboard", icon: Shield },
  { to: "/admin/verification", label: "Verification", icon: CheckSquare },
  { to: "/admin/management", label: "ID Management", icon: Users },
  { to: "/admin/lost-ids", label: "Lost ID Reports", icon: AlertTriangle },
  { to: "/admin/audit", label: "Audit Logs", icon: FileText },
];

const superAdminLinks = [
  { to: "/admin/manage-admins", label: "Manage Admins", icon: UserCog },
];

export default function AppSidebar({ onClose }: { onClose?: () => void }) {
  const { user, isAdmin, isSuperAdmin, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isAdminRoute = location.pathname.startsWith("/admin");

  const links = isAdminRoute && isAdmin
    ? [...adminLinks, ...(isSuperAdmin ? superAdminLinks : [])]
    : studentLinks;
  const sectionLabel = isAdminRoute ? (isSuperAdmin ? "Super Admin" : "Admin") : "Student";
  const sidebarNameFallback = isAdminRoute ? (isSuperAdmin ? "Super Admin" : "Admin") : "Student";

  const handleNav = (to: string) => {
    navigate(to);
    onClose?.();
  };

  return (
    <aside className="flex h-screen w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="flex items-center justify-between p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-8 w-8 text-sidebar-primary" />
          <div>
            <div className="font-bold text-sm">S.T.A.R_ID</div>
            <div className="text-xs text-sidebar-foreground/60">Student ID System</div>
          </div>
        </div>
        {isMobile && (
          <button onClick={onClose} className="text-sidebar-foreground/60 hover:text-sidebar-foreground">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider mb-3 px-3">
          {sectionLabel}
        </div>
        {links.map((link) => (
          <button
            key={link.to}
            onClick={() => handleNav(link.to)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              location.pathname === link.to
                ? "bg-sidebar-accent text-sidebar-primary font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            )}
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </button>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="h-9 w-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-primary font-bold text-sm">
            {profile?.full_name?.charAt(0) || user?.email?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{profile?.full_name || sidebarNameFallback}</div>
            <div className="text-xs text-sidebar-foreground/50 truncate">{user?.email}</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
