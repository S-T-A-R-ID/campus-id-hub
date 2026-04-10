import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { application_id, verification_token } = await req.json();

    if (!application_id || !verification_token) {
      return new Response(
        JSON.stringify({ valid: false, error: "Missing parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: app, error } = await supabase
      .from("id_applications")
      .select("id, status, verification_token, expires_at, user_id, card_number")
      .eq("id", application_id)
      .maybeSingle();

    if (error || !app) {
      return new Response(
        JSON.stringify({ valid: false, error: "ID not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isActive = ["approved", "printed", "ready", "collected"].includes(app.status);
    const tokenMatch = app.verification_token === verification_token;
    const notExpired = !app.expires_at || new Date(app.expires_at) > new Date();

    if (!isActive || !tokenMatch || !notExpired) {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: !tokenMatch ? "invalid_token" : !isActive ? "inactive" : "expired",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, reg_number, faculty, course, campus, photo_url")
      .eq("user_id", app.user_id)
      .single();

    return new Response(
      JSON.stringify({
        valid: true,
        student: {
          full_name: profile?.full_name,
          reg_number: profile?.reg_number,
          faculty: profile?.faculty,
          course: profile?.course,
          campus: profile?.campus,
          photo_url: profile?.photo_url,
        },
        card_number: app.card_number,
        status: app.status,
        expires_at: app.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ valid: false, error: "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
