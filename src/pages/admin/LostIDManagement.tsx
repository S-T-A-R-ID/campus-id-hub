import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Eye, Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

const statusColor: Record<string, string> = {
  reported: "bg-destructive/10 text-destructive",
  searching: "bg-amber-100 text-amber-800",
  found: "bg-emerald-100 text-emerald-800",
  not_found: "bg-muted text-muted-foreground",
  replacement_requested: "bg-blue-100 text-blue-800",
  replacement_issued: "bg-primary/10 text-primary",
};

export default function LostIDManagement() {
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    const { data } = await supabase
      .from("lost_reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((r) => r.user_id))];
      const { data: profs } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const map: Record<string, any> = {};
      profs?.forEach((p) => (map[p.user_id] = p));
      setProfiles(map);
    }
    setReports(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpdate = async (reportId: string, newStatus: string) => {
    if (!user) return;
    setActionLoading(true);

    const report = reports.find((r) => r.id === reportId);
    const prof = report ? profiles[report.user_id] : null;

    const updateData: any = {
      status: newStatus,
      admin_notes: notes || null,
    };
    if (["found", "not_found", "replacement_issued"].includes(newStatus)) {
      updateData.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase.from("lost_reports").update(updateData).eq("id", reportId);
    if (error) {
      toast.error(error.message);
    } else {
      // Audit log
      await supabase.from("audit_logs").insert({
        action: `lost_${newStatus}`,
        admin_id: user.id,
        target_id: reportId,
        target_table: "lost_reports",
        details: { student_name: prof?.full_name || "Unknown", notes: notes || null },
      });

      // Notify student
      const messages: Record<string, string> = {
        searching: "Your lost ID report is being investigated.",
        found: "Great news! Your lost student ID has been found. Visit the campus office to collect it.",
        not_found: "Unfortunately, your lost student ID could not be found. You may request a replacement from your Lost ID page.",
        replacement_requested: "Your replacement ID request has been received and is being processed.",
        replacement_issued: "Your replacement student ID has been issued. You can view it in your Virtual ID page.",
      };
      if (report && messages[newStatus]) {
        await supabase.from("notifications").insert({
          user_id: report.user_id,
          title: `Lost ID: ${newStatus.replace(/_/g, " ").replace(/^\w/, (c: string) => c.toUpperCase())}`,
          message: messages[newStatus],
          link: newStatus === "replacement_issued" ? "/virtual-id" : "/lost-id",
        });
      }

      toast.success(`Report updated to ${newStatus}`);
      setSelected(null);
      setNotes("");
      fetchData();
    }
    setActionLoading(false);
  };

  const getNextStatuses = (current: string): string[] => {
    const transitions: Record<string, string[]> = {
      reported: ["searching", "found", "not_found"],
      searching: ["found", "not_found"],
      not_found: ["replacement_requested"],
      replacement_requested: ["replacement_issued"],
    };
    return transitions[current] || [];
  };

  const filtered = reports.filter((r) => {
    const prof = profiles[r.user_id];
    const q = search.toLowerCase();
    return !search || prof?.full_name?.toLowerCase().includes(q) || prof?.reg_number?.toLowerCase().includes(q);
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const selectedProfile = selected ? profiles[selected.user_id] : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Lost ID Management</h1>
        <p className="text-muted-foreground mt-1">{reports.length} total reports</p>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or reg number..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Reg Number</TableHead>
                <TableHead>Date Lost</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((report) => {
                const prof = profiles[report.user_id];
                return (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">{prof?.full_name || "—"}</TableCell>
                    <TableCell>{prof?.reg_number || "—"}</TableCell>
                    <TableCell className="text-sm">{new Date(report.date_lost).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{report.location_lost || "—"}</TableCell>
                    <TableCell><Badge className={statusColor[report.status] || ""}>{report.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setSelected(report); setNotes(""); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No lost reports found</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Lost Report Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="space-y-1.5 text-sm">
                <div><span className="text-muted-foreground">Student:</span> {selectedProfile?.full_name || "—"}</div>
                <div><span className="text-muted-foreground">Reg No:</span> {selectedProfile?.reg_number || "—"}</div>
                <div><span className="text-muted-foreground">Date Lost:</span> {new Date(selected.date_lost).toLocaleDateString()}</div>
                <div><span className="text-muted-foreground">Location:</span> {selected.location_lost || "Not specified"}</div>
                <div><span className="text-muted-foreground">Circumstances:</span> {selected.circumstances || "Not specified"}</div>
                <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColor[selected.status] || ""}>{selected.status.replace("_", " ")}</Badge></div>
              </div>

              {selected.admin_notes && (
                <div className="text-sm p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground font-medium">Admin notes:</span> {selected.admin_notes}
                </div>
              )}

              {getNextStatuses(selected.status).length > 0 && (
                <div className="space-y-3 border-t pt-4">
                  <Textarea placeholder="Add notes (optional)..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <div className="flex gap-2 flex-wrap">
                    {getNextStatuses(selected.status).map((next) => (
                      <Button
                        key={next}
                        variant="default"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleUpdate(selected.id, next)}
                        className="gap-2"
                      >
                        {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                        {next.replace("_", " ").charAt(0).toUpperCase() + next.replace("_", " ").slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
