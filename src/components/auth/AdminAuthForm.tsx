import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, User, ArrowRight, KeyRound, Copy, CheckCircle2, ArrowLeft, ShieldCheck } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useNavigate } from "react-router-dom";

type Mode = "pin_login" | "signup" | "forgot_pin";

export default function AdminAuthForm() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("pin_login");
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [pinCopied, setPinCopied] = useState(false);

  // Forgot PIN state
  const [resetEmail, setResetEmail] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinResetSuccess, setPinResetSuccess] = useState(false);

  // OTP 2FA state
  const [otpStep, setOtpStep] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [needsPinChange, setNeedsPinChange] = useState(false);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { email: otpEmail, token: otp },
      });
      if (error) throw new Error(data?.error || "Verification failed");
      if (data?.error) throw new Error(data.error);
      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
      toast.success("Welcome back, Admin!");

      if (needsPinChange) {
        navigate("/change-pin", { replace: true });
      } else {
        navigate("/admin", { replace: true });
      }
    } catch (error: any) {
      toast.error(error.message || "Invalid or expired verification code");
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) {
      toast.error("Please enter your 4-digit PIN");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-pin-login", {
        body: { pin },
      });

      if (error) throw new Error(data?.error || "Login failed");
      if (data?.error) throw new Error(data.error);

      // PIN verified - now send OTP for 2FA
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: { shouldCreateUser: false },
      });

      if (otpError) throw otpError;

      setOtpEmail(data.email);
      setNeedsPinChange(!data.pin_changed);
      setOtpStep(true);
      toast.success("Verification code sent to your email!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const newPin = String(Math.floor(1000 + Math.random() * 9000));
    const randomPassword = crypto.randomUUID();

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password: randomPassword,
        options: {
          data: { full_name: fullName, user_type: "staff", admin_pin: newPin },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });

      if (error) throw error;
      setGeneratedPin(newPin);
      toast.success("Account created! Save your PIN below.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const { data, error } = await supabase.functions.invoke("admin-reset-pin", {
        body: { email: resetEmail, new_pin: newPin },
      });

      if (error) throw new Error(data?.error || "Reset failed");
      if (data?.error) throw new Error(data.error);

      setPinResetSuccess(true);
      toast.success("PIN updated successfully!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyPin = () => {
    if (generatedPin) {
      navigator.clipboard.writeText(generatedPin);
      setPinCopied(true);
      toast.success("PIN copied to clipboard");
      setTimeout(() => setPinCopied(false), 2000);
    }
  };

  const resetFormState = () => {
    setPin("");
    setEmail("");
    setFullName("");
    setResetEmail("");
    setNewPin("");
    setConfirmPin("");
    setPinResetSuccess(false);
    setGeneratedPin(null);
    setOtpStep(false);
    setOtp("");
    setOtpEmail("");
    setNeedsPinChange(false);
  };

  // OTP verification screen
  if (otpStep) {
    return (
      <Card className="border-0 shadow-xl">
        <CardHeader className="space-y-1 pb-4 text-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Two-Factor Verification</CardTitle>
          <CardDescription>
            A 6-digit verification code has been sent to <strong>{otpEmail}</strong>. Enter it below to complete sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerifyOtp} className="space-y-6">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Code expires in 5 minutes. Check your spam folder if you don't see it.
            </p>
            <Button type="submit" className="w-full gap-2" disabled={loading || otp.length !== 6}>
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <>
                  Verify & Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => { setOtpStep(false); setOtp(""); }}
                className="text-sm text-muted-foreground hover:text-primary hover:underline inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3 w-3" /> Back to PIN login
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  if (generatedPin) {
    return (
      <Card className="border-0 shadow-xl">
        <CardHeader className="space-y-1 pb-4 text-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Your Admin PIN</CardTitle>
          <CardDescription>Save this PIN securely. You'll use it to sign in from now on.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-6">
            <span className="text-4xl font-mono font-bold tracking-[0.5em] text-primary">{generatedPin}</span>
            <button onClick={copyPin} className="text-muted-foreground hover:text-primary transition-colors">
              {pinCopied ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
            </button>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200">
            <p className="font-semibold mb-1">⚠️ Important:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Please verify your email before signing in.</li>
              <li>Your account requires super admin approval before you can access the dashboard.</li>
              <li>You will be notified once approved.</li>
            </ul>
          </div>

          <Button className="w-full" onClick={() => { resetFormState(); setMode("pin_login"); }}>
            Go to PIN Login
          </Button>
        </CardContent>
      </Card>
    );
  }

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
          {mode === "pin_login" ? "Admin Sign In" : mode === "signup" ? "Admin Registration" : "Reset PIN"}
        </CardTitle>
        <CardDescription>
          {mode === "pin_login"
            ? "Enter your 4-digit admin PIN to sign in"
            : mode === "signup"
            ? "Register with your email to receive your admin PIN"
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
          </form>
        ) : mode === "forgot_pin" ? (
          <form onSubmit={handleResetPin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="Enter your admin email"
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
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="admin-name" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="admin-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" required />
              </div>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <>
                  Register & Get PIN
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        )}

        {mode !== "forgot_pin" && (
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">
              {mode === "pin_login" ? "Need an admin account?" : "Already have a PIN?"}
            </span>{" "}
            <button
              onClick={() => { resetFormState(); setMode(mode === "pin_login" ? "signup" : "pin_login"); }}
              className="text-primary font-medium hover:underline"
            >
              {mode === "pin_login" ? "Register" : "Sign in with PIN"}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
