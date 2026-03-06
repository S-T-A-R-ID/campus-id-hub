import { useState } from "react";
import { GraduationCap, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import StudentAuthForm from "@/components/auth/StudentAuthForm";
import AdminAuthForm from "@/components/auth/AdminAuthForm";

type UserType = "student" | "staff";

export default function Auth() {
  const [userType, setUserType] = useState<UserType>("student");

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-primary via-primary/90 to-egerton-dark p-12 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 -left-20 w-96 h-96 rounded-full bg-accent/30 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-primary-foreground/20 blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap className="h-10 w-10" />
            <span className="text-2xl font-bold font-sans">Egerton University</span>
          </div>
          <p className="text-primary-foreground/70 text-sm">Digital Student ID System</p>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-5xl font-bold leading-tight">
            Your Digital<br />Identity,<br />
            <span className="text-accent">Simplified.</span>
          </h1>
          <p className="text-primary-foreground/80 text-lg max-w-md">
            Apply, track, and manage your student identification card — all from one secure platform.
          </p>
          <div className="flex gap-8 pt-4">
            <div>
              <div className="text-3xl font-bold">100%</div>
              <div className="text-sm text-primary-foreground/60">Digital Process</div>
            </div>
            <div>
              <div className="text-3xl font-bold">24/7</div>
              <div className="text-sm text-primary-foreground/60">Access</div>
            </div>
            <div>
              <div className="text-3xl font-bold">QR</div>
              <div className="text-sm text-primary-foreground/60">Verified</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-sm text-primary-foreground/50">
          © {new Date().getFullYear()} Egerton University. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <GraduationCap className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Egerton University</span>
          </div>

          {/* User Type Toggle */}
          <div className="flex rounded-lg border border-border bg-muted p-1 mb-6">
            <button
              type="button"
              onClick={() => setUserType("student")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all",
                userType === "student"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <GraduationCap className="h-4 w-4" />
              Student
            </button>
            <button
              type="button"
              onClick={() => setUserType("staff")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all",
                userType === "staff"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Shield className="h-4 w-4" />
              Admin / Staff
            </button>
          </div>

          {userType === "student" ? <StudentAuthForm /> : <AdminAuthForm />}
        </div>
      </div>
    </div>
  );
}
