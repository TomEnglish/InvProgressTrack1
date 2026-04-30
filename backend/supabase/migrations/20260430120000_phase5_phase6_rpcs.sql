-- ============================================================================
-- Phase 5 / Phase 6 RPCs
-- ============================================================================
-- * Extends get_period_comparison with baseline (1st-audit) columns:
--   baseline_pct, baseline_hrs, drift_vs_baseline_pct, drift_vs_baseline_hrs
-- * Foreman reconciliation: list unmatched names, register/remove aliases
-- ============================================================================


-- 1. get_period_comparison — add baseline-vs columns
DROP FUNCTION IF EXISTS get_period_comparison(uuid, uuid, uuid, uuid);
CREATE OR REPLACE FUNCTION get_period_comparison(
  p_id uuid,
  prev_snap_id uuid,
  curr_snap_id uuid,
  filter_discipline_id uuid DEFAULT NULL
)
RETURNS TABLE (
  progress_item_id uuid,
  discipline_id uuid,
  discipline_name text,
  iwp_id uuid,
  iwp_name text,
  dwg text,
  description text,
  foreman_user_id uuid,
  foreman_name text,
  prev_pct numeric,
  curr_pct numeric,
  delta_pct numeric,
  prev_hrs numeric,
  curr_hrs numeric,
  delta_hrs numeric,
  prev_qty numeric,
  curr_qty numeric,
  delta_qty numeric,
  baseline_pct numeric,
  baseline_hrs numeric,
  drift_vs_baseline_pct numeric,
  drift_vs_baseline_hrs numeric,
  movement text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_baseline_id uuid;
BEGIN
  IF NOT user_can_access_project(p_id) THEN
    RAISE EXCEPTION 'Access denied for project %', p_id;
  END IF;

  SELECT id INTO v_baseline_id
  FROM period_snapshots
  WHERE project_id = p_id AND kind = 'baseline_first_audit';

  RETURN QUERY
  SELECT
    pi.id,
    d.id, d.name,
    iw.id, iw.name,
    pi.dwg, pi.name,
    pi.foreman_user_id, pi.foreman_name,
    prev.percent_complete, curr.percent_complete,
    COALESCE(curr.percent_complete, 0) - COALESCE(prev.percent_complete, 0),
    prev.earned_hrs, curr.earned_hrs,
    COALESCE(curr.earned_hrs, 0) - COALESCE(prev.earned_hrs, 0),
    prev.earned_qty, curr.earned_qty,
    COALESCE(curr.earned_qty, 0) - COALESCE(prev.earned_qty, 0),
    base.percent_complete,
    base.earned_hrs,
    CASE WHEN base.percent_complete IS NULL THEN NULL
         ELSE COALESCE(curr.percent_complete, 0) - base.percent_complete END,
    CASE WHEN base.earned_hrs IS NULL THEN NULL
         ELSE COALESCE(curr.earned_hrs, 0) - base.earned_hrs END,
    CASE
      WHEN COALESCE(curr.percent_complete, 0) > COALESCE(prev.percent_complete, 0) THEN 'up'
      WHEN COALESCE(curr.percent_complete, 0) < COALESCE(prev.percent_complete, 0) THEN 'down'
      ELSE 'flat'
    END
  FROM progress_items pi
  LEFT JOIN disciplines d ON d.id = pi.discipline_id
  LEFT JOIN iwps iw ON iw.id = pi.iwp_id
  LEFT JOIN period_snapshot_items prev
         ON prev.snapshot_id = prev_snap_id AND prev.progress_item_id = pi.id
  LEFT JOIN period_snapshot_items curr
         ON curr.snapshot_id = curr_snap_id AND curr.progress_item_id = pi.id
  LEFT JOIN period_snapshot_items base
         ON base.snapshot_id = v_baseline_id AND base.progress_item_id = pi.id
  WHERE pi.project_id = p_id
    AND (filter_discipline_id IS NULL OR pi.discipline_id = filter_discipline_id)
  ORDER BY d.name, iw.name NULLS LAST, pi.dwg;
END;
$$;


-- 2. admin_list_unmatched_foremen — distinct unmatched foreman_name values per tenant
CREATE OR REPLACE FUNCTION admin_list_unmatched_foremen()
RETURNS TABLE (
  foreman_name text,
  row_count bigint,
  project_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'tenant_admin') THEN
    RAISE EXCEPTION 'Access denied. Tenant admin only.';
  END IF;
  SELECT tenant_id INTO v_tenant_id FROM app_users WHERE id = auth.uid();

  RETURN QUERY
  SELECT
    pi.foreman_name,
    COUNT(*)::bigint,
    COUNT(DISTINCT pi.project_id)::bigint
  FROM progress_items pi
  JOIN projects p ON p.id = pi.project_id
  WHERE pi.foreman_user_id IS NULL
    AND pi.foreman_name IS NOT NULL
    AND p.tenant_id = v_tenant_id
  GROUP BY pi.foreman_name
  ORDER BY COUNT(*) DESC, pi.foreman_name;
END;
$$;


-- 3. admin_link_foreman_alias — register a name->user_id alias (tenant_admin only)
--    Inserts/updates the alias; the existing foreman_aliases AFTER trigger
--    backfills any existing items whose foreman_name matches.
CREATE OR REPLACE FUNCTION admin_link_foreman_alias(
  p_name text,
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'tenant_admin') THEN
    RAISE EXCEPTION 'Access denied. Tenant admin only.';
  END IF;
  SELECT tenant_id INTO v_tenant_id FROM app_users WHERE id = auth.uid();

  -- Target user must be in caller's tenant
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE id = p_user_id AND tenant_id = v_tenant_id) THEN
    RAISE EXCEPTION 'Target user is not in your tenant.';
  END IF;

  INSERT INTO foreman_aliases (name, user_id)
  VALUES (p_name, p_user_id)
  ON CONFLICT (name) DO UPDATE SET user_id = EXCLUDED.user_id;
END;
$$;


-- 4. admin_unlink_foreman_alias — remove an alias (tenant_admin only)
CREATE OR REPLACE FUNCTION admin_unlink_foreman_alias(p_name text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'tenant_admin') THEN
    RAISE EXCEPTION 'Access denied. Tenant admin only.';
  END IF;
  SELECT tenant_id INTO v_tenant_id FROM app_users WHERE id = auth.uid();

  -- Only allow removing aliases pointing to users in caller's tenant
  DELETE FROM foreman_aliases
  WHERE name = p_name
    AND user_id IN (SELECT id FROM app_users WHERE tenant_id = v_tenant_id);

  -- Clear foreman_user_id on items whose name matches (let next import re-resolve)
  UPDATE progress_items SET foreman_user_id = NULL
  WHERE foreman_name = p_name AND project_id IN (SELECT id FROM projects WHERE tenant_id = v_tenant_id);
END;
$$;
