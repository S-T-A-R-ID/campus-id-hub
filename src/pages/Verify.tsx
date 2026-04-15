import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, GraduationCap, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";

export default function Verify() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verificationMethod, setVerificationMethod] = useState<"crypto" | "basic" | "failed">("basic");

  useEffect(() => {
    if (!id) return;

    const verify = async () => {
      // Try cryptographic verification first if token is present
      if (token) {
        try {
          const { data, error } = await supabase.functions.invoke("verify-id", {
            body: { application_id: id, verification_token: token },
          });

          if (!error && data?.valid) {
            setResult(data);
            setVerificationMethod("crypto");
            setLoading(false);
            return;
          }

          if (data && !data.valid) {
            setResult(data);
            setVerificationMethod("failed");
            setLoading(false);
            return;
          }
        } catch {
          // Fall through to basic verification
        }
      }

      // Basic verification (no token)
      const { data: app } = await supabase
        .from("id_applications")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (app) {
        const isValid = ["approved", "printed", "ready", "collected"].includes(app.status);
        if (isValid) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("full_name, reg_number, faculty, course, campus, photo_url")
            .eq("user_id", app.user_id)
            .single();
          setResult({ valid: true, student: prof, status: app.status, basic: true });
          setVerificationMethod("basic");
        } else {
          setResult({ valid: false, status: app.status });
          setVerificationMethod("failed");
        }
      } else {
        setResult(null);
        setVerificationMethod("failed");
      }
      setLoading(false);
    };
    verify();
  }, [id, token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center gap-2 mb-6">
          <GraduationCap className="h-8 w-8 text-primary" />
          <span className="text-xl font-bold">S.T.A.R_ID</span>
        </div>

        <Card>
          <CardContent className="p-8 text-center">
            {!result || verificationMethod === "failed" ? (
              <>
                <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
                <h2 className="text-xl font-bold mb-2">
                  {result?.reason === "invalid_token" ? "Forgery Detected" : result?.reason === "expired" ? "ID Expired" : "Invalid ID"}
                </h2>
                <p className="text-muted-foreground">
                  {result?.reason === "invalid_token"
                    ? "The cryptographic signature does not match our records. This ID may be forged."
                    : result?.reason === "expired"
                    ? "This student ID has expired."
                    : "This student ID could not be verified."}
                </p>
              </>
            ) : result?.valid ? (
              <>
                <CheckCircle2 className="h-16 w-16 mx-auto text-primary mb-4" />
                <h2 className="text-xl font-bold mb-2">Verified Student</h2>

                {/* Verification badge */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4 ${
                  verificationMethod === "crypto"
                    ? "bg-primary/10 text-primary"
                    : "bg-amber-100 text-amber-800"
                }`}>
                  {verificationMethod === "crypto" ? (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Cryptographically Verified
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Basic Verification Only
                    </>
                  )}
                </div>

                {result.student?.photo_url && (
                  <div className="h-24 w-20 mx-auto rounded-lg overflow-hidden mb-4">
                    <img src={result.student.photo_url} alt="Student" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="space-y-2 text-left">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{result.student?.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reg No.</span>
                    <span className="font-medium">{result.student?.reg_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Course</span>
                    <span className="font-medium">{result.student?.course}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Faculty</span>
                    <span className="font-medium">{result.student?.faculty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium text-primary">Active</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
                <h2 className="text-xl font-bold mb-2">ID Not Valid</h2>
                <p className="text-muted-foreground">
                  This student ID is not currently active. Status: {result.status}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
