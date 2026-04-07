import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

function validateName(name: string): { valid: boolean; error?: string; normalized?: string } {
  if (!name || name.trim() === '') {
    return { valid: false, error: 'Full name is required' }
  }
  const normalized = name.trim().replace(/\s+/g, ' ')
  const parts = normalized.split(' ').filter(Boolean)
  if (parts.length < 2) {
    return { valid: false, error: 'At least two names are required' }
  }
  const nameRegex = /^[A-Za-z-]+$/
  for (const part of parts) {
    if (!nameRegex.test(part)) {
      return { valid: false, error: `Name "${part}" contains invalid characters` }
    }
    if (part.length < 2) {
      return { valid: false, error: 'Each name must be at least 2 characters' }
    }
  }
  const formatted = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ')
  return { valid: true, normalized: formatted }
}

function validateRegNumber(regNumber: string): { valid: boolean; error?: string; digits?: string } {
  if (!regNumber || regNumber.trim() === '') {
    return { valid: false, error: 'Registration number is required' }
  }
  const cleaned = regNumber.trim().toUpperCase()
  const regRegex = /^[A-Z]\d{1,3}\/\d{3,6}\/\d{2}$/
  if (!regRegex.test(cleaned)) {
    return { valid: false, error: 'Invalid registration number format (e.g., S13/02928/23)' }
  }
  const parts = cleaned.split('/')
  const digits = parts[1] + parts[2]
  return { valid: true, digits }
}

function generateEmail(fullName: string, regDigits: string): string {
  const parts = fullName.split(' ')
  const lastName = parts[parts.length - 1].toLowerCase()
  return `${lastName}.${regDigits}@student.egerton.ac.ke`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { full_name, reg_number } = await req.json()

    // Validate name
    const nameResult = validateName(full_name)
    if (!nameResult.valid) {
      return new Response(JSON.stringify({ error: nameResult.error, field: 'full_name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate reg number
    const regResult = validateRegNumber(reg_number)
    if (!regResult.valid) {
      return new Response(JSON.stringify({ error: regResult.error, field: 'reg_number' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const generatedEmail = generateEmail(nameResult.normalized!, regResult.digits!)

    // Check uniqueness of reg number
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('reg_number', reg_number.trim().toUpperCase())
      .limit(1)

    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: 'This registration number is already registered', field: 'reg_number' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check if email already exists in auth
    const { data: userData } = await supabaseAdmin.auth.admin.listUsers()
    const emailExists = userData?.users?.some(u => u.email?.toLowerCase() === generatedEmail)

    if (emailExists) {
      return new Response(JSON.stringify({ error: 'An account with this email already exists', field: 'email' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      valid: true,
      normalized_name: nameResult.normalized,
      generated_email: generatedEmail,
      reg_digits: regResult.digits,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Validation error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
