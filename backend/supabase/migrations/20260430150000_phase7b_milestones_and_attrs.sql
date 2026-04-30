-- ============================================================================
-- Phase 7B — Audit milestones + universal attribute columns
-- ============================================================================
-- * Universal optional attribute columns on progress_items (TYPE / SIZE / SPEC
--   / LINE_AREA) — populated where meaningful per audit type
-- * Admin-configurable per-discipline milestone templates with weights
-- * Per-item milestone progress (PCT per milestone)
-- * Trigger that recomputes progress_items.percent_complete from milestone
--   weighted sum whenever milestone progress changes
-- * Default milestone set seeded for every existing discipline + every new
--   discipline created via admin_create_project()
-- ============================================================================


-- ============================================================================
-- 1. Universal attribute columns (filter-only fields, populated optionally)
-- ============================================================================

ALTER TABLE progress_items
  ADD COLUMN IF NOT EXISTS attr_type text,
  ADD COLUMN IF NOT EXISTS attr_size text,
  ADD COLUMN IF NOT EXISTS attr_spec text,
  ADD COLUMN IF NOT EXISTS line_area text;

CREATE INDEX IF NOT EXISTS progress_items_line_area_idx ON progress_items (project_id, line_area);


-- ============================================================================
-- 2. Milestone tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_milestone_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discipline_id uuid NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
  name          text NOT NULL,
  weight        numeric NOT NULL DEFAULT 1 CHECK (weight >= 0),
  sort_order    int NOT NULL,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (discipline_id, name)
);
CREATE INDEX IF NOT EXISTS audit_milestone_templates_disc_idx
  ON audit_milestone_templates (discipline_id, sort_order);

CREATE TABLE IF NOT EXISTS progress_item_milestones (
  progress_item_id      uuid NOT NULL REFERENCES progress_items(id) ON DELETE CASCADE,
  milestone_template_id uuid NOT NULL REFERENCES audit_milestone_templates(id) ON DELETE CASCADE,
  project_id            uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  percent_complete      numeric NOT NULL DEFAULT 0
    CHECK (percent_complete >= 0 AND percent_complete <= 100),
  PRIMARY KEY (progress_item_id, milestone_template_id)
);
CREATE INDEX IF NOT EXISTS progress_item_milestones_project_idx
  ON progress_item_milestones (project_id);


-- ============================================================================
-- 3. RLS
-- ============================================================================

ALTER TABLE audit_milestone_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_item_milestones  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project Access" ON audit_milestone_templates;
CREATE POLICY "Project Access" ON audit_milestone_templates FOR ALL TO authenticated
  USING (
    discipline_id IN (
      SELECT id FROM disciplines WHERE user_can_access_project(project_id)
    )
  );

DROP POLICY IF EXISTS "Project Access" ON progress_item_milestones;
CREATE POLICY "Project Access" ON progress_item_milestones FOR ALL TO authenticated
  USING (user_can_access_project(project_id));


-- ============================================================================
-- 4. Recompute trigger — keep progress_items.percent_complete in sync
-- ============================================================================
-- When milestone progress changes, recompute the parent item's overall
-- percent_complete as Σ(weight × pct) / Σ(weight). Doesn't fire for items
-- that have no milestones (legacy / pre-7B data) — their percent_complete
-- stays whatever it was set to directly.

CREATE OR REPLACE FUNCTION recompute_item_percent_from_milestones()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_item_id uuid;
  v_pct numeric;
BEGIN
  v_item_id := COALESCE(NEW.progress_item_id, OLD.progress_item_id);

  SELECT ROUND(SUM(amt.weight * pim.percent_complete) / NULLIF(SUM(amt.weight), 0), 2)
    INTO v_pct
  FROM progress_item_milestones pim
  JOIN audit_milestone_templates amt ON amt.id = pim.milestone_template_id
  WHERE pim.progress_item_id = v_item_id;

  IF v_pct IS NOT NULL THEN
    UPDATE progress_items SET percent_complete = v_pct WHERE id = v_item_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS recompute_item_percent_trigger ON progress_item_milestones;
CREATE TRIGGER recompute_item_percent_trigger
  AFTER INSERT OR UPDATE OR DELETE ON progress_item_milestones
  FOR EACH ROW EXECUTE PROCEDURE recompute_item_percent_from_milestones();


-- ============================================================================
-- 5. Default milestone seeder + RPCs
-- ============================================================================
-- Industry-typical defaults for the six standard disciplines. seed_default_
-- milestones() inserts the appropriate set if the discipline name matches; for
-- any other name, it does nothing (admin can configure manually).

CREATE OR REPLACE FUNCTION seed_default_milestones(d_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  d_name text;
BEGIN
  SELECT name INTO d_name FROM disciplines WHERE id = d_id;

  IF d_name = 'Civil' THEN
    INSERT INTO audit_milestone_templates (discipline_id, name, weight, sort_order) VALUES
      (d_id, 'Excavation',          0.15, 1),
      (d_id, 'Formwork',            0.25, 2),
      (d_id, 'Rebar',               0.20, 3),
      (d_id, 'Concrete Placement',  0.25, 4),
      (d_id, 'Strip/Cure',          0.15, 5)
    ON CONFLICT (discipline_id, name) DO NOTHING;
  ELSIF d_name = 'Pipe' THEN
    INSERT INTO audit_milestone_templates (discipline_id, name, weight, sort_order) VALUES
      (d_id, 'Receive',             0.05, 1),
      (d_id, 'Stage',               0.05, 2),
      (d_id, 'Erect',               0.35, 3),
      (d_id, 'Connect',             0.35, 4),
      (d_id, 'Jeep/Trace',          0.20, 5)
    ON CONFLICT (discipline_id, name) DO NOTHING;
  ELSIF d_name = 'Steel' THEN
    INSERT INTO audit_milestone_templates (discipline_id, name, weight, sort_order) VALUES
      (d_id, 'Receive',             0.05, 1),
      (d_id, 'Shake Out',           0.05, 2),
      (d_id, 'PreAssemble',         0.20, 3),
      (d_id, 'Erect',               0.50, 4),
      (d_id, 'Bolt-Up',             0.20, 5)
    ON CONFLICT (discipline_id, name) DO NOTHING;
  ELSIF d_name = 'Electrical' THEN
    INSERT INTO audit_milestone_templates (discipline_id, name, weight, sort_order) VALUES
      (d_id, 'Receive Materials',   0.10, 1),
      (d_id, 'Run Conduit',         0.25, 2),
      (d_id, 'Pull Cable',          0.30, 3),
      (d_id, 'Terminate',           0.25, 4),
      (d_id, 'Test',                0.10, 5)
    ON CONFLICT (discipline_id, name) DO NOTHING;
  ELSIF d_name = 'Mechanical' THEN
    INSERT INTO audit_milestone_templates (discipline_id, name, weight, sort_order) VALUES
      (d_id, 'Prep FDN',            0.20, 1),
      (d_id, 'Receive',             0.05, 2),
      (d_id, 'Set',                 0.25, 3),
      (d_id, 'Pre Align',           0.15, 4),
      (d_id, 'Pipe Align',          0.20, 5),
      (d_id, 'Final Align',         0.15, 6)
    ON CONFLICT (discipline_id, name) DO NOTHING;
  ELSIF d_name = 'Instrumentation' THEN
    INSERT INTO audit_milestone_templates (discipline_id, name, weight, sort_order) VALUES
      (d_id, 'Receive',             0.10, 1),
      (d_id, 'Calibrate/Spec Check',0.20, 2),
      (d_id, 'Stand',               0.20, 3),
      (d_id, 'Install Device',      0.25, 4),
      (d_id, 'Loop Check',          0.25, 5)
    ON CONFLICT (discipline_id, name) DO NOTHING;
  END IF;
END;
$$;

-- Backfill: seed defaults for all existing disciplines on the LNG fixture project
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM disciplines LOOP
    PERFORM seed_default_milestones(r.id);
  END LOOP;
END$$;


-- Updated admin_create_project that also seeds milestone defaults for new disciplines
DROP FUNCTION IF EXISTS admin_create_project(text, date, date);
CREATE OR REPLACE FUNCTION admin_create_project(
  p_name text,
  p_planned_start date DEFAULT NULL,
  p_planned_end date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_project_id uuid;
  v_tenant_id uuid;
  r record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'tenant_admin') THEN
    RAISE EXCEPTION 'Access denied. Tenant admin only.';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Project name required.';
  END IF;

  SELECT tenant_id INTO v_tenant_id FROM app_users WHERE id = auth.uid();

  INSERT INTO projects (name, tenant_id, planned_start, planned_end, status)
  VALUES (trim(p_name), v_tenant_id, p_planned_start, p_planned_end, 'active')
  RETURNING id INTO v_project_id;

  INSERT INTO disciplines (project_id, name, code) VALUES
    (v_project_id, 'Civil',           'CIV'),
    (v_project_id, 'Pipe',            'PIP'),
    (v_project_id, 'Steel',           'STR'),
    (v_project_id, 'Electrical',      'ELE'),
    (v_project_id, 'Mechanical',      'MEC'),
    (v_project_id, 'Instrumentation', 'INS');

  FOR r IN SELECT id FROM disciplines WHERE project_id = v_project_id LOOP
    PERFORM seed_default_milestones(r.id);
  END LOOP;

  RETURN v_project_id;
END;
$$;


-- ============================================================================
-- 6. Importer helper RPCs (called by edge function during ingestion)
-- ============================================================================

-- Look up an existing milestone template, or auto-create one with weight=1
-- (admin can rebalance via the Milestones UI). Used by the importer when an
-- xlsx introduces a previously-unseen milestone name for a discipline.
CREATE OR REPLACE FUNCTION ensure_milestone_template(d_id uuid, p_name text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
  v_max_sort int;
BEGIN
  IF d_id IS NULL OR p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'discipline_id and name required';
  END IF;

  SELECT id INTO v_id FROM audit_milestone_templates
   WHERE discipline_id = d_id AND name = p_name;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_max_sort
  FROM audit_milestone_templates WHERE discipline_id = d_id;

  INSERT INTO audit_milestone_templates (discipline_id, name, weight, sort_order)
  VALUES (d_id, p_name, 1, v_max_sort)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Bulk-write milestone progress for a single item. Called by the edge function
-- after upserting the parent progress_items row.
CREATE OR REPLACE FUNCTION upsert_item_milestones(
  p_item_id uuid,
  p_project_id uuid,
  p_milestones jsonb  -- [{name, pct}, ...]
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_d_id uuid;
  v_template_id uuid;
  v_m jsonb;
BEGIN
  IF NOT user_can_access_project(p_project_id) THEN
    RAISE EXCEPTION 'Access denied for project %', p_project_id;
  END IF;

  SELECT discipline_id INTO v_d_id FROM progress_items WHERE id = p_item_id;
  IF v_d_id IS NULL THEN RETURN; END IF;

  FOR v_m IN SELECT * FROM jsonb_array_elements(p_milestones) LOOP
    v_template_id := ensure_milestone_template(v_d_id, v_m->>'name');
    INSERT INTO progress_item_milestones (
      progress_item_id, milestone_template_id, project_id, percent_complete
    ) VALUES (
      p_item_id, v_template_id, p_project_id,
      COALESCE((v_m->>'pct')::numeric, 0)
    )
    ON CONFLICT (progress_item_id, milestone_template_id) DO UPDATE
      SET percent_complete = EXCLUDED.percent_complete;
  END LOOP;
END;
$$;


-- ============================================================================
-- 7. Admin RPCs for Milestones tab
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_get_milestones(d_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  weight numeric,
  sort_order int
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE v_p_id uuid;
BEGIN
  SELECT project_id INTO v_p_id FROM disciplines WHERE id = d_id;
  IF NOT user_can_access_project(v_p_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT t.id, t.name, t.weight, t.sort_order
  FROM audit_milestone_templates t
  WHERE t.discipline_id = d_id
  ORDER BY t.sort_order;
END;
$$;

-- Replaces the milestone set for a discipline atomically.
-- p_milestones: [{name, weight, sort_order}, ...]
-- Existing templates are matched by name (preserves their id, so existing
-- progress_item_milestones rows survive the rename of weights/order). Any
-- template whose name is not in the new list is deleted (cascades to
-- progress_item_milestones rows; the recompute trigger refreshes parent
-- items' percent_complete).
CREATE OR REPLACE FUNCTION admin_set_milestones(
  d_id uuid,
  p_milestones jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_p_id uuid;
  v_m jsonb;
  v_keep_names text[];
BEGIN
  SELECT project_id INTO v_p_id FROM disciplines WHERE id = d_id;
  IF NOT (
    EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'tenant_admin')
    OR EXISTS (SELECT 1 FROM project_members
               WHERE user_id = auth.uid() AND project_id = v_p_id AND role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Project admin or tenant admin only.';
  END IF;

  -- Validate
  FOR v_m IN SELECT * FROM jsonb_array_elements(p_milestones) LOOP
    IF v_m->>'name' IS NULL OR length(trim(v_m->>'name')) = 0 THEN
      RAISE EXCEPTION 'Milestone name required';
    END IF;
    IF (v_m->>'weight')::numeric < 0 THEN
      RAISE EXCEPTION 'Weights must be non-negative';
    END IF;
  END LOOP;

  -- Collect names to keep
  SELECT array_agg(trim(value->>'name')) INTO v_keep_names
  FROM jsonb_array_elements(p_milestones);

  -- Delete templates not in the new list
  DELETE FROM audit_milestone_templates
   WHERE discipline_id = d_id
     AND name <> ALL (v_keep_names);

  -- Upsert each milestone (matched on name)
  FOR v_m IN SELECT * FROM jsonb_array_elements(p_milestones) LOOP
    INSERT INTO audit_milestone_templates (discipline_id, name, weight, sort_order)
    VALUES (
      d_id,
      trim(v_m->>'name'),
      (v_m->>'weight')::numeric,
      (v_m->>'sort_order')::int
    )
    ON CONFLICT (discipline_id, name) DO UPDATE
      SET weight = EXCLUDED.weight,
          sort_order = EXCLUDED.sort_order;
  END LOOP;

  -- Trigger a percent recompute for every item under this discipline
  -- (weights changed → composite changes). Touch a sentinel milestone row
  -- per item to fire the trigger.
  UPDATE progress_item_milestones pim
     SET percent_complete = pim.percent_complete
   WHERE pim.progress_item_id IN (
     SELECT id FROM progress_items WHERE discipline_id = d_id
   );
END;
$$;
