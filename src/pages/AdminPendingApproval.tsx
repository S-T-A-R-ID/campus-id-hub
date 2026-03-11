import { useAuth } from "@/lib/auth";
import { Clock, Shield, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AdminPendingApproval() {
  const { signOut, user } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl">Pending Approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg bg-muted p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Signed in as:</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                Status: Pending Verification
              </span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            Your admin account has been created, but it requires approval from the Super Admin before you can access the dashboard. You will be notified once your account is approved.
          </p>

          <Button variant="outline" className="w-full gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
