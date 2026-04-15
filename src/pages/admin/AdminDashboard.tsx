import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckSquare, AlertTriangle, Clock, Activity } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, lost: 0 });
  const [statusData, setStatusData] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      const [totalRes, pendingRes, approvedRes, lostRes, allApps, logsRes] = await Promise.all([
        supabase.from("id_applications").select("id", { count: "exact", head: true }),
        supabase.from("id_applications").select("id", { count: "exact", head: true }).in("status", ["submitted", "verified"]),
        supabase.from("id_applications").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("lost_reports").select("id", { count: "exact", head: true }).eq("status", "reported"),
        supabase.from("id_applications").select("status"),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(5),
      ]);

      setStats({
        total: totalRes.count || 0,
        pending: pendingRes.count || 0,
        approved: approvedRes.count || 0,
        lost: lostRes.count || 0,
      });

      // Build status distribution
      const counts: Record<string, number> = {};
      allApps.data?.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });
      setStatusData(Object.entries(counts).map(([name, value]) => ({ name, value })));
      setRecentLogs(logsRes.data || []);
    };
    fetchAll();
  }, []);

  const cards = [
    { label: "Total Applications", value: stats.total, icon: Users, color: "bg-primary/10 text-primary" },
    { label: "Pending Review", value: stats.pending, icon: Clock, color: "bg-amber-100 text-amber-700" },
    { label: "Approved IDs", value: stats.approved, icon: CheckSquare, color: "bg-emerald-100 text-emerald-700" },
    { label: "Lost Reports", value: stats.lost, icon: AlertTriangle, color: "bg-destructive/10 text-destructive" },
  ];

  const COLORS = ["hsl(152,100%,26%)", "hsl(45,100%,51%)", "hsl(200,80%,50%)", "hsl(0,84%,60%)", "hsl(280,60%,50%)", "hsl(152,40%,40%)", "hsl(30,80%,50%)", "hsl(180,60%,40%)"];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">System overview and statistics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="flex items-center gap-4 p-6">
              <div className={`rounded-xl p-3 ${c.color}`}>
                <c.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-3xl font-bold">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Status Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-sans">Application Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-sans">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              recentLogs.map((log) => {
                const details = log.details as Record<string, any> | null;
                return (
                  <div key={log.id} className="flex items-start gap-3">
                    <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm">
                        <Badge variant="outline" className="mr-1">{log.action}</Badge>
                        {details?.student_name || log.target_table}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}