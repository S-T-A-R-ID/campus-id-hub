import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { email, new_pin } = await req.json()

    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!new_pin || typeof new_pin !== 'string' || new_pin.length !== 4 || !/^\d{4}$/.test(new_pin)) {
      return new Response(JSON.stringify({ error: 'New PIN must be exactly 4 digits' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Find user by email
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
    const targetUser = users.find((u: any) => u.email === email)

    if (!targetUser) {
      return new Response(JSON.stringify({ error: 'No admin account found with this email' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check they have an admin_pin entry
    const { data: pinData } = await supabaseAdmin
      .from('admin_pins')
      .select('id')
      .eq('user_id', targetUser.id)
      .single()

    if (!pinData) {
      return new Response(JSON.stringify({ error: 'This email is not registered as an admin' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if new PIN is already in use
    const { data: existing } = await supabaseAdmin
      .from('admin_pins')
      .select('id')
      .eq('pin', new_pin)
      .neq('user_id', targetUser.id)
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ error: 'This PIN is already in use. Please choose a different one.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Update the PIN
    const { error: updateError } = await supabaseAdmin
      .from('admin_pins')
      .update({ pin: new_pin })
      .eq('user_id', targetUser.id)

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to update PIN' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
