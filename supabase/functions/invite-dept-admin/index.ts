import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')
    const token = authHeader.replace('Bearer ', '')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify caller is institution_admin
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role, institution_id')
      .eq('id', user.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'institution_admin') {
      throw new Error('Access denied: institution_admin required')
    }

    const body = await req.json()
    const { email, department, institution_id } = body

    if (!email || !department || !institution_id) throw new Error('Missing email, department, or institution_id')
    if (institution_id !== callerProfile.institution_id) throw new Error('Cross-institution invite denied')

    // Invite user via Supabase Admin Auth
    const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
    if (inviteError) throw new Error(inviteError.message)

    // Create or update their profile with dept admin role
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: invited.user.id,
        institution_id,
        role: 'department_admin',
        department,
      })

    if (profileError) throw new Error(profileError.message)

    return new Response(
      JSON.stringify({ success: true, user_id: invited.user.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
