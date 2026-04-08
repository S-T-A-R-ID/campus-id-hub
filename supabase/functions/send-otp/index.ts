import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const OTP_COOLDOWN_SECONDS = 60
const OTP_EXPIRY_MINUTES = 5
const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend'

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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const normalizedEmail = email.toLowerCase().trim()

    const resendApiKey = Deno.env.get('RESEND_API_KEY_1') || Deno.env.get('RESEND_API_KEY')
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!resendApiKey || !lovableApiKey) {
      console.error('RESEND_API_KEY or LOVABLE_API_KEY is not configured')
      return new Response(JSON.stringify({ error: 'Email service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const fromEmail = Deno.env.get('OTP_FROM_EMAIL') || 'onboarding@resend.dev'

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
      .eq('is_used', false)
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
    const { data: otpRecord } = await supabaseAdmin.from('otp_codes').insert({
      email: normalizedEmail,
      expires_at: expiresAt,
      otp_hash: otpHash,
    }).select('id').single()

    // Send OTP via Resend connector gateway
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #1a1a2e; font-size: 24px; margin: 0;">Egerton University</h1>
          <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Digital ID System</p>
        </div>
        <div style="background: #f9fafb; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="color: #374151; font-size: 16px; margin: 0 0 16px 0;">Your verification code is:</p>
          <div style="background: #1a1a2e; color: #ffffff; font-size: 36px; font-weight: bold; letter-spacing: 8px; padding: 16px 24px; border-radius: 8px; display: inline-block; font-family: 'Courier New', monospace;">
            ${otpCode}
          </div>
          <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">This code expires in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.</p>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 16px;">
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
            If you did not request this code, please ignore this email.<br/>
            Do not share this code with anyone.
          </p>
        </div>
      </div>
    `

    const resendResponse = await fetch(`${GATEWAY_URL}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
        'X-Connection-Api-Key': resendApiKey,
      },
      body: JSON.stringify({
        from: `Egerton Digital ID <${fromEmail}>`,
        to: [normalizedEmail],
        subject: `${otpCode} — Your Verification Code`,
        html: emailHtml,
      }),
    })

    if (!resendResponse.ok) {
      const resendErrorText = await resendResponse.text()
      console.error('Resend gateway error:', resendResponse.status, resendErrorText)

      if (otpRecord?.id) {
        await supabaseAdmin.from('otp_codes').delete().eq('id', otpRecord.id)
      }

      let providerMessage = 'Failed to send verification email.'
      try {
        const parsedError = JSON.parse(resendErrorText)
        providerMessage = parsedError?.message || parsedError?.error || parsedError?.details || providerMessage
      } catch {
        if (resendErrorText.trim()) {
          providerMessage = resendErrorText.trim()
        }
      }

      const normalizedProviderMessage = providerMessage.toLowerCase()
      const isCredentialError =
        normalizedProviderMessage.includes('credential not found') ||
        normalizedProviderMessage.includes('unauthorized')

      const isResendTestSenderRestriction =
        fromEmail.toLowerCase() === 'onboarding@resend.dev' &&
        !isCredentialError &&
        (
          normalizedProviderMessage.includes('testing') ||
          normalizedProviderMessage.includes('sandbox') ||
          normalizedProviderMessage.includes('own email') ||
          normalizedProviderMessage.includes('verify a domain')
        )

      const userFacingError = isResendTestSenderRestriction
        ? 'OTP email delivery is blocked for this recipient while using the Resend test sender onboarding@resend.dev. Verify your own sending domain to send codes to student and staff emails.'
        : providerMessage

      return new Response(JSON.stringify({ error: userFacingError }), {
        status: resendResponse.status >= 400 && resendResponse.status < 600 ? resendResponse.status : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Verification code sent to your email',
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
