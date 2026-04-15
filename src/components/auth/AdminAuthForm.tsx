import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, ArrowRight, CheckCircle2, ArrowLeft } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useNavigate } from "react-router-dom";
import { frontendEnv } from "@/config/env";

type Mode = "pin_login" | "forgot_pin";

const hasPlaceholderAnonKey = (frontendEnv.supabasePublishableKey || "")
  .toString()
  .includes("PASTE_ANON_PUBLIC_KEY");

export default function AdminAuthForm() {
  const PORTAL_MODE_KEY = "star_id_portal_mode";
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("pin_login");
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState("");

  // Forgot PIN state
  const [resetEmail, setResetEmail] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinResetSuccess, setPinResetSuccess] = useState(false);

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasPlaceholderAnonKey) {
      toast.error("Supabase anon key is not set in .env. Replace VITE_SUPABASE_PUBLISHABLE_KEY and restart dev server.");
      return;
    }
    if (pin.length !== 4) {
      toast.error("Please enter your 4-digit PIN");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_pin_login_rpc", {
        p_pin: pin,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : null;
      if (!row?.email) {
        throw new Error("Admin PIN login is not configured. Run the SQL setup for admin RPC functions.");
      }

      // Direct admin sign-in: password is synchronized with 4-digit PIN.
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: row.email,
        password: pin,
      });
      if (signInError) {
        throw new Error("PIN verified, but password sign-in failed. Run the SQL sync script to align admin PIN and auth password.");
      }

      if (!signInData.user?.email_confirmed_at) {
        await supabase.auth.signOut();
        throw new Error("Please verify your admin email before signing in.");
      }

      localStorage.setItem(PORTAL_MODE_KEY, "admin");
      toast.success("Welcome back, Admin!");
      navigate("/admin", { replace: true });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasPlaceholderAnonKey) {
      toast.error("Supabase anon key is not set in .env. Replace VITE_SUPABASE_PUBLISHABLE_KEY and restart dev server.");
      return;
    }
    if (newPin.length !== 4) {
      toast.error("Please enter a 4-digit PIN");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("PINs do not match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("admin_reset_pin_rpc", {
        p_email: resetEmail,
        p_new_pin: newPin,
        p_mark_changed: true,
      });
      if (error) throw error;

      setPinResetSuccess(true);
      toast.success("PIN updated successfully!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetFormState = () => {
    setPin("");
    setResetEmail("");
    setNewPin("");
    setConfirmPin("");
    setPinResetSuccess(false);
    setNeedsPinChange(false);
  };

  if (pinResetSuccess) {
    return (
      <Card className="border-0 shadow-xl">
        <CardHeader className="space-y-1 pb-4 text-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl">PIN Updated</CardTitle>
          <CardDescription>Your admin PIN has been successfully changed.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => { resetFormState(); setMode("pin_login"); }}>
            Sign In with New PIN
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl">
          {mode === "pin_login" ? "Admin Sign In" : "Reset PIN"}
        </CardTitle>
        <CardDescription>
          {mode === "pin_login"
            ? "Enter the 4-digit PIN assigned by the super admin. You will be asked to change it on first sign in."
            : "Enter your email and choose a new 4-digit PIN"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mode === "pin_login" ? (
          <form onSubmit={handlePinLogin} className="space-y-6">
            <div className="space-y-3">
              <Label className="text-center block">Admin PIN</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={4} value={pin} onChange={setPin}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading || pin.length !== 4}>
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <>
                  Sign In with PIN
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => { resetFormState(); setMode("forgot_pin"); }}
                className="text-sm text-muted-foreground hover:text-primary hover:underline"
              >
                Forgot your PIN?
              </button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              New admin accounts are provisioned by super admin in Supabase.
            </p>
          </form>
        ) : (
          <form onSubmit={handleResetPin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="admin@starid.ac.ke"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
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
            <Button type="submit" className="w-full gap-2" disabled={loading || newPin.length !== 4 || confirmPin.length !== 4}>
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <>
                  Reset PIN
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => { resetFormState(); setMode("pin_login"); }}
                className="text-sm text-muted-foreground hover:text-primary hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Back to PIN Login
              </button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
