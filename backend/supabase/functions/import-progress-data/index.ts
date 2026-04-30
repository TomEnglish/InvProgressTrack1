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

    // Resolve iwp_name -> iwp_id, auto-creating iwps rows where needed.
    const iwpCache = new Map<string, string>()
    const ensureIwp = async (name: string, disciplineId?: string): Promise<string> => {
      const key = `${disciplineId ?? ''}::${name}`
      const cached = iwpCache.get(key)
      if (cached) return cached
      const { data: existing, error: selErr } = await supabaseClient
        .from('iwps')
        .select('id')
        .eq('project_id', projectId)
        .eq('name', name)
        .maybeSingle()
      if (selErr) throw selErr
      if (existing?.id) {
        iwpCache.set(key, existing.id)
        return existing.id
      }
      const { data: inserted, error: insErr } = await supabaseClient
        .from('iwps')
        .insert({ project_id: projectId, discipline_id: disciplineId ?? null, name })
        .select('id')
        .single()
      if (insErr) throw insErr
      iwpCache.set(key, inserted.id)
      return inserted.id
    }

    // Stage items with iwp_id resolved.
    const stagedItems: any[] = []
    for (const item of items) {
      let iwpId: string | null = null
      if (item.iwp_name) {
        iwpId = await ensureIwp(item.iwp_name, item.discipline_id)
      }
      stagedItems.push({
        project_id: projectId,
        discipline_id: item.discipline_id ?? null,
        iwp_id: iwpId,
        dwg: item.dwg ?? null,
        name: item.name ?? null,
        budget_hrs: item.budget_hrs,
        actual_hrs: item.actual_hrs,
        percent_complete: item.percent_complete,
        unit: item.unit,
        budget_qty: item.budget_qty,
        actual_qty: item.actual_qty,
        foreman_name: item.foreman_name,
        attr_type: item.attr_type,
        attr_size: item.attr_size,
        attr_spec: item.attr_spec,
        line_area: item.line_area,
        _milestones: item.milestones ?? [],
      })
    }

    // Insert items, capture returned ids in input order.
    const upsertPayload = stagedItems.map(({ _milestones, ...row }) => row)
    const { data: insertedRows, error: insertError } = await supabaseClient
      .from('progress_items')
      .insert(upsertPayload)
      .select('id')

    if (insertError) throw insertError
    if (!insertedRows || insertedRows.length !== stagedItems.length) {
      throw new Error(`Insert returned ${insertedRows?.length ?? 0} rows, expected ${stagedItems.length}`)
    }

    // Write per-item milestone rows for any items that have them.
    let milestoneCount = 0
    for (let i = 0; i < stagedItems.length; i++) {
      const milestones = stagedItems[i]._milestones as { name: string; pct: number }[]
      if (!milestones || milestones.length === 0) continue
      const itemId = insertedRows[i].id
      const { error: mErr } = await supabaseClient.rpc('upsert_item_milestones', {
        p_item_id: itemId,
        p_project_id: projectId,
        p_milestones: milestones,
      })
      if (mErr) throw mErr
      milestoneCount += milestones.length
    }

    // Period snapshot (auto-captures 1st-audit baseline on first call per project).
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
      milestoneCount,
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
