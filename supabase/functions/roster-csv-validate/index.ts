import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1"
import { parse } from "https://esm.sh/csv-parse@5.5.0/sync"

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')
    const token = authHeader.replace('Bearer ', '')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify user from token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) throw new Error('Unauthorized')

    // Parse multipart form
    const formData = await req.formData()
    const institutionId = formData.get('institution_id') as string
    const file = formData.get('file') as File
    
    if (!institutionId || !file) {
      throw new Error('Missing institution_id or file parameter')
    }

    // Verify caller is institution_admin for this institution
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, institution_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'institution_admin' || profile.institution_id !== institutionId) {
      throw new Error('Access denied: institution_admin role required for this institution')
    }

    const fileContent = await file.text()
    
    // Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    })

    const validRows = []
    const errorRows = []
    
    const seenEmails = new Set()
    const seenRollNos = new Set()

    for (let i = 0; i < records.length; i++) {
      const row = records[i]
      const actualRowNum = i + 2 // Assuming header is row 1
      let errorReason = null

      const email = row.email?.trim()
      const department = row.department?.trim()
      const roll_no = row.roll_no?.trim()
      const year = parseInt(row.year, 10)
      const full_name = row.full_name?.trim()

      if (!email) errorReason = 'missing_email'
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errorReason = 'invalid_email_format'
      else if (!department) errorReason = 'missing_department'
      else if (!roll_no) errorReason = 'missing_roll_no'
      else if (isNaN(year)) errorReason = 'invalid_year'
      else if (seenEmails.has(email.toLowerCase())) errorReason = 'duplicate_email_in_batch'
      else if (seenRollNos.has(roll_no.toLowerCase())) errorReason = 'duplicate_roll_no_in_batch'

      if (errorReason) {
        errorRows.push({
          institution_id: institutionId,
          row_number: actualRowNum,
          raw_row: row,
          error_reason: errorReason
        })
      } else {
        seenEmails.add(email.toLowerCase())
        seenRollNos.add(roll_no.toLowerCase())
        validRows.push({
          institution_id: institutionId,
          email,
          department,
          roll_no,
          year,
          full_name: full_name || null
        })
      }
    }

    // Insert valid rows
    let inserted = 0
    if (validRows.length > 0) {
      const { data, error: insertError } = await supabaseAdmin
        .from('roster')
        .upsert(validRows, { onConflict: 'institution_id, email', ignoreDuplicates: false })
        .select()
        
      if (insertError) {
        // Find duplicate_email_existing issues or general errors
        throw new Error('Database insert failed: ' + insertError.message)
      }
      inserted = validRows.length
    }

    // Insert error rows
    if (errorRows.length > 0) {
      await supabaseAdmin.from('roster_import_errors').insert(errorRows)
    }

    return new Response(
      JSON.stringify({
        inserted,
        errors: errorRows.length,
        error_details: errorRows.map(e => ({ row_number: e.row_number, error_reason: e.error_reason }))
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
