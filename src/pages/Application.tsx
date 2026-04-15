import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { validateKenyaPhone, sanitizePhone, validateStudentName, validateRegNumber } from "@/lib/validators";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Camera, Check, Loader2 } from "lucide-react";

const faculties = [
  "Faculty of Agriculture",
  "Faculty of Arts and Social Sciences",
  "Faculty of Commerce",
  "Faculty of Education and Community Studies",
  "Faculty of Engineering and Technology",
  "Faculty of Environment and Resources Development",
  "Faculty of Health Sciences",
  "Faculty of Law",
  "Faculty of Science",
  "Faculty of Veterinary Medicine and Surgery",
];

const campuses = ["Main Campus", "Nakuru Town Campus"];

export default function Application() {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [application, setApplication] = useState<any>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    reg_number: "",
    faculty: "",
    department: "",
    course: "",
    campus: "Main Campus",
    year_of_study: "",
    phone: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        reg_number: profile.reg_number || "",
        faculty: profile.faculty || "",
        department: profile.department || "",
        course: profile.course || "",
        campus: profile.campus || "Main Campus",
        year_of_study: profile.year_of_study?.toString() || "",
        phone: profile.phone || "",
      });
      if (profile.photo_url) setPhotoPreview(profile.photo_url);
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("id_applications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setApplication(data));
  }, [user]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      toast.error("Please upload a JPEG or PNG image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo must be under 2MB");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/passport.${ext}`;

    const { error } = await supabase.storage.from("student-photos").upload(path, file, { upsert: true });
    if (error) {
      toast.error("Upload failed: " + error.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("student-photos").getPublicUrl(path);
    const photoUrl = urlData.publicUrl;

    await supabase.from("profiles").update({ photo_url: photoUrl }).eq("user_id", user.id);
    setPhotoPreview(photoUrl);
    await refreshProfile();
    setUploading(false);
    toast.success("Photo uploaded successfully!");
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    const phoneValidation = validateKenyaPhone(form.phone);
    if (!phoneValidation.valid) {
      toast.error(phoneValidation.error);
      return;
    }
    const nameVal = validateStudentName(form.full_name);
    if (!nameVal.valid) {
      toast.error(nameVal.error);
      return;
    }
    if (form.reg_number) {
      const regVal = validateRegNumber(form.reg_number);
      if (!regVal.valid) {
        toast.error(regVal.error);
        return;
      }
    }

    setLoading(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name,
        reg_number: form.reg_number,
        faculty: form.faculty,
        department: form.department,
        course: form.course,
        campus: form.campus,
        year_of_study: form.year_of_study ? parseInt(form.year_of_study) : null,
        phone: form.phone ? sanitizePhone(form.phone) : null,
      })
      .eq("user_id", user.id);

    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved!");
      await refreshProfile();
    }
    setLoading(false);
  };

  const handleSubmitApplication = async () => {
    const currentPhotoUrl = photoPreview || profile?.photo_url || null;

    if (!user || !currentPhotoUrl) {
      toast.error("Please upload a passport photo first");
      return;
    }
    if (!form.reg_number || !form.faculty || !form.course || !form.full_name) {
      toast.error("Please complete all required fields");
      return;
    }

    setLoading(true);
    await handleSaveProfile();

    const { error } = await supabase.from("id_applications").insert({
      user_id: user.id,
      photo_url: currentPhotoUrl,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Application submitted successfully!");
      const { data } = await supabase
        .from("id_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setApplication(data);
    }
    setLoading(false);
  };

  const alreadySubmitted = application && application.status !== "draft";

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">ID Application</h1>
        <p className="text-muted-foreground mt-1">Complete your profile and submit your application</p>
      </div>

      {alreadySubmitted && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <p className="font-semibold">Application already submitted</p>
            <p className="text-sm text-muted-foreground">Current status: <strong>{application.status}</strong></p>
          </CardContent>
        </Card>
      )}

      {/* Photo Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-sans">Passport Photo</CardTitle>
          <CardDescription>Upload a clear passport-size photo (JPEG/PNG, max 2MB)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="h-32 w-28 rounded-lg border-2 border-dashed border-input flex items-center justify-center overflow-hidden bg-muted">
              {photoPreview ? (
                <img src={photoPreview} alt="Passport" className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="photo" className="cursor-pointer">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Uploading..." : "Upload Photo"}
                </div>
              </Label>
              <Input id="photo" type="file" accept="image/jpeg,image/png" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
              <p className="text-xs text-muted-foreground">Passport-size, white background preferred</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-sans">Personal Details</CardTitle>
          <CardDescription>Confirm or edit your information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} disabled={!!alreadySubmitted} />
              {form.full_name && !validateStudentName(form.full_name).valid && (
                <p className="text-xs text-destructive">{validateStudentName(form.full_name).error}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Registration Number *</Label>
              <Input placeholder="e.g. S13/02928/23" value={form.reg_number} onChange={(e) => setForm({ ...form, reg_number: e.target.value })} disabled={!!alreadySubmitted} />
              {form.reg_number && !validateRegNumber(form.reg_number).valid && (
                <p className="text-xs text-destructive">{validateRegNumber(form.reg_number).error}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Faculty *</Label>
              <Select value={form.faculty} onValueChange={(v) => setForm({ ...form, faculty: v })} disabled={!!alreadySubmitted}>
                <SelectTrigger><SelectValue placeholder="Select faculty" /></SelectTrigger>
                <SelectContent>
                  {faculties.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} disabled={!!alreadySubmitted} />
            </div>
            <div className="space-y-2">
              <Label>Course *</Label>
              <Input placeholder="e.g. BSc Computer Science" value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} disabled={!!alreadySubmitted} />
            </div>
            <div className="space-y-2">
              <Label>Campus</Label>
              <Select value={form.campus} onValueChange={(v) => setForm({ ...form, campus: v })} disabled={!!alreadySubmitted}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {campuses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Year of Study</Label>
              <Select value={form.year_of_study} onValueChange={(v) => setForm({ ...form, year_of_study: v })} disabled={!!alreadySubmitted}>
                <SelectTrigger><SelectValue placeholder="Select year" /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((y) => <SelectItem key={y} value={y.toString()}>Year {y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                placeholder="+254712345678"
                value={form.phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d+]/g, "");
                  setForm({ ...form, phone: val });
                }}
                maxLength={13}
                disabled={!!alreadySubmitted}
              />
              {form.phone && !validateKenyaPhone(form.phone).valid && (
                <p className="text-xs text-destructive">{validateKenyaPhone(form.phone).error}</p>
              )}
            </div>
          </div>

          {!alreadySubmitted && (
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={handleSaveProfile} disabled={loading}>
                Save Draft
              </Button>
              <Button onClick={handleSubmitApplication} disabled={loading} className="gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Submit Application
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
