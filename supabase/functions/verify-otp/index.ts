import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const MAX_OTP_ATTEMPTS = 5

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email, token } = await req.json()

    if (!email || typeof email !== 'string' || !token || typeof token !== 'string') {
      return new Response(JSON.stringify({ error: 'Email and verification code are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!/^\d{6}$/.test(token)) {
      return new Response(JSON.stringify({ error: 'Verification code must be 6 digits' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get the latest active OTP tracking record
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!otpRecord) {
      return new Response(JSON.stringify({ error: 'No active verification code found. Please request a new one.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabaseAdmin.from('otp_codes').update({ is_used: true }).eq('id', otpRecord.id)
      return new Response(JSON.stringify({ error: 'Verification code has expired. Please request a new one.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check attempt limit
    if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
      await supabaseAdmin.from('otp_codes').update({ is_used: true }).eq('id', otpRecord.id)
      return new Response(JSON.stringify({ error: 'Too many failed attempts. Please request a new verification code.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Increment attempt counter
    await supabaseAdmin
      .from('otp_codes')
      .update({ attempts: otpRecord.attempts + 1 })
      .eq('id', otpRecord.id)

    // Verify OTP via Supabase Auth
    const tempClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )

    const { data: verifyData, error: verifyError } = await tempClient.auth.verifyOtp({
      email: normalizedEmail,
      token,
      type: 'email',
    })

    if (verifyError || !verifyData.session) {
      const remainingAttempts = MAX_OTP_ATTEMPTS - (otpRecord.attempts + 1)
      return new Response(JSON.stringify({ 
        error: `Invalid verification code. ${remainingAttempts > 0 ? `${remainingAttempts} attempt(s) remaining.` : 'No attempts remaining.'}` 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Mark OTP as used (invalidate immediately after success)
    await supabaseAdmin.from('otp_codes').update({ is_used: true }).eq('id', otpRecord.id)

    // Return session tokens
    return new Response(JSON.stringify({
      verified: true,
      session: {
        access_token: verifyData.session.access_token,
        refresh_token: verifyData.session.refresh_token,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Verify OTP error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
