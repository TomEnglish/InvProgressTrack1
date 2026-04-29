import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6"
import { validatePayload } from "./parser.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: { headers: { Authorization: req.headers.get('Authorization')! } },
      }
    )

    const rawPayload = await req.json()
    const { projectId, items } = validatePayload(rawPayload)

    // 1. Validate permissions
    // Supabase JS client authenticates strictly out of the box via the user's Authorization header,
    // so any inserts here conform strictly to Row Level Security constraints (tenant/project).

    // 2. Perform bulk upsert or insert
    const { error: insertError } = await supabaseClient
      .from('progress_items')
      .upsert(
        items.map((item: any) => ({
          project_id: projectId,
          discipline_id: item.discipline_id,
          dwg: item.dwg,
          budget_hrs: item.budget_hrs,
          actual_hrs: item.actual_hrs,
          percent_complete: item.percent_complete,
          unit: item.unit,
          budget_qty: item.budget_qty,
          actual_qty: item.actual_qty,
          foreman_name: item.foreman_name
        }))
      )

    if (insertError) throw insertError

    // 3. Kick off period snapshot generation synchronously (optional, can be done separated)
    const label = `Import generated snapshot - ${new Date().toISOString()}`
    const { error: rpcError } = await supabaseClient.rpc('create_period_snapshot', {
      p_id: projectId,
      p_label: label
    })

    if (rpcError) throw rpcError

    return new Response(JSON.stringify({ success: true, count: items.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
