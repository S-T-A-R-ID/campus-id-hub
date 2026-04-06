import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, RotateCcw, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

export default function VirtualID() {
  const { user, profile } = useAuth();
  const [application, setApplication] = useState<any>(null);
  const [showBack, setShowBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [blurred, setBlurred] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [watermarkTime, setWatermarkTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    if (!user) return;
    supabase
      .from("id_applications")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["approved", "printed", "ready", "collected"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setApplication(data);
        setLoading(false);
      });
  }, [user]);

  // Update watermark timestamp every second
  useEffect(() => {
    const interval = setInterval(() => {
      setWatermarkTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Blur ID when tab loses focus (screenshot deterrence)
  useEffect(() => {
    const handleVisibility = () => setBlurred(document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Prevent right-click
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    toast.error("Right-click is disabled on the ID card");
  }, []);

  // Prevent drag
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <h1 className="text-3xl font-bold">Virtual ID</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <CreditCard className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Virtual ID Available</h3>
            <p className="text-muted-foreground">
              Your ID application must be approved before you can access your virtual ID card.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiryDate = application.expires_at
    ? new Date(application.expires_at).toLocaleDateString()
    : new Date(new Date().setFullYear(new Date().getFullYear() + 4)).toLocaleDateString();

  const verifyUrl = application.verification_token
    ? `${window.location.origin}/verify/${application.id}?token=${application.verification_token}`
    : `${window.location.origin}/verify/${application.id}`;

  const cardNumber = application.card_number || "CARD-" + application.id.slice(0, 8).toUpperCase();
  const watermarkText = `${profile?.reg_number || "STUDENT"} • ${watermarkTime}`;

  // Standard card ratio: 85.6mm × 54mm = 1.5852
  const CARD_WIDTH = 400;
  const CARD_HEIGHT = Math.round(CARD_WIDTH / 1.5852); // ~252px

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Virtual ID</h1>
          <p className="text-muted-foreground mt-1">Your digital student identification card</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowBack(!showBack)} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Flip
          </Button>
        </div>
      </div>

      {/* Security notice */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
        <span>This ID is protected with anti-forgery measures. Scan the QR code to verify authenticity.</span>
      </div>

      <div className="flex justify-center">
        <div
          ref={cardRef}
          className="select-none"
          style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
          draggable={false}
        >
          {!showBack ? (
            /* ===== FRONT ===== */
            <div
              className="rounded-2xl overflow-hidden shadow-2xl text-white relative"
              style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                background: "linear-gradient(135deg, hsl(152,100%,26%) 0%, hsl(152,80%,22%) 50%, hsl(152,40%,12%) 100%)",
                filter: blurred ? "blur(20px)" : "none",
                transition: "filter 0.3s ease",
              }}
            >
              {/* Security pattern overlay */}
              <div
                className="absolute inset-0 pointer-events-none opacity-[0.04]"
                style={{
                  backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.5) 10px, rgba(255,255,255,0.5) 11px)`,
                }}
              />

              {/* Dynamic watermark overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-[0.06] rotate-[-25deg]">
                <div className="text-[10px] font-mono tracking-widest whitespace-nowrap">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="leading-5">{watermarkText}</div>
                  ))}
                </div>
              </div>

              {/* EU logo watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06]">
                <div className="text-[80px] font-black tracking-widest">EU</div>
              </div>

              {/* Header */}
              <div className="px-4 pt-3 pb-2 flex items-center gap-2.5 border-b border-white/10 relative z-10">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold">EU</span>
                </div>
                <div>
                  <div className="font-bold text-xs tracking-wide">EGERTON UNIVERSITY</div>
                  <div className="text-[9px] text-white/60 uppercase tracking-wider">Student Identification Card</div>
                </div>
              </div>

              {/* Body */}
              <div className="px-4 pt-2 pb-1 flex gap-4 relative z-10" style={{ height: CARD_HEIGHT - 100 }}>
                <div
                  className="rounded-lg overflow-hidden bg-white/10 shrink-0 border-2 border-white/20"
                  style={{ width: 72, height: 88 }}
                >
                  {application.photo_url ? (
                    <img
                      src={application.photo_url}
                      alt=""
                      className="h-full w-full object-cover"
                      draggable={false}
                      style={{ pointerEvents: "none" }}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-white/30 text-[9px]">No Photo</div>
                  )}
                </div>
                <div className="space-y-1 min-w-0 text-[10px]">
                  <div>
                    <div className="uppercase text-white/50 text-[8px]">Name</div>
                    <div className="font-bold text-xs truncate">{profile?.full_name}</div>
                  </div>
                  <div>
                    <div className="uppercase text-white/50 text-[8px]">Reg No.</div>
                    <div className="font-semibold">{profile?.reg_number || "—"}</div>
                  </div>
                  <div>
                    <div className="uppercase text-white/50 text-[8px]">Course</div>
                    <div className="truncate">{profile?.course || "—"}</div>
                  </div>
                  <div>
                    <div className="uppercase text-white/50 text-[8px]">Faculty</div>
                    <div className="truncate">{profile?.faculty || "—"}</div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 pb-2 flex items-center justify-between relative z-10">
                <div className="space-y-0.5">
                  <div className="text-[8px] text-white/50">Campus</div>
                  <div className="text-[10px]">{profile?.campus || "Main Campus"}</div>
                </div>
                <div className="space-y-0.5 text-right">
                  <div className="text-[8px] text-white/50">Valid Until</div>
                  <div className="text-[10px] font-semibold">{expiryDate}</div>
                </div>
                <div className="h-14 w-14 rounded-lg bg-white flex items-center justify-center p-0.5 shrink-0">
                  <QRCodeSVG value={verifyUrl} size={48} level="H" />
                </div>
              </div>
            </div>
          ) : (
            /* ===== BACK ===== */
            <div
              className="rounded-2xl overflow-hidden shadow-2xl text-white relative flex flex-col justify-between"
              style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                background: "linear-gradient(135deg, hsl(152,100%,26%) 0%, hsl(152,80%,22%) 50%, hsl(152,40%,12%) 100%)",
                filter: blurred ? "blur(20px)" : "none",
                transition: "filter 0.3s ease",
                padding: "16px 20px",
              }}
            >
              {/* Security pattern */}
              <div
                className="absolute inset-0 pointer-events-none opacity-[0.04]"
                style={{
                  backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(255,255,255,0.5) 10px, rgba(255,255,255,0.5) 11px)`,
                }}
              />

              {/* Dynamic watermark */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden opacity-[0.06] rotate-[-25deg]">
                <div className="text-[10px] font-mono tracking-widest whitespace-nowrap">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="leading-5">{watermarkText}</div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 relative z-10">
                <div className="text-center">
                  <div className="font-bold text-xs">EGERTON UNIVERSITY</div>
                  <div className="text-[9px] text-white/60">P.O. Box 536 - 20115, Egerton, Kenya</div>
                </div>
                <div className="h-px bg-white/20" />
                <div className="text-[8px] text-white/70 space-y-0.5 leading-tight">
                  <p>This card is the property of Egerton University.</p>
                  <p>If found, please return to the nearest campus office.</p>
                  <p>This card must be carried at all times within campus premises.</p>
                  <p>Unauthorized use or alteration is a disciplinary offence.</p>
                </div>
              </div>

              <div className="space-y-1.5 relative z-10">
                <div className="h-8 bg-white/10 rounded flex items-center justify-center">
                  <div className="text-[8px] font-mono tracking-widest">{cardNumber}</div>
                </div>
                {application.verification_token && (
                  <div className="text-center text-[7px] text-white/40 font-mono truncate">
                    SIG: {application.verification_token.slice(0, 16)}...
                  </div>
                )}
                <div className="text-center text-[7px] text-white/40">
                  Scan QR code on front to verify authenticity
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Security limitations notice */}
      <p className="text-[10px] text-muted-foreground text-center max-w-md mx-auto">
        This digital ID is protected against casual copying. The QR code links to a secure verification endpoint
        that validates the cryptographic signature against our records.
      </p>
    </div>
  );
}
