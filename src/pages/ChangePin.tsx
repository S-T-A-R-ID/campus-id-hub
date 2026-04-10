import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { KeyRound, ArrowRight, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ChangePin() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 4) {
      toast.error("Please enter a 4-digit PIN");
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      toast.error("PIN must contain only digits");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("PINs do not match");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-reset-pin", {
        body: { email: user?.email, new_pin: newPin, mark_changed: true },
      });

      if (error) throw new Error(data?.error || "Failed to change PIN");
      if (data?.error) throw new Error(data.error);

      toast.success("PIN changed successfully! Please sign in again.");
      await signOut();
      navigate("/auth", { replace: true });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="space-y-1 pb-4 text-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <ShieldCheck className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-2xl">Change Your PIN</CardTitle>
          <CardDescription>
            For security, you must change your PIN before accessing the admin dashboard. Choose a memorable 4-digit PIN.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePin} className="space-y-6">
            <div className="space-y-3">
              <Label className="text-center block">New PIN</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={4} value={newPin} onChange={setNewPin}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-center block">Confirm New PIN</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={4} value={confirmPin} onChange={setConfirmPin}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading || newPin.length !== 4 || confirmPin.length !== 4}
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <>
                  Change PIN & Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
