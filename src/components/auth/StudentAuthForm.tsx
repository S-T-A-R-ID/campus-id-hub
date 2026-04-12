import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, ArrowLeft, Hash } from "lucide-react";
import PasswordStrengthIndicator from "./PasswordStrengthIndicator";
import { validateStudentName, validateRegNumber, generateStudentEmail } from "@/lib/validators";

export default function StudentAuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Registration fields
  const [fullName, setFullName] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Derived email from name + reg number
  const generatedEmail = useMemo(() => {
    if (!fullName || !regNumber) return "";
    const result = generateStudentEmail(fullName, regNumber);
    return result.email || "";
  }, [fullName, regNumber]);

  // Client-side validation states
  const nameValidation = useMemo(() => validateStudentName(fullName), [fullName]);
  const regValidation = useMemo(() => validateRegNumber(regNumber), [regNumber]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.endsWith("@student.egerton.ac.ke")) {
      toast.error("Please use your @student.egerton.ac.ke email address");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link sent! Check your email.");
      setIsForgotPassword(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.endsWith("@student.egerton.ac.ke")) {
      toast.error("Please use your @student.egerton.ac.ke email address");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success("Welcome back!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    if (!nameValidation.valid) {
      toast.error(nameValidation.error);
      return;
    }
    if (!regValidation.valid) {
      toast.error(regValidation.error);
      return;
    }
    if (!generatedEmail) {
      toast.error("Unable to generate email. Check your name and registration number.");
      return;
    }
    if (regPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      // Server-side validation
      const { data: valData, error: valError } = await supabase.functions.invoke("validate-registration", {
        body: { full_name: fullName, reg_number: regNumber },
      });

      if (valError) throw new Error(valData?.error || "Validation failed");
      if (valData?.error) throw new Error(valData.error);

      // Register with the generated email
      const { error } = await supabase.auth.signUp({
        email: generatedEmail,
        password: regPassword,
        options: {
          data: {
            full_name: valData.normalized_name,
            user_type: "student",
            reg_number: regNumber.trim().toUpperCase(),
          },
          emailRedirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) throw error;
      toast.success("Account created! Check your email to verify your account.");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Forgot password screen
  if (isForgotPassword) {
    return (
      <Card className="border-0 shadow-xl">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>Enter your university email and we'll send you a reset link</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">University Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="lastname.digits@student.egerton.ac.ke"
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
                <>Send Reset Link<ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <button onClick={() => setIsForgotPassword(false)} className="text-primary font-medium hover:underline inline-flex items-center gap-1 text-sm">
              <ArrowLeft className="h-3 w-3" /> Back to Sign In
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Login form
  if (isLogin) {
    return (
      <Card className="border-0 shadow-xl">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Sign in with your university email</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student-email">University Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="student-email"
                  type="email"
                  placeholder="lastname.digits@student.egerton.ac.ke"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="student-password">Password</Label>
                <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="student-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  minLength={6}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <>Sign In<ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">Don't have an account?</span>{" "}
            <button onClick={() => setIsLogin(false)} className="text-primary font-medium hover:underline">Sign up</button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Registration form
  return (
    <Card className="border-0 shadow-xl">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-2xl">Create Account</CardTitle>
        <CardDescription>Register with your full name and registration number</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reg-name">Full Name *</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="reg-name"
                placeholder="e.g., Hashim Baya Nassoro"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            {fullName && !nameValidation.valid && (
              <p className="text-xs text-destructive">{nameValidation.error}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-number">Registration Number *</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="reg-number"
                placeholder="e.g., S13/02928/23"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            {regNumber && !regValidation.valid && (
              <p className="text-xs text-destructive">{regValidation.error}</p>
            )}
          </div>

          {/* Auto-generated email display */}
          {generatedEmail && (
            <div className="space-y-2">
              <Label>Generated Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={generatedEmail}
                  readOnly
                  disabled
                  className="pl-10 bg-muted font-mono text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">This email is automatically generated and cannot be changed.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reg-password">Password *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="reg-password"
                type={showRegPassword ? "text" : "password"}
                placeholder="••••••••"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                className="pl-10 pr-10"
                required
                minLength={6}
              />
              <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors">
                {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <PasswordStrengthIndicator password={regPassword} />

          <Button
            type="submit"
            className="w-full gap-2"
            disabled={loading || !nameValidation.valid || !regValidation.valid || !generatedEmail}
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <>Create Account<ArrowRight className="h-4 w-4" /></>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-muted-foreground">Already have an account?</span>{" "}
          <button onClick={() => setIsLogin(true)} className="text-primary font-medium hover:underline">Sign in</button>
        </div>
      </CardContent>
    </Card>
  );
}
