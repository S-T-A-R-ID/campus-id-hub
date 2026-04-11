import { GraduationCap } from "lucide-react";
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import AdminAuthForm from "@/components/auth/AdminAuthForm";
import StudentAuthForm from "@/components/auth/StudentAuthForm";

const AUTH_GUILLOCHE_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M30 0 C35 15 45 25 60 30 C45 35 35 45 30 60 C25 45 15 35 0 30 C15 25 25 15 30 0z' fill='none' stroke='rgba(17,94,58,0.09)' stroke-width='0.5'/%3E%3C/svg%3E")`;
const AUTH_CROSSHATCH_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Cpath d='M0 0L20 20M20 0L0 20' fill='none' stroke='rgba(17,94,58,0.07)' stroke-width='0.4'/%3E%3C/svg%3E")`;
const AUTH_WAVE_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='20'%3E%3Cpath d='M0 10 Q25 0 50 10 T100 10' fill='none' stroke='rgba(17,94,58,0.08)' stroke-width='0.5'/%3E%3C/svg%3E")`;

export default function Auth() {
  const [searchParams] = useSearchParams();
  const isAdminPortal = useMemo(() => searchParams.get("portal") === "admin", [searchParams]);

  return (
    <div className="auth-static-container flex h-[100dvh] overflow-hidden lg:min-h-screen lg:h-auto">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-primary via-primary/90 to-egerton-dark p-12 text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 -left-20 w-96 h-96 rounded-full bg-accent/30 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-80 h-80 rounded-full bg-primary-foreground/20 blur-3xl" />
        </div>

        <div className="relative z-10 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <GraduationCap className="h-10 w-10" />
            <span className="text-2xl font-bold font-sans">S.T.A.R_ID</span>
          </div>
          <p className="text-primary-foreground/70 text-sm">Digital Student ID System</p>
        </div>

        <div className="relative z-10 space-y-6 text-center">
          <h1 className="text-5xl font-bold leading-tight">
            Your Digital<br />Identity,<br />
            <span className="text-accent">Simplified.</span>
          </h1>
          <p className="text-primary-foreground/80 text-lg max-w-md mx-auto">
            Apply, track, and manage your student identification card — all from one secure platform.
          </p>
          <div className="flex justify-center gap-8 pt-4">
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
          © {new Date().getFullYear()} S.T.A.R_ID. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="auth-mobile-panel relative flex w-full lg:w-1/2 items-start justify-center overflow-hidden bg-muted/20 px-3 py-3 sm:px-6 sm:py-8 lg:items-center lg:bg-background lg:p-8">
        {/* Mobile-only security-paper background inspired by the Virtual ID watermark */}
        <div className="pointer-events-none absolute inset-0 lg:hidden">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 130% 90% at 10% 0%, hsla(152, 100%, 26%, 0.12) 0%, transparent 48%),
                radial-gradient(ellipse 95% 75% at 100% 90%, hsla(152, 70%, 16%, 0.12) 0%, transparent 50%),
                linear-gradient(180deg, hsla(150, 30%, 97%, 0.92) 0%, hsla(152, 35%, 95%, 0.88) 52%, hsla(150, 28%, 96%, 0.95) 100%)
              `,
            }}
          />
          <div className="absolute inset-0" style={{ backgroundImage: AUTH_GUILLOCHE_PATTERN }} />
          <div className="absolute inset-0" style={{ backgroundImage: AUTH_CROSSHATCH_PATTERN }} />
          <div className="absolute inset-0" style={{ backgroundImage: AUTH_WAVE_PATTERN }} />
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "repeating-linear-gradient(135deg, transparent, transparent 8px, rgba(17,94,58,0.35) 8px, rgba(17,94,58,0.35) 8.5px)",
            }}
          />
          <div
            className="absolute inset-0 -rotate-[28deg] overflow-hidden opacity-[0.06]"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent 0, transparent 22px, rgba(17,94,58,0.22) 22px, rgba(17,94,58,0.22) 23px)",
            }}
          />
        </div>

        <div className="auth-mobile-form relative z-10 w-full max-w-md animate-fade-in">
          <div className="auth-mobile-hero lg:hidden mb-3 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-egerton-dark p-3.5 text-primary-foreground shadow-lg text-center">
            <div className="flex items-center justify-center gap-2">
              <GraduationCap className="h-6 w-6" />
              <span className="text-base font-bold">S.T.A.R_ID</span>
            </div>
            <p className="mt-1 text-xs text-primary-foreground/80">{isAdminPortal ? "Admin Access Portal" : "Digital Student ID System"}</p>
            <p className="mt-2 text-base font-semibold leading-snug sm:text-lg">
              {isAdminPortal ? (
                <>
                  Authorized Admin,<span className="text-accent"> Sign In.</span>
                </>
              ) : (
                <>
                  Your Digital Identity, <span className="text-accent">Simplified.</span>
                </>
              )}
            </p>
            <div className="mt-2 hidden justify-center gap-5 text-xs text-primary-foreground/80 sm:flex">
              <span><strong className="text-base text-primary-foreground">100%</strong> Digital</span>
              <span><strong className="text-base text-primary-foreground">24/7</strong> Access</span>
              <span><strong className="text-base text-primary-foreground">QR</strong> Verified</span>
            </div>
          </div>

          {isAdminPortal ? <AdminAuthForm /> : <StudentAuthForm />}
        </div>
      </div>
    </div>
  );
}
