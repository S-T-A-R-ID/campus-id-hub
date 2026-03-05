import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, CreditCard, RotateCcw } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toPng } from "html-to-image";
import { toast } from "sonner";

export default function VirtualID() {
  const { user, profile } = useAuth();
  const [application, setApplication] = useState<any>(null);
  const [showBack, setShowBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const cardRef = useRef<HTMLDivElement>(null);

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

  const handleDownload = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 3 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `egerton-id-${profile?.reg_number || "card"}.png`;
      a.click();
      toast.success("ID card downloaded!");
    } catch {
      toast.error("Failed to download card");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  }

  if (!application) {
    return (
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <h1 className="text-3xl font-bold">Virtual ID</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <CreditCard className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2 font-sans">No Virtual ID Available</h3>
            <p className="text-muted-foreground">Your ID application must be approved before you can access your virtual ID card.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiryDate = application.expires_at
    ? new Date(application.expires_at).toLocaleDateString()
    : new Date(new Date().setFullYear(new Date().getFullYear() + 4)).toLocaleDateString();

  const verifyUrl = `${window.location.origin}/verify/${application.id}`;

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
          <Button size="sm" className="gap-2" onClick={handleDownload}>
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="w-[400px] perspective-1000" ref={cardRef}>
          {!showBack ? (
            <div className="rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-[hsl(152,100%,26%)] via-[hsl(152,100%,26%,0.95)] to-[hsl(152,40%,12%)] text-white">
              <div className="px-6 pt-5 pb-3 flex items-center gap-3 border-b border-white/10">
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-lg font-bold">EU</span>
                </div>
                <div>
                  <div className="font-bold text-sm tracking-wide">EGERTON UNIVERSITY</div>
                  <div className="text-[10px] text-white/60 uppercase tracking-wider">Student Identification Card</div>
                </div>
              </div>

              <div className="p-6 flex gap-5">
                <div className="h-28 w-24 rounded-lg overflow-hidden bg-white/10 shrink-0 border-2 border-white/20">
                  {application.photo_url ? (
                    <img src={application.photo_url} alt="Student" className="h-full w-full object-cover" crossOrigin="anonymous" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-white/30 text-xs">No Photo</div>
                  )}
                </div>
                <div className="space-y-1.5 min-w-0">
                  <div>
                    <div className="text-[10px] uppercase text-white/50">Name</div>
                    <div className="font-bold text-sm truncate">{profile?.full_name}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-white/50">Reg No.</div>
                    <div className="font-semibold text-xs">{profile?.reg_number || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-white/50">Course</div>
                    <div className="text-xs truncate">{profile?.course || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase text-white/50">Faculty</div>
                    <div className="text-xs truncate">{profile?.faculty || "—"}</div>
                  </div>
                </div>
              </div>

              <div className="px-6 pb-5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-white/50">Campus</div>
                  <div className="text-xs">{profile?.campus || "Main Campus"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-white/50">Valid Until</div>
                  <div className="text-xs font-semibold">{expiryDate}</div>
                </div>
                <div className="h-16 w-16 rounded-lg bg-white flex items-center justify-center p-1">
                  <QRCodeSVG value={verifyUrl} size={56} level="M" />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-[hsl(152,100%,26%)] via-[hsl(152,100%,26%,0.95)] to-[hsl(152,40%,12%)] text-white p-6 min-h-[280px] flex flex-col justify-between">
              <div className="space-y-3">
                <div className="text-center">
                  <div className="font-bold text-sm">EGERTON UNIVERSITY</div>
                  <div className="text-[10px] text-white/60">P.O. Box 536 - 20115, Egerton, Kenya</div>
                </div>
                <div className="h-px bg-white/20" />
                <div className="text-[9px] text-white/70 space-y-1">
                  <p>This card is the property of Egerton University.</p>
                  <p>If found, please return to the nearest campus office.</p>
                  <p>This card must be carried at all times within campus premises.</p>
                  <p>Unauthorized use or alteration of this card is a disciplinary offence.</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-10 bg-white/10 rounded flex items-center justify-center">
                  <div className="text-[8px] font-mono tracking-widest">
                    {application.card_number || "CARD-" + application.id.slice(0, 8).toUpperCase()}
                  </div>
                </div>
                <div className="text-center text-[8px] text-white/40">
                  Verify at: {verifyUrl}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
