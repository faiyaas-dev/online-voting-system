import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1"

// F-07: CORS scoped to app origin
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? '',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // F-08: Verify webhook secret — only Supabase DB webhooks should call this
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
    const authHeader = req.headers.get('Authorization')

    if (webhookSecret) {
      // If a webhook secret is configured, verify it
      if (!authHeader || authHeader !== `Bearer ${webhookSecret}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized: invalid webhook secret' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } else {
      // Fallback: verify the request comes with the service role key
      // This is less secure but works if webhook secret isn't set yet
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (!authHeader || !serviceKey || authHeader !== `Bearer ${serviceKey}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const payload = await req.json()
    // Triggered by Database Webhook on storage.objects INSERT
    if (payload.record?.bucket_id !== 'candidate-photos') {
      return new Response('ok')
    }
    
    const filePath = payload.record.name
    const contentType = payload.record.metadata?.mimetype

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const { data, error } = await supabaseAdmin.storage.from('candidate-photos').download(filePath)
    if (error || !data) throw new Error('Download failed')
    
    const arrayBuffer = await data.arrayBuffer()
    const view = new Uint8Array(arrayBuffer)
    
    let valid = false
    
    if (contentType === 'image/jpeg') {
      if (view[0] === 0xFF && view[1] === 0xD8 && view[2] === 0xFF) valid = true
    } else if (contentType === 'image/png') {
      if (view[0] === 0x89 && view[1] === 0x50 && view[2] === 0x4E && view[3] === 0x47 &&
          view[4] === 0x0D && view[5] === 0x0A && view[6] === 0x1A && view[7] === 0x0A) valid = true
    } else if (contentType === 'image/webp') {
      if (view.length > 11 && view[0] === 0x52 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x46 &&
          view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50) valid = true
    }
    
    if (!valid) {
      await supabaseAdmin.storage.from('candidate-photos').remove([filePath])
      console.warn(`Deleted invalid file ${filePath} matching type ${contentType}`)
    }
    
    return new Response(JSON.stringify({ valid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
