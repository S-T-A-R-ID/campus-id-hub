import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, RotateCcw, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";

// Inline SVG security pattern as a data URI to avoid exposing public URLs
const GUILLOCHE_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M30 0 C35 15 45 25 60 30 C45 35 35 45 30 60 C25 45 15 35 0 30 C15 25 25 15 30 0z' fill='none' stroke='rgba(255,255,255,0.07)' stroke-width='0.5'/%3E%3C/svg%3E")`;

const CROSSHATCH_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20'%3E%3Cpath d='M0 0L20 20M20 0L0 20' fill='none' stroke='rgba(255,255,255,0.03)' stroke-width='0.4'/%3E%3C/svg%3E")`;

const WAVE_PATTERN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='20'%3E%3Cpath d='M0 10 Q25 0 50 10 T100 10' fill='none' stroke='rgba(255,255,255,0.04)' stroke-width='0.5'/%3E%3C/svg%3E")`;

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

  useEffect(() => {
    const interval = setInterval(() => {
      setWatermarkTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleVisibility = () => setBlurred(document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    toast.error("Right-click is disabled on the ID card");
  }, []);

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

  const CARD_WIDTH = 400;
  const CARD_HEIGHT = Math.round(CARD_WIDTH / 1.5852);

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

      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
        <span>This ID is protected with anti-forgery measures. Scan the QR code to verify authenticity.</span>
      </div>

      <div className="flex justify-center" style={{ marginBottom: 32 }}>
        <div
          ref={cardRef}
          className="select-none"
          style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
          draggable={false}
        >
          {!showBack ? (
            <IDCardFront
              CARD_WIDTH={CARD_WIDTH}
              CARD_HEIGHT={CARD_HEIGHT}
              blurred={blurred}
              watermarkText={watermarkText}
              application={application}
              profile={profile}
              expiryDate={expiryDate}
              verifyUrl={verifyUrl}
            />
          ) : (
            <IDCardBack
              CARD_WIDTH={CARD_WIDTH}
              CARD_HEIGHT={CARD_HEIGHT}
              blurred={blurred}
              watermarkText={watermarkText}
              cardNumber={cardNumber}
              verificationToken={application.verification_token}
            />
          )}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center max-w-md mx-auto">
        This digital ID is protected against casual copying. The QR code links to a secure verification endpoint
        that validates the cryptographic signature against our records.
      </p>
    </div>
  );
}

/* ============================================================
   Shared background & overlay layers
   ============================================================ */

function CardBackground({ children, blurred, width, height }: {
  children: React.ReactNode;
  blurred: boolean;
  width: number;
  height: number;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl text-white relative"
      style={{
        width,
        height,
        background: `
          radial-gradient(ellipse 120% 80% at 20% 10%, hsla(152,100%,36%,0.35) 0%, transparent 50%),
          radial-gradient(ellipse 80% 100% at 90% 80%, hsla(152,60%,18%,0.6) 0%, transparent 50%),
          linear-gradient(160deg, hsl(152,100%,28%) 0%, hsl(152,80%,20%) 35%, hsl(152,50%,14%) 70%, hsl(152,40%,10%) 100%)
        `,
        filter: blurred ? "blur(20px)" : "none",
        transition: "filter 0.3s ease",
      }}
    >
      {/* Guilloche rosette pattern */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: GUILLOCHE_PATTERN }} />
      {/* Crosshatch micro-texture */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: CROSSHATCH_PATTERN }} />
      {/* Wave bands */}
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: WAVE_PATTERN }} />
      {/* Diagonal fine lines */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage: `repeating-linear-gradient(135deg, transparent, transparent 8px, rgba(255,255,255,0.6) 8px, rgba(255,255,255,0.6) 8.5px)`,
        }}
      />
      {/* Gold accent stripe along left edge */}
      <div
        className="absolute left-0 top-0 bottom-0 pointer-events-none"
        style={{
          width: 4,
          background: "linear-gradient(to bottom, hsla(45,100%,51%,0.6), hsla(45,100%,51%,0.1) 40%, hsla(45,100%,51%,0.4) 80%, hsla(45,100%,51%,0.15))",
        }}
      />
      {children}
    </div>
  );
}

function WatermarkOverlay({ watermarkText }: { watermarkText: string }) {
  return (
    <>
      {/* Central institutional crest watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.055]">
        <svg width="140" height="140" viewBox="0 0 140 140" fill="none">
          {/* Outer ring */}
          <circle cx="70" cy="70" r="65" stroke="white" strokeWidth="1.2" />
          <circle cx="70" cy="70" r="58" stroke="white" strokeWidth="0.6" />
          {/* Shield shape */}
          <path d="M70 25 L100 45 L100 80 Q100 105 70 120 Q40 105 40 80 L40 45 Z" stroke="white" strokeWidth="1" fill="none" />
          {/* Inner details */}
          <path d="M70 40 L85 50 L85 75 Q85 92 70 100 Q55 92 55 75 L55 50 Z" stroke="white" strokeWidth="0.6" fill="none" />
          {/* EU text */}
          <text x="70" y="78" textAnchor="middle" fill="white" fontSize="22" fontWeight="800" fontFamily="serif">EU</text>
          {/* Circular text path */}
          <path id="topArc" d="M 20,70 A 50,50 0 0,1 120,70" fill="none" />
          <text fontSize="7" fill="white" fontWeight="600">
            <textPath href="#topArc" startOffset="50%" textAnchor="middle">S.T.A.R_ID</textPath>
          </text>
          <path id="botArc" d="M 20,70 A 50,50 0 0,0 120,70" fill="none" />
          <text fontSize="6" fill="white">
            <textPath href="#botArc" startOffset="50%" textAnchor="middle">TRANSFORMING LIVES</textPath>
          </text>
        </svg>
      </div>
      {/* Dynamic user + timestamp watermark grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.045] rotate-[-30deg]">
        <div className="text-[8px] font-mono tracking-[0.2em] whitespace-nowrap" style={{ lineHeight: "18px" }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ marginLeft: i % 2 === 0 ? 0 : 40 }}>{watermarkText}  •  {watermarkText}  •  {watermarkText}</div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ============================================================
   FRONT
   ============================================================ */

function IDCardFront({ CARD_WIDTH, CARD_HEIGHT, blurred, watermarkText, application, profile, expiryDate, verifyUrl }: any) {
  return (
    <CardBackground blurred={blurred} width={CARD_WIDTH} height={CARD_HEIGHT}>
      <WatermarkOverlay watermarkText={watermarkText} />

      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2.5 border-b border-white/10 relative z-10">
        <div className="h-10 w-10 rounded-full border border-white/20 flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, hsla(45,100%,51%,0.25), hsla(45,100%,51%,0.05))" }}>
          <span className="text-sm font-bold" style={{ color: "hsla(45,100%,70%,1)" }}>EU</span>
        </div>
        <div>
          <div className="font-bold text-xs tracking-wide">S.T.A.R_ID</div>
          <div className="text-[9px] text-white/55 uppercase tracking-[0.15em]">Student Identification Card</div>
        </div>
        {/* Small gold diamond accent */}
        <div className="ml-auto shrink-0 opacity-40" style={{ width: 8, height: 8, background: "hsl(45,100%,51%)", transform: "rotate(45deg)" }} />
      </div>

      {/* Body */}
      <div className="px-4 pt-2 pb-1 flex gap-4 relative z-10" style={{ height: CARD_HEIGHT - 100 }}>
        <div
          className="rounded-lg overflow-hidden shrink-0"
          style={{
            width: 72,
            height: 88,
            border: "2px solid hsla(45,100%,51%,0.3)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.08)",
          }}
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
            <div className="h-full w-full flex items-center justify-center bg-white/5 text-white/30 text-[9px]">No Photo</div>
          )}
        </div>
        <div className="space-y-1 min-w-0 text-[10px]">
          <FieldRow label="Name" value={profile?.full_name} bold />
          <FieldRow label="Reg No." value={profile?.reg_number || "—"} />
          <FieldRow label="Course" value={profile?.course || "—"} />
          <FieldRow label="Faculty" value={profile?.faculty || "—"} />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 pb-6 flex items-center justify-between relative z-10" style={{ marginBottom: 6 }}>
        <div className="space-y-0.5">
          <div className="text-[8px] text-white/45 uppercase tracking-wider">Campus</div>
          <div className="text-[10px]">{profile?.campus || "Main Campus"}</div>
        </div>
        <div className="space-y-0.5 text-right">
          <div className="text-[8px] text-white/45 uppercase tracking-wider">Valid Until</div>
          <div className="text-[10px] font-semibold">{expiryDate}</div>
        </div>
        <div
          className="h-14 w-14 rounded-lg flex items-center justify-center p-1 shrink-0"
          style={{
            background: "white",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)"
          }}
        >
          <QRCodeSVG value={verifyUrl} size={42} level="H" />
        </div>
      </div>
    </CardBackground>
  );
}

/* ============================================================
   BACK
   ============================================================ */

function IDCardBack({ CARD_WIDTH, CARD_HEIGHT, blurred, watermarkText, cardNumber, verificationToken }: any) {
  return (
    <CardBackground blurred={blurred} width={CARD_WIDTH} height={CARD_HEIGHT}>
      <WatermarkOverlay watermarkText={watermarkText} />

      <div className="flex flex-col justify-between h-full relative z-10" style={{ padding: "16px 20px" }}>
        <div className="space-y-2">
          <div className="text-center">
            <div className="font-bold text-xs tracking-wide">S.T.A.R_ID</div>
            <div className="text-[9px] text-white/55">S.T.A.R_ID Student ID System</div>
          </div>
          <div className="h-px" style={{ background: "linear-gradient(90deg, transparent, hsla(45,100%,51%,0.3), transparent)" }} />
          <div className="text-[8px] text-white/65 space-y-0.5 leading-tight">
            <p>This card is the property of S.T.A.R_ID.</p>
            <p>If found, please return to the nearest campus office.</p>
            <p>This card must be carried at all times within campus premises.</p>
            <p>Unauthorized use or alteration is a disciplinary offence.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div
            className="h-8 rounded flex items-center justify-center"
            style={{
              background: "linear-gradient(90deg, hsla(0,0%,100%,0.06), hsla(0,0%,100%,0.12), hsla(0,0%,100%,0.06))",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="text-[8px] font-mono tracking-[0.25em]">{cardNumber}</div>
          </div>
          {verificationToken && (
            <div className="text-center text-[7px] text-white/35 font-mono truncate">
              SIG: {verificationToken.slice(0, 16)}...
            </div>
          )}
          <div className="text-center text-[7px] text-white/35">
            Scan QR code on front to verify authenticity
          </div>
        </div>
      </div>
    </CardBackground>
  );
}

/* ============================================================
   Helpers
   ============================================================ */

function FieldRow({ label, value, bold }: { label: string; value?: string | null; bold?: boolean }) {
  return (
    <div>
      <div className="uppercase text-white/45 text-[8px] tracking-wider">{label}</div>
      <div className={`truncate ${bold ? "font-bold text-xs" : "font-medium text-[10px]"}`}>{value || "—"}</div>
    </div>
  );
}
