import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Verification() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const fetchApplications = async () => {
    const { data } = await supabase
      .from("id_applications")
      .select("*")
      .in("status", ["submitted", "verified"])
      .order("submitted_at", { ascending: true });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((a) => a.user_id))];
      const { data: profs } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const profileMap: Record<string, any> = {};
      profs?.forEach((p) => (profileMap[p.user_id] = p));
      setProfiles(profileMap);
    }
    setApplications(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchApplications(); }, []);

  const handleAction = async (appId: string, action: "approved" | "rejected") => {
    if (!user) return;
    setActionLoading(appId);

    const app = applications.find((a) => a.id === appId);
    const prof = app ? profiles[app.user_id] : null;

    const updateData: any = {
      status: action,
      admin_comment: comment || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    };
    if (action === "approved") {
      updateData.approved_at = new Date().toISOString();
      updateData.expires_at = new Date(new Date().setFullYear(new Date().getFullYear() + 4)).toISOString();
    }

    const { error } = await supabase.from("id_applications").update(updateData).eq("id", appId);

    if (error) toast.error(error.message);
    else {
      // Log audit trail
      await supabase.from("audit_logs").insert({
        action,
        admin_id: user.id,
        target_id: appId,
        target_table: "id_applications",
        details: { student_name: prof?.full_name || "Unknown", comment: comment || null },
      });

      // Send notification to student
      const notifTitle = action === "approved" ? "ID Application Approved!" : "ID Application Rejected";
      const notifMessage = action === "approved"
        ? "Your student ID application has been approved. You can now view your Virtual ID."
        : `Your student ID application has been rejected.${comment ? ` Reason: ${comment}` : ""}`;
      await supabase.from("notifications").insert({
        user_id: app.user_id,
        title: notifTitle,
        message: notifMessage,
        link: action === "approved" ? "/virtual-id" : "/application",
      });

      toast.success(`Application ${action}`);
      setComment("");
      setSelected(null);
      fetchApplications();
    }
    setActionLoading(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Verification Queue</h1>
        <p className="text-muted-foreground mt-1">{applications.length} pending applications</p>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No pending applications to review.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {applications.map((app) => {
            const prof = profiles[app.user_id];
            const isSelected = selected?.id === app.id;

            return (
              <Card key={app.id} className={isSelected ? "ring-2 ring-primary" : ""}>
                <CardContent className="p-6">
                  <div className="flex gap-6">
                    {/* Photo */}
                    <div className="h-32 w-28 rounded-lg overflow-hidden bg-muted shrink-0">
                      {app.photo_url ? (
                        <img src={app.photo_url} alt="Student" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">No Photo</div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold font-sans">{prof?.full_name || "Unknown"}</h3>
                        <Badge variant="outline">{app.status}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <div><span className="text-muted-foreground">Reg No:</span> {prof?.reg_number || "—"}</div>
                        <div><span className="text-muted-foreground">Faculty:</span> {prof?.faculty || "—"}</div>
                        <div><span className="text-muted-foreground">Course:</span> {prof?.course || "—"}</div>
                        <div><span className="text-muted-foreground">Campus:</span> {prof?.campus || "—"}</div>
                      </div>

                      {isSelected && (
                        <div className="pt-3 space-y-3">
                          <Textarea
                            placeholder="Add a comment (optional)..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleAction(app.id, "approved")}
                              disabled={!!actionLoading}
                              className="gap-2"
                            >
                              {actionLoading === app.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              Approve
                            </Button>
                            <Button
                              variant="destructive"
                              onClick={() => handleAction(app.id, "rejected")}
                              disabled={!!actionLoading}
                              className="gap-2"
                            >
                              <X className="h-4 w-4" /> Reject
                            </Button>
                            <Button variant="ghost" onClick={() => setSelected(null)}>Cancel</Button>
                          </div>
                        </div>
                      )}

                      {!isSelected && (
                        <Button variant="outline" size="sm" onClick={() => setSelected(app)} className="mt-2">
                          Review
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
