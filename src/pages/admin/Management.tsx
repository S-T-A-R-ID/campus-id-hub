import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Search, Eye, Loader2 } from "lucide-react";

const statusFlow = ["submitted", "verified", "approved", "printed", "ready", "collected", "rejected"] as const;

const statusColor: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-100 text-blue-800",
  verified: "bg-cyan-100 text-cyan-800",
  approved: "bg-primary/10 text-primary",
  printed: "bg-amber-100 text-amber-800",
  ready: "bg-emerald-100 text-emerald-800",
  collected: "bg-primary/20 text-primary",
  rejected: "bg-destructive/10 text-destructive",
};

export default function Management() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [comment, setComment] = useState("");

  const fetchData = async () => {
    const { data } = await supabase
      .from("id_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((a) => a.user_id))];
      const { data: profs } = await supabase.from("profiles").select("*").in("user_id", userIds);
      const map: Record<string, any> = {};
      profs?.forEach((p) => (map[p.user_id] = p));
      setProfiles(map);
    }
    setApplications(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleStatusChange = async (appId: string, newStatus: string) => {
    if (!user) return;
    setActionLoading(true);

    const updateData: any = {
      status: newStatus,
      admin_comment: comment || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    };

    if (newStatus === "approved") updateData.approved_at = new Date().toISOString();
    if (newStatus === "printed") updateData.printed_at = new Date().toISOString();
    if (newStatus === "collected") updateData.collected_at = new Date().toISOString();
    if (newStatus === "approved") {
      updateData.expires_at = new Date(new Date().setFullYear(new Date().getFullYear() + 4)).toISOString();
    }

    const { error } = await supabase.from("id_applications").update(updateData).eq("id", appId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Status updated to ${newStatus}`);
      setSelected(null);
      setComment("");
      fetchData();
    }
    setActionLoading(false);
  };

  const getNextStatuses = (current: string): string[] => {
    const transitions: Record<string, string[]> = {
      submitted: ["verified", "rejected"],
      verified: ["approved", "rejected"],
      approved: ["printed"],
      printed: ["ready"],
      ready: ["collected"],
    };
    return transitions[current] || [];
  };

  const filtered = applications.filter((app) => {
    const prof = profiles[app.user_id];
    const q = search.toLowerCase();
    const matchesSearch =
      !search ||
      prof?.full_name?.toLowerCase().includes(q) ||
      prof?.reg_number?.toLowerCase().includes(q) ||
      app.status.includes(q);
    const matchesStatus = statusFilter === "all" || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const selectedProfile = selected ? profiles[selected.user_id] : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">ID Management</h1>
        <p className="text-muted-foreground mt-1">View and manage all student IDs</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, reg number..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statusFlow.map((s) => (
              <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Reg Number</TableHead>
                <TableHead>Faculty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((app) => {
                const prof = profiles[app.user_id];
                return (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{prof?.full_name || "—"}</TableCell>
                    <TableCell>{prof?.reg_number || "—"}</TableCell>
                    <TableCell className="text-sm">{prof?.faculty || "—"}</TableCell>
                    <TableCell>
                      <Badge className={statusColor[app.status] || ""}>{app.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setSelected(app); setComment(""); }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No applications found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="h-28 w-24 rounded-lg overflow-hidden bg-muted shrink-0">
                  {selected.photo_url ? (
                    <img src={selected.photo_url} alt="Student" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">No Photo</div>
                  )}
                </div>
                <div className="space-y-1.5 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> {selectedProfile?.full_name || "—"}</div>
                  <div><span className="text-muted-foreground">Reg No:</span> {selectedProfile?.reg_number || "—"}</div>
                  <div><span className="text-muted-foreground">Faculty:</span> {selectedProfile?.faculty || "—"}</div>
                  <div><span className="text-muted-foreground">Course:</span> {selectedProfile?.course || "—"}</div>
                  <div><span className="text-muted-foreground">Campus:</span> {selectedProfile?.campus || "—"}</div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge className={statusColor[selected.status] || ""}>{selected.status}</Badge></div>
                </div>
              </div>

              {selected.admin_comment && (
                <div className="text-sm p-3 rounded-lg bg-muted">
                  <span className="text-muted-foreground font-medium">Admin comment:</span> {selected.admin_comment}
                </div>
              )}

              {getNextStatuses(selected.status).length > 0 && (
                <div className="space-y-3 border-t pt-4">
                  <Textarea
                    placeholder="Add a comment (optional)..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <div className="flex gap-2 flex-wrap">
                    {getNextStatuses(selected.status).map((next) => (
                      <Button
                        key={next}
                        variant={next === "rejected" ? "destructive" : "default"}
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => handleStatusChange(selected.id, next)}
                        className="gap-2"
                      >
                        {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                        Mark as {next.charAt(0).toUpperCase() + next.slice(1)}
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
