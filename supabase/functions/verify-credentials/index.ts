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
    const body = await req.json()
    const { email, password } = body

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return new Response(JSON.stringify({ error: 'Email and password are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check rate limiting
    const cutoff = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000).toISOString()
    const { data: failedAttempts } = await supabaseAdmin
      .from('login_attempts')
      .select('id')
      .eq('identifier', email.toLowerCase())
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

    // Verify password using a temp client with anon key
    const tempClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    )

    const { data: signInData, error: signInError } = await tempClient.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError || !signInData.user) {
      await supabaseAdmin.from('login_attempts').insert({
        identifier: email.toLowerCase(),
        success: false,
      })
      return new Response(JSON.stringify({ error: 'Invalid email or password' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Sign out the temp session immediately
    await tempClient.auth.signOut()

    // Record successful attempt
    await supabaseAdmin.from('login_attempts').insert({
      identifier: email.toLowerCase(),
      success: true,
    })

    return new Response(JSON.stringify({ verified: true, email: signInData.user.email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
