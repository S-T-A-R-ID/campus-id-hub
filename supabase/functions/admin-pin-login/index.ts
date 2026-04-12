import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const MAX_ATTEMPTS = 3
const LOCKOUT_MINUTES = 15

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { pin } = await req.json()

    if (!pin || typeof pin !== 'string' || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return new Response(JSON.stringify({ error: 'Invalid PIN format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

    // Look up PIN
    const { data: pinData, error: pinError } = await supabaseAdmin
      .from('admin_pins')
      .select('user_id, is_approved, pin_changed')
      .eq('pin', pin)
      .single()

    if (pinError || !pinData) {
      await supabaseAdmin.from('login_attempts').insert({
        identifier: `pin:${pin.substring(0, 2)}**`,
        success: false,
      })
      return new Response(JSON.stringify({ error: 'Invalid PIN' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check rate limiting
    const cutoff = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString()
    const { data: failedAttempts } = await supabaseAdmin
      .from('login_attempts')
      .select('id')
      .eq('identifier', `admin:${pinData.user_id}`)
      .eq('success', false)
      .gte('attempted_at', cutoff)

    if (failedAttempts && failedAttempts.length >= MAX_ATTEMPTS) {
      return new Response(JSON.stringify({
        error: `Account locked due to too many failed attempts. Please try again in ${LOCKOUT_MINUTES} minutes.`
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!pinData.is_approved) {
      return new Response(JSON.stringify({ error: 'Your account is pending approval by the super admin.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get user email
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(pinData.user_id)

    if (userError || !userData.user?.email) {
      console.error('User lookup failed:', userError?.message)
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Record successful attempt
    await supabaseAdmin.from('login_attempts').insert({
      identifier: `admin:${pinData.user_id}`,
      success: true,
    })

    // Generate magic link and verify to create session
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email,
    })

    if (linkError || !linkData) {
      console.error('generateLink failed:', linkError?.message)
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tokenHash = linkData.properties?.hashed_token
    if (!tokenHash) {
      console.error('No hashed_token in link properties:', JSON.stringify(linkData.properties))
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Use anon client to verify OTP and get session
    const tempClient = createClient(supabaseUrl, anonKey)
    const { data: verifyData, error: verifyError } = await tempClient.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    })

    if (verifyError || !verifyData.session) {
      console.error('verifyOtp failed:', verifyError?.message, 'session:', verifyData?.session ? 'present' : 'null')
      return new Response(JSON.stringify({ error: 'Failed to create session. Please try again.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      verified: true,
      email: userData.user.email,
      pin_changed: pinData.pin_changed ?? false,
      session: {
        access_token: verifyData.session.access_token,
        refresh_token: verifyData.session.refresh_token,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Unhandled error:', error?.message || error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
