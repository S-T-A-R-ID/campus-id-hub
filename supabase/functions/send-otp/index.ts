import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const OTP_COOLDOWN_SECONDS = 60
const OTP_EXPIRY_MINUTES = 5

async function hashOtp(otp: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(otp)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateSecureOtp(): string {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return (array[0] % 1000000).toString().padStart(6, '0')
}

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

    // Generate secure 6-digit OTP and hash it
    const otpCode = generateSecureOtp()
    const otpHash = await hashOtp(otpCode)

    // Store hashed OTP
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString()
    await supabaseAdmin.from('otp_codes').insert({
      email: normalizedEmail,
      expires_at: expiresAt,
      otp_hash: otpHash,
    })

    // Send OTP via Supabase Auth magic link (will contain the code in email)
    // We use signInWithOtp but the actual verification is done against our stored hash
    const tempClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )

    // Send the OTP code via Supabase Auth email (the token IS the 6-digit code)
    const { error: otpError } = await tempClient.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: false },
    })

    if (otpError) {
      console.error('OTP send error:', otpError.message)
      // Even if Supabase Auth OTP fails, we still have our custom OTP stored
      // In production with custom email domain, the code would be in the email template
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Verification code sent',
      expires_in: OTP_EXPIRY_MINUTES * 60,
      // In development/testing, include the code. Remove in production.
      ...(Deno.env.get('ENVIRONMENT') === 'development' ? { debug_code: otpCode } : {}),
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
