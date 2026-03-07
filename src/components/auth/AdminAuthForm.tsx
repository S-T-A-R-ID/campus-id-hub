import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, User, ArrowRight, KeyRound, Copy, CheckCircle2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useNavigate } from "react-router-dom";



export default function AdminAuthForm() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"pin_login" | "signup">("pin_login");
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);
  const [pinCopied, setPinCopied] = useState(false);

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

      const { error: otpError } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: "magiclink",
      });

      if (otpError) throw otpError;
      toast.success("Welcome back, Admin!");
      navigate("/admin", { replace: true });
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
    // Generate a random password since Supabase requires one, but admins use PIN login
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

  const copyPin = () => {
    if (generatedPin) {
      navigator.clipboard.writeText(generatedPin);
      setPinCopied(true);
      toast.success("PIN copied to clipboard");
      setTimeout(() => setPinCopied(false), 2000);
    }
  };

  if (generatedPin) {
    return (
      <Card className="border-0 shadow-xl">
        <CardHeader className="space-y-1 pb-4 text-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Your Admin PIN</CardTitle>
          <CardDescription>
            Save this PIN securely. You'll use it to sign in from now on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 p-6">
            <span className="text-4xl font-mono font-bold tracking-[0.5em] text-primary">
              {generatedPin}
            </span>
            <button onClick={copyPin} className="text-muted-foreground hover:text-primary transition-colors">
              {pinCopied ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
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

          <Button
            className="w-full"
            onClick={() => {
              setGeneratedPin(null);
              setMode("pin_login");
              setEmail("");
              setFullName("");
            }}
          >
            Go to PIN Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-xl">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl">
          {mode === "pin_login" ? "Admin Sign In" : "Admin Registration"}
        </CardTitle>
        <CardDescription>
          {mode === "pin_login"
            ? "Enter your 4-digit admin PIN to sign in"
            : "Register with your email to receive your admin PIN"}
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
          </form>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin-name"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
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

        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">
            {mode === "pin_login" ? "Need an admin account?" : "Already have a PIN?"}
          </span>{" "}
          <button
            onClick={() => setMode(mode === "pin_login" ? "signup" : "pin_login")}
            className="text-primary font-medium hover:underline"
          >
            {mode === "pin_login" ? "Register" : "Sign in with PIN"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
