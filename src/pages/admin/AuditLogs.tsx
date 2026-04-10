import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { Activity } from "lucide-react";

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setLogs(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  const actionColors: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-destructive/10 text-destructive",
    verified: "bg-cyan-100 text-cyan-800",
    printed: "bg-amber-100 text-amber-800",
    collected: "bg-primary/10 text-primary",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground mt-1">Activity trail of all admin actions</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[600px]">
            {logs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">No audit logs yet</div>
            ) : (
              <div className="divide-y">
                {logs.map((log) => {
                  const details = log.details as Record<string, any> | null;
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-6 py-4">
                      <div className="rounded-full bg-muted p-2 mt-0.5">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={actionColors[log.action] || "bg-muted text-muted-foreground"}>
                            {log.action}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            on {log.target_table}
                          </span>
                        </div>
                        {details?.student_name && (
                          <p className="text-sm mt-1">Student: {details.student_name}</p>
                        )}
                        {details?.comment && (
                          <p className="text-xs text-muted-foreground mt-0.5">"{details.comment}"</p>
                        )}
                        <p className="text-xs text-muted-foreground/60 mt-1">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
