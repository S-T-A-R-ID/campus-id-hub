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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { action } = body

    // Bootstrap mode: delete user by email (only works when no super_admin exists)
    if (action === 'bootstrap_delete') {
      const { email } = body
      const { count } = await supabaseAdmin
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'super_admin')

      if (count && count > 0) {
        return new Response(JSON.stringify({ error: 'Bootstrap mode disabled' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
      const targetUser = users.find((u: any) => u.email === email)
      if (targetUser) {
        await supabaseAdmin.auth.admin.deleteUser(targetUser.id)
      }

      return new Response(JSON.stringify({ success: true, deleted: !!targetUser }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Bulk delete all admin users (no auth required - one-time cleanup)
    if (action === 'bulk_delete_admins') {
      const { data: adminRoles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'super_admin'])

      let deleted = 0
      for (const ar of (adminRoles || [])) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(ar.user_id)
          deleted++
        } catch (e) {
          // User may already be deleted
        }
      }

      return new Response(JSON.stringify({ success: true, deleted }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Authenticated actions require super_admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify super_admin role
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .single()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden - super admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'delete_user') {
      const { email } = body
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
      const targetUser = users.find((u: any) => u.email === email)
      if (targetUser) {
        await supabaseAdmin.auth.admin.deleteUser(targetUser.id)
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'list_admins') {
      const { data: pins } = await supabaseAdmin.from('admin_pins').select('*')
      const adminDetails = []
      for (const pin of (pins || [])) {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(pin.user_id)
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('user_id', pin.user_id)
          .single()
        const { data: roleData } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', pin.user_id)
          .single()
        adminDetails.push({
          ...pin,
          email: userData?.user?.email,
          full_name: profile?.full_name,
          role: roleData?.role,
        })
      }
      return new Response(JSON.stringify({ admins: adminDetails }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'approve_admin') {
      const { user_id } = body
      await supabaseAdmin
        .from('admin_pins')
        .update({ is_approved: true })
        .eq('user_id', user_id)
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (action === 'reject_admin') {
      const { user_id } = body
      // Delete the user entirely
      await supabaseAdmin.auth.admin.deleteUser(user_id)
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
