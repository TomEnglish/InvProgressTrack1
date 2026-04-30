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
    const weekEnding: string | null = rawPayload.weekEnding ?? null
    const label: string = rawPayload.label?.trim() ||
      `Snapshot ${weekEnding ?? new Date().toISOString().slice(0, 10)}`
    const sourceFilename: string | null = rawPayload.sourceFilename ?? null

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

    const { data: snapId, error: rpcError } = await supabaseClient.rpc('create_period_snapshot', {
      p_id: projectId,
      p_label: label,
      p_week_ending: weekEnding,
      p_source_filename: sourceFilename
    })

    if (rpcError) throw rpcError

    return new Response(JSON.stringify({
      success: true,
      count: items.length,
      snapshotId: snapId,
      label
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
