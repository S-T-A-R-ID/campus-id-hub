import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const OTP_COOLDOWN_SECONDS = 60
const OTP_EXPIRY_MINUTES = 5

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email } = await req.json()

    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Rate limit: max 1 OTP per cooldown period
    const cooldownCutoff = new Date(Date.now() - OTP_COOLDOWN_SECONDS * 1000).toISOString()
    const { data: recentOtp } = await supabaseAdmin
      .from('otp_codes')
      .select('id')
      .eq('email', normalizedEmail)
      .gte('created_at', cooldownCutoff)
      .limit(1)

    if (recentOtp && recentOtp.length > 0) {
      return new Response(JSON.stringify({ 
        error: `Please wait ${OTP_COOLDOWN_SECONDS} seconds before requesting a new code.` 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Invalidate all previous unused OTPs for this email
    await supabaseAdmin
      .from('otp_codes')
      .update({ is_used: true })
      .eq('email', normalizedEmail)
      .eq('is_used', false)

    // Create new OTP tracking record
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString()
    await supabaseAdmin.from('otp_codes').insert({
      email: normalizedEmail,
      expires_at: expiresAt,
    })

    // Trigger OTP email via Supabase Auth (sends 6-digit code)
    const tempClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )

    const { error: otpError } = await tempClient.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: false },
    })

    if (otpError) {
      console.error('OTP send error:', otpError.message)
      return new Response(JSON.stringify({ error: 'Failed to send verification code. Please try again.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Verification code sent',
      expires_in: OTP_EXPIRY_MINUTES * 60,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Send OTP error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
