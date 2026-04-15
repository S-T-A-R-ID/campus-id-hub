import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CreditCard, FileText, AlertTriangle, Clock, CheckCircle2, ArrowRight, MailWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-800" },
  verified: { label: "Verified", color: "bg-cyan-100 text-cyan-800" },
  approved: { label: "Approved", color: "bg-primary/10 text-primary" },
  printed: { label: "Printed", color: "bg-amber-100 text-amber-800" },
  ready: { label: "Ready for Collection", color: "bg-emerald-100 text-emerald-800" },
  collected: { label: "Collected", color: "bg-primary/20 text-primary" },
  rejected: { label: "Rejected", color: "bg-destructive/10 text-destructive" },
};

export default function Dashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [application, setApplication] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [lostCount, setLostCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [appRes, notifRes, lostRes] = await Promise.all([
        supabase
          .from("id_applications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("notifications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("lost_reports")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .in("status", ["reported", "searching"]),
      ]);
      setApplication(appRes.data);
      setNotifications(notifRes.data || []);
      setLostCount(lostRes.count || 0);
      setLoading(false);
    };
    fetchData();

    // Realtime subscription
    const channel = supabase
      .channel("dashboard-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "id_applications", filter: `user_id=eq.${user.id}` }, () => fetchData())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const status = application ? statusLabels[application.status] : null;
  const profileComplete = profile?.reg_number && profile?.faculty && profile?.course;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your student ID status</p>
      </div>

      {/* Email Verification Status */}
      {user && !user.email_confirmed_at && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-xl bg-amber-100 dark:bg-amber-900/40 p-3">
              <MailWarning className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-amber-800 dark:text-amber-200">Email Not Verified</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">Please check your inbox and verify your email address to access all features.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {user && user.email_confirmed_at && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Email verified: {user.email}</p>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-xl bg-primary/10 p-3">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ID Status</p>
              {status ? (
                <Badge className={status.color}>{status.label}</Badge>
              ) : (
                <p className="font-semibold">No Application</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-xl bg-accent/20 p-3">
              <FileText className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Profile</p>
              <p className="font-semibold">{profileComplete ? "Complete" : "Incomplete"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-xl bg-destructive/10 p-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lost Reports</p>
              <p className="font-semibold">{lostCount} active</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {!application && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-2 font-sans">Apply for Student ID</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {profileComplete
                  ? "Your profile is complete. Start your ID application now."
                  : "Complete your profile and upload a passport photo to apply."}
              </p>
              <Button onClick={() => navigate("/application")} className="gap-2">
                Start Application <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {application?.status === "approved" && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <h3 className="font-semibold text-lg mb-2 font-sans">Your Virtual ID is Ready!</h3>
              <p className="text-sm text-muted-foreground mb-4">Your ID has been approved. View and download your virtual ID card.</p>
              <Button onClick={() => navigate("/virtual-id")} className="gap-2">
                View Virtual ID <CreditCard className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {application && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-sans">Application Status Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusPipeline currentStatus={application.status} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Notifications */}
      {notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-sans">Recent Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusPipeline({ currentStatus }: { currentStatus: string }) {
  const steps = ["submitted", "verified", "approved", "printed", "ready"];
  const currentIndex = steps.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1 flex-1">
          <div className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold shrink-0 ${
            i <= currentIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}>
            {i <= currentIndex ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 ${i < currentIndex ? "bg-primary" : "bg-muted"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
