import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Send, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function LostID() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [replacementLoading, setReplacementLoading] = useState<string | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [application, setApplication] = useState<any>(null);
  const [form, setForm] = useState({ date_lost: "", circumstances: "", location_lost: "" });

  const fetchData = async () => {
    if (!user) return;
    const [reportsRes, appRes] = await Promise.all([
      supabase.from("lost_reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("id_applications").select("*").eq("user_id", user.id).in("status", ["approved", "printed", "ready", "collected"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setReports(reportsRes.data || []);
    setApplication(appRes.data);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !application) return;

    setLoading(true);
    const { error } = await supabase.from("lost_reports").insert({
      user_id: user.id,
      application_id: application.id,
      date_lost: form.date_lost,
      circumstances: form.circumstances,
      location_lost: form.location_lost,
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Lost ID report submitted");
      setForm({ date_lost: "", circumstances: "", location_lost: "" });
      fetchData();
    }
    setLoading(false);
  };

  const handleRequestReplacement = async (report: any) => {
    if (!user) return;
    setReplacementLoading(report.id);

    try {
      // Update lost report status to replacement_requested
      const { error: reportError } = await supabase
        .from("lost_reports")
        .update({ status: "replacement_requested" })
        .eq("id", report.id);

      if (reportError) throw reportError;

      // Create a new replacement application copying from the original
      const { data: originalApp } = await supabase
        .from("id_applications")
        .select("*")
        .eq("id", report.application_id)
        .single();

      if (originalApp) {
        const { error: appError } = await supabase.from("id_applications").insert({
          user_id: user.id,
          status: "submitted",
          photo_url: originalApp.photo_url,
          is_replacement: true,
          submitted_at: new Date().toISOString(),
        });

        if (appError) throw appError;
      }

      toast.success("Replacement ID requested successfully. Your application will be reviewed by admin.");
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setReplacementLoading(null);
    }
  };

  const canRequestReplacement = (report: any) => {
    return report.status === "not_found";
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, string> = {
      reported: "Reported",
      searching: "Searching",
      found: "Found",
      not_found: "Not Found",
      replacement_requested: "Replacement Requested",
      replacement_issued: "Replacement Issued",
    };
    return labels[status] || status;
  };

  const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    if (status === "found" || status === "replacement_issued") return "default";
    if (status === "not_found") return "destructive";
    if (status === "replacement_requested") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Lost ID Report</h1>
        <p className="text-muted-foreground mt-1">Report a lost student ID card</p>
      </div>

      {!application ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">You need an approved ID before reporting it lost.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-sans">Report Lost ID</CardTitle>
            <CardDescription>Provide details about when and where you lost your ID</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Date Lost *</Label>
                <Input type="date" value={form.date_lost} onChange={(e) => setForm({ ...form, date_lost: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input placeholder="e.g. Library, Main Gate area..." value={form.location_lost} onChange={(e) => setForm({ ...form, location_lost: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Circumstances</Label>
                <Textarea placeholder="Describe how you lost your ID..." value={form.circumstances} onChange={(e) => setForm({ ...form, circumstances: e.target.value })} />
              </div>
              <Button type="submit" disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit Report
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-sans">Your Reports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-4 rounded-lg border gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Report from {new Date(r.date_lost).toLocaleDateString()}</p>
                  <p className="text-xs text-muted-foreground">{r.location_lost || "Location not specified"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge>
                  {canRequestReplacement(r) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={replacementLoading === r.id}
                      onClick={() => handleRequestReplacement(r)}
                    >
                      {replacementLoading === r.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      Request Replacement
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
