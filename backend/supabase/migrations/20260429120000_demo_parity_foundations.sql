-- ============================================================================
-- Demo Parity Foundations
-- ============================================================================
-- Spec: DEMO_PARITY_SPEC.md (Phase 1)
--
-- Adds:
--   * project_members + dual-tier auth (tenant_admin / project admin / editor / viewer)
--   * Earned QTY columns + per-row units + project-level qty rollup mode/weights
--   * Foreman hybrid (foreman_user_id + foreman_name + foreman_aliases)
--   * Per-item period snapshots (period_snapshot_items)
--   * Dual baseline plumbing (period_snapshots.kind, week_ending, source metadata)
--   * Mechanical + Instrumentation disciplines (rename Piping->Pipe, Structural->Steel)
--   * RPC access guards via user_can_access_project()
--   * New RPCs (list_my_projects, list_snapshots, get_period_comparison,
--     get_project_qty_rollup, get_discipline_curve, project membership admin)
-- ============================================================================


-- ============================================================================
-- 1. Schema additions
-- ============================================================================

-- 1.1 progress_items: qty + unit + foreman columns
ALTER TABLE progress_items
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS budget_qty numeric,
  ADD COLUMN IF NOT EXISTS actual_qty numeric,
  ADD COLUMN IF NOT EXISTS foreman_user_id uuid REFERENCES app_users(id),
  ADD COLUMN IF NOT EXISTS foreman_name text;

UPDATE progress_items SET unit = 'HRS' WHERE unit IS NULL;
ALTER TABLE progress_items ALTER COLUMN unit SET NOT NULL;

ALTER TABLE progress_items
  ADD COLUMN IF NOT EXISTS earned_qty numeric
  GENERATED ALWAYS AS (budget_qty * percent_complete / 100.0) STORED;

CREATE INDEX IF NOT EXISTS progress_items_foreman_user_idx
  ON progress_items (project_id, foreman_user_id);
CREATE INDEX IF NOT EXISTS progress_items_foreman_name_idx
  ON progress_items (project_id, foreman_name);

-- 1.2 projects: qty rollup mode (default hours_weighted)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS qty_rollup_mode text NOT NULL DEFAULT 'hours_weighted'
    CHECK (qty_rollup_mode IN ('hours_weighted','equal','custom'));

-- 1.3 period_snapshots: dual-baseline + ingestion metadata + frozen composite
ALTER TABLE period_snapshots
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'weekly'
    CHECK (kind IN ('weekly','baseline_first_audit')),
  ADD COLUMN IF NOT EXISTS week_ending date,
  ADD COLUMN IF NOT EXISTS source_filename text,
  ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES app_users(id),
  ADD COLUMN IF NOT EXISTS uploaded_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS composite_pct_qty numeric;

CREATE UNIQUE INDEX IF NOT EXISTS one_first_audit_per_project
  ON period_snapshots (project_id) WHERE kind = 'baseline_first_audit';

-- 1.4 New tables

CREATE TABLE IF NOT EXISTS foreman_aliases (
  name text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_members (
  user_id    uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('admin','editor','viewer')) DEFAULT 'viewer',
  added_by   uuid REFERENCES app_users(id),
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id)
);
CREATE INDEX IF NOT EXISTS project_members_project_idx ON project_members (project_id);

CREATE TABLE IF NOT EXISTS project_discipline_weights (
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  discipline_id uuid NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
  weight        numeric NOT NULL CHECK (weight >= 0 AND weight <= 1),
  PRIMARY KEY (project_id, discipline_id)
);

CREATE TABLE IF NOT EXISTS period_snapshot_items (
  snapshot_id      uuid NOT NULL REFERENCES period_snapshots(id) ON DELETE CASCADE,
  progress_item_id uuid NOT NULL REFERENCES progress_items(id),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  percent_complete numeric,
  earned_hrs       numeric,
  earned_qty       numeric,
  actual_hrs       numeric,
  actual_qty       numeric,
  PRIMARY KEY (snapshot_id, progress_item_id)
);
CREATE INDEX IF NOT EXISTS period_snapshot_items_project_idx
  ON period_snapshot_items (project_id);
CREATE INDEX IF NOT EXISTS period_snapshot_items_progress_item_idx
  ON period_snapshot_items (progress_item_id);

-- 1.5 Discipline label parity (rename Piping->Pipe, Structural->Steel)
UPDATE disciplines SET name = 'Pipe'  WHERE name = 'Piping';
UPDATE disciplines SET name = 'Steel' WHERE name = 'Structural';

-- 1.6 Add Mechanical + Instrumentation to existing fixture project (idempotent)
INSERT INTO disciplines (id, project_id, name, code)
SELECT 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', p.id, 'Mechanical', 'MEC'
FROM projects p WHERE p.id = '550e8400-e29b-41d4-a716-446655440000'
ON CONFLICT (id) DO NOTHING;

INSERT INTO disciplines (id, project_id, name, code)
SELECT 'ffffffff-ffff-ffff-ffff-ffffffffffff', p.id, 'Instrumentation', 'INS'
FROM projects p WHERE p.id = '550e8400-e29b-41d4-a716-446655440000'
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 2. Auth/role rename + handle_new_user trigger update
-- ============================================================================

UPDATE app_users SET role = 'tenant_admin' WHERE role = 'admin';
UPDATE app_users SET role = 'member'       WHERE role = 'viewer';

ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users
  ADD CONSTRAINT app_users_role_check CHECK (role IN ('tenant_admin','member'));
ALTER TABLE app_users ALTER COLUMN role SET DEFAULT 'member';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.app_users (id, tenant_id, role)
  VALUES (new.id, '11111111-1111-1111-1111-111111111111', 'tenant_admin');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill: existing 'member' users get viewer access to every project in their
-- tenant, preserving prior "see everything" UX. Tenant admins inherit access.
INSERT INTO project_members (user_id, project_id, role, added_by, added_at)
SELECT u.id, p.id, 'viewer', NULL, now()
FROM app_users u
JOIN projects p ON p.tenant_id = u.tenant_id
WHERE u.role = 'member'
ON CONFLICT (user_id, project_id) DO NOTHING;


-- ============================================================================
-- 3. Authorization helper + RLS overhaul
-- ============================================================================

CREATE OR REPLACE FUNCTION user_can_access_project(p_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_users u
    WHERE u.id = auth.uid()
      AND u.role = 'tenant_admin'
      AND u.tenant_id = (SELECT tenant_id FROM projects WHERE id = p_id)
  )
  OR EXISTS (
    SELECT 1 FROM project_members
    WHERE user_id = auth.uid() AND project_id = p_id
  );
$$;

DROP POLICY IF EXISTS "Tenant Isolation" ON projects;
DROP POLICY IF EXISTS "Tenant Isolation" ON disciplines;
DROP POLICY IF EXISTS "Tenant Isolation" ON iwps;
DROP POLICY IF EXISTS "Tenant Isolation" ON progress_items;
DROP POLICY IF EXISTS "Tenant Isolation" ON period_snapshots;

CREATE POLICY "Project Access" ON projects
  FOR ALL TO authenticated
  USING (tenant_id = get_auth_tenant_id() AND user_can_access_project(id));

CREATE POLICY "Project Access" ON disciplines
  FOR ALL TO authenticated
  USING (user_can_access_project(project_id));

CREATE POLICY "Project Access" ON iwps
  FOR ALL TO authenticated
  USING (user_can_access_project(project_id));

CREATE POLICY "Project Access" ON progress_items
  FOR ALL TO authenticated
  USING (user_can_access_project(project_id));

CREATE POLICY "Project Access" ON period_snapshots
  FOR ALL TO authenticated
  USING (user_can_access_project(project_id));

ALTER TABLE project_members            ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_discipline_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_snapshot_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE foreman_aliases            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Project Member Visibility" ON project_members;
CREATE POLICY "Project Member Visibility" ON project_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM app_users u
      WHERE u.id = auth.uid()
        AND u.role = 'tenant_admin'
        AND u.tenant_id = (SELECT tenant_id FROM projects WHERE id = project_members.project_id)
    )
    OR EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.user_id = auth.uid()
        AND pm.project_id = project_members.project_id
        AND pm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Project Access" ON project_discipline_weights;
CREATE POLICY "Project Access" ON project_discipline_weights
  FOR ALL TO authenticated
  USING (user_can_access_project(project_id));

DROP POLICY IF EXISTS "Project Access" ON period_snapshot_items;
CREATE POLICY "Project Access" ON period_snapshot_items
  FOR ALL TO authenticated
  USING (user_can_access_project(project_id));

DROP POLICY IF EXISTS "Foreman Alias Visibility" ON foreman_aliases;
CREATE POLICY "Foreman Alias Visibility" ON foreman_aliases
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM app_users a, app_users target
      WHERE a.id = auth.uid()
        AND a.role = 'tenant_admin'
        AND target.id = foreman_aliases.user_id
        AND a.tenant_id = target.tenant_id
    )
  );


-- ============================================================================
-- 4. Helper: composite qty rollup (private; called by snapshot creation + rollup RPC)
-- ============================================================================

CREATE OR REPLACE FUNCTION compute_project_qty_composite(p_id uuid)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_mode text;
  v_composite numeric;
BEGIN
  SELECT qty_rollup_mode INTO v_mode FROM projects WHERE id = p_id;

  WITH disc AS (
    SELECT
      d.id AS discipline_id,
      COALESCE(SUM(pi.budget_hrs), 0) AS budget_hrs,
      COALESCE(SUM(pi.budget_qty), 0) AS budget_qty,
      COALESCE(SUM(pi.earned_qty), 0) AS earned_qty,
      CASE WHEN COALESCE(SUM(pi.budget_qty), 0) = 0 THEN NULL
           ELSE SUM(pi.earned_qty) / SUM(pi.budget_qty) END AS pct_qty
    FROM disciplines d
    LEFT JOIN progress_items pi ON pi.discipline_id = d.id
    WHERE d.project_id = p_id
    GROUP BY d.id
  ),
  total_hrs AS (SELECT SUM(budget_hrs) AS h FROM disc),
  weighted AS (
    SELECT
      disc.discipline_id,
      disc.pct_qty,
      CASE v_mode
        WHEN 'hours_weighted' THEN
          CASE WHEN COALESCE((SELECT h FROM total_hrs), 0) = 0 THEN 0
               ELSE disc.budget_hrs / (SELECT h FROM total_hrs) END
        WHEN 'equal' THEN
          CASE WHEN (SELECT COUNT(*) FROM disc) = 0 THEN 0
               ELSE 1.0 / (SELECT COUNT(*) FROM disc) END
        WHEN 'custom' THEN
          COALESCE(
            (SELECT pdw.weight FROM project_discipline_weights pdw
              WHERE pdw.project_id = p_id AND pdw.discipline_id = disc.discipline_id),
            0
          )
        ELSE 0
      END AS weight
    FROM disc
  )
  SELECT ROUND(SUM(weight * COALESCE(pct_qty, 0)) * 100, 2)
    INTO v_composite
  FROM weighted;

  RETURN COALESCE(v_composite, 0);
END;
$$;


-- ============================================================================
-- 5. Modified existing RPCs (access guards + qty fields + per-item snapshots)
-- ============================================================================

-- 5.1 get_project_metrics: access guard added; signature unchanged
CREATE OR REPLACE FUNCTION get_project_metrics(p_id uuid)
RETURNS TABLE (
  total_budget numeric,
  total_earned numeric,
  total_actual numeric,
  cpi numeric,
  spi numeric,
  sv numeric,
  percent_complete numeric,
  total_items integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  IF NOT user_can_access_project(p_id) THEN
    RAISE EXCEPTION 'Access denied for project %', p_id;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(SUM(budget_hrs), 0) AS total_budget,
    COALESCE(SUM(earned_hrs), 0) AS total_earned,
    COALESCE(SUM(actual_hrs), 0) AS total_actual,
    CASE WHEN SUM(actual_hrs) = 0 THEN 0
         ELSE ROUND(SUM(earned_hrs) / SUM(actual_hrs), 2) END AS cpi,
    CASE WHEN SUM(budget_hrs) = 0 THEN 0
         ELSE ROUND(SUM(earned_hrs) / SUM(budget_hrs), 2) END AS spi,
    COALESCE(SUM(earned_hrs), 0) - COALESCE(SUM(budget_hrs), 0) AS sv,
    CASE WHEN SUM(budget_hrs) = 0 THEN 0
         ELSE ROUND((SUM(earned_hrs) / SUM(budget_hrs)) * 100, 2) END AS percent_complete,
    COUNT(*)::integer AS total_items
  FROM progress_items
  WHERE project_id = p_id;
END;
$$;

-- 5.2 get_discipline_metrics: qty + unit fields added; access guard added.
--     Drop first because the column list of the returned table changed.
DROP FUNCTION IF EXISTS get_discipline_metrics(uuid);
CREATE OR REPLACE FUNCTION get_discipline_metrics(p_id uuid)
RETURNS TABLE (
  discipline_id uuid,
  discipline_name text,
  unit text,
  total_budget numeric,
  total_earned numeric,
  total_actual numeric,
  total_budget_qty numeric,
  total_earned_qty numeric,
  total_actual_qty numeric,
  percent_complete numeric,
  percent_complete_qty numeric,
  total_items integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  IF NOT user_can_access_project(p_id) THEN
    RAISE EXCEPTION 'Access denied for project %', p_id;
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.name,
    (SELECT pi2.unit FROM progress_items pi2
       WHERE pi2.discipline_id = d.id AND pi2.unit IS NOT NULL LIMIT 1) AS unit,
    COALESCE(SUM(p.budget_hrs), 0),
    COALESCE(SUM(p.earned_hrs), 0),
    COALESCE(SUM(p.actual_hrs), 0),
    COALESCE(SUM(p.budget_qty), 0),
    COALESCE(SUM(p.earned_qty), 0),
    COALESCE(SUM(p.actual_qty), 0),
    CASE WHEN SUM(p.budget_hrs) = 0 THEN 0
         ELSE ROUND((SUM(p.earned_hrs) / SUM(p.budget_hrs)) * 100, 2) END,
    CASE WHEN COALESCE(SUM(p.budget_qty), 0) = 0 THEN NULL
         ELSE ROUND((SUM(p.earned_qty) / SUM(p.budget_qty)) * 100, 2) END,
    COUNT(p.id)::integer
  FROM disciplines d
  LEFT JOIN progress_items p ON p.discipline_id = d.id
  WHERE d.project_id = p_id
  GROUP BY d.id, d.name
  ORDER BY d.name;
END;
$$;

-- 5.3 create_period_snapshot: writes header + per-item rows + freezes composite.
--     On a project's first call, also writes a baseline_first_audit copy.
DROP FUNCTION IF EXISTS create_period_snapshot(uuid, text);
CREATE OR REPLACE FUNCTION create_period_snapshot(
  p_id uuid,
  p_label text,
  p_week_ending date DEFAULT CURRENT_DATE,
  p_source_filename text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_snap_id uuid;
  v_baseline_snap_id uuid;
  v_budget numeric;
  v_earned numeric;
  v_actual numeric;
  v_cpi numeric;
  v_spi numeric;
  v_composite numeric;
  v_first_for_project boolean;
BEGIN
  IF NOT user_can_access_project(p_id) THEN
    RAISE EXCEPTION 'Access denied for project %', p_id;
  END IF;

  SELECT total_budget, total_earned, total_actual, cpi, spi
    INTO v_budget, v_earned, v_actual, v_cpi, v_spi
  FROM get_project_metrics(p_id);

  v_composite := compute_project_qty_composite(p_id);

  INSERT INTO period_snapshots (
    project_id, snapshot_date, label, total_budget, total_earned, total_actual,
    cpi, spi, kind, week_ending, source_filename, uploaded_by, uploaded_at,
    composite_pct_qty
  )
  VALUES (
    p_id, CURRENT_DATE, p_label, v_budget, v_earned, v_actual,
    v_cpi, v_spi, 'weekly', p_week_ending, p_source_filename, auth.uid(), now(),
    v_composite
  )
  RETURNING id INTO v_snap_id;

  INSERT INTO period_snapshot_items (
    snapshot_id, progress_item_id, project_id,
    percent_complete, earned_hrs, earned_qty, actual_hrs, actual_qty
  )
  SELECT
    v_snap_id, pi.id, pi.project_id,
    pi.percent_complete, pi.earned_hrs, pi.earned_qty, pi.actual_hrs, pi.actual_qty
  FROM progress_items pi
  WHERE pi.project_id = p_id;

  -- First weekly snapshot for this project? Also write a baseline_first_audit copy.
  SELECT NOT EXISTS (
    SELECT 1 FROM period_snapshots
    WHERE project_id = p_id AND kind = 'baseline_first_audit'
  ) INTO v_first_for_project;

  IF v_first_for_project THEN
    INSERT INTO period_snapshots (
      project_id, snapshot_date, label, total_budget, total_earned, total_actual,
      cpi, spi, kind, week_ending, source_filename, uploaded_by, uploaded_at,
      composite_pct_qty
    )
    VALUES (
      p_id, CURRENT_DATE, 'Baseline – 1st Audit', v_budget, v_earned, v_actual,
      v_cpi, v_spi, 'baseline_first_audit', p_week_ending, p_source_filename, auth.uid(), now(),
      v_composite
    )
    RETURNING id INTO v_baseline_snap_id;

    INSERT INTO period_snapshot_items (
      snapshot_id, progress_item_id, project_id,
      percent_complete, earned_hrs, earned_qty, actual_hrs, actual_qty
    )
    SELECT
      v_baseline_snap_id, pi.id, pi.project_id,
      pi.percent_complete, pi.earned_hrs, pi.earned_qty, pi.actual_hrs, pi.actual_qty
    FROM progress_items pi
    WHERE pi.project_id = p_id;
  END IF;

  RETURN v_snap_id;
END;
$$;


-- ============================================================================
-- 6. Modified admin RPCs (role check: 'admin' -> 'tenant_admin')
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_get_users()
RETURNS TABLE (id uuid, email varchar, role text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE app_users.id = auth.uid() AND app_users.role = 'tenant_admin') THEN
    RAISE EXCEPTION 'Access denied. Tenant admin only.';
  END IF;

  RETURN QUERY
  SELECT a.id, u.email, a.role, u.created_at
  FROM app_users a
  JOIN auth.users u ON a.id = u.id
  WHERE a.tenant_id = (SELECT tenant_id FROM app_users WHERE app_users.id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_user_role(target_id uuid, target_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'tenant_admin') THEN
    RAISE EXCEPTION 'Access denied. Tenant admin only.';
  END IF;
  IF target_role NOT IN ('tenant_admin','member') THEN
    RAISE EXCEPTION 'Invalid role: %', target_role;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM app_users
    WHERE id = target_id
      AND tenant_id = (SELECT tenant_id FROM app_users WHERE id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Cannot modify users outside your tenant.';
  END IF;

  UPDATE app_users SET role = target_role WHERE id = target_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_user(target_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'tenant_admin') THEN
    RAISE EXCEPTION 'Access denied. Tenant admin only.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM app_users
    WHERE id = target_id
      AND tenant_id = (SELECT tenant_id FROM app_users WHERE id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Cannot modify users outside your tenant.';
  END IF;

  DELETE FROM auth.users WHERE id = target_id;
END;
$$;

-- 6.1 admin_create_user: now accepts optional project_ids[] for immediate assignment.
--     Preserves all GoTrue empty-string token columns (see 20260424160000 migration).
DROP FUNCTION IF EXISTS admin_create_user(varchar, varchar, text);
CREATE OR REPLACE FUNCTION admin_create_user(
  new_email varchar,
  new_password varchar,
  new_role text,
  new_project_ids uuid[] DEFAULT NULL,
  new_project_role text DEFAULT 'viewer'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid := gen_random_uuid();
  v_pid uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'tenant_admin') THEN
    RAISE EXCEPTION 'Access denied. Tenant admin only.';
  END IF;
  IF new_role NOT IN ('tenant_admin','member') THEN
    RAISE EXCEPTION 'Invalid role: %', new_role;
  END IF;
  IF new_project_role NOT IN ('admin','editor','viewer') THEN
    RAISE EXCEPTION 'Invalid project role: %', new_project_role;
  END IF;

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, aud, role, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change_token_new, email_change_token_current, email_change,
    phone_change, phone_change_token, reauthentication_token,
    created_at, updated_at
  )
  VALUES (
    new_user_id,
    '00000000-0000-0000-0000-000000000000',
    new_email,
    extensions.crypt(new_password, extensions.gen_salt('bf')),
    'authenticated',
    'authenticated',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    '', '',
    '', '', '',
    '', '', '',
    now(),
    now()
  );

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    new_user_id,
    format('{"sub":"%s","email":"%s"}', new_user_id::text, new_email)::jsonb,
    'email',
    new_email,
    current_timestamp,
    current_timestamp,
    current_timestamp
  );

  -- handle_new_user trigger inserted with role='tenant_admin'; reset to caller's intent
  UPDATE app_users SET role = new_role WHERE id = new_user_id;

  IF new_project_ids IS NOT NULL THEN
    FOREACH v_pid IN ARRAY new_project_ids LOOP
      IF EXISTS (
        SELECT 1 FROM projects p
        WHERE p.id = v_pid
          AND p.tenant_id = (SELECT tenant_id FROM app_users WHERE id = auth.uid())
      ) THEN
        INSERT INTO project_members (user_id, project_id, role, added_by)
        VALUES (new_user_id, v_pid, new_project_role, auth.uid())
        ON CONFLICT (user_id, project_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN new_user_id;
END;
$$;


-- ============================================================================
-- 7. New RPCs: discovery + multi-project nav + comparisons + rollups
-- ============================================================================

-- 7.1 list_my_projects: projects current user can access (with effective project role)
CREATE OR REPLACE FUNCTION list_my_projects()
RETURNS TABLE (
  id uuid,
  name text,
  status text,
  planned_start date,
  planned_end date,
  my_project_role text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.name, p.status, p.planned_start, p.planned_end,
    CASE
      WHEN u.role = 'tenant_admin' AND u.tenant_id = p.tenant_id THEN 'tenant_admin'
      ELSE pm.role
    END AS my_project_role
  FROM projects p
  CROSS JOIN app_users u
  LEFT JOIN project_members pm ON pm.user_id = u.id AND pm.project_id = p.id
  WHERE u.id = auth.uid()
    AND p.tenant_id = u.tenant_id
    AND (u.role = 'tenant_admin' OR pm.user_id IS NOT NULL)
  ORDER BY p.name;
END;
$$;

-- 7.2 list_snapshots: snapshot history for a project
CREATE OR REPLACE FUNCTION list_snapshots(p_id uuid)
RETURNS TABLE (
  id uuid,
  kind text,
  label text,
  week_ending date,
  snapshot_date date,
  source_filename text,
  uploaded_by uuid,
  uploaded_by_email varchar,
  uploaded_at timestamptz,
  total_budget numeric,
  total_earned numeric,
  total_actual numeric,
  composite_pct_qty numeric,
  items_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  IF NOT user_can_access_project(p_id) THEN
    RAISE EXCEPTION 'Access denied for project %', p_id;
  END IF;

  RETURN QUERY
  SELECT
    s.id, s.kind, s.label, s.week_ending, s.snapshot_date,
    s.source_filename, s.uploaded_by, u.email,
    s.uploaded_at, s.total_budget, s.total_earned, s.total_actual,
    s.composite_pct_qty,
    (SELECT COUNT(*) FROM period_snapshot_items WHERE snapshot_id = s.id)
  FROM period_snapshots s
  LEFT JOIN auth.users u ON u.id = s.uploaded_by
  WHERE s.project_id = p_id
  ORDER BY COALESCE(s.week_ending, s.snapshot_date) DESC, s.uploaded_at DESC;
END;
$$;

-- 7.3 get_period_comparison: per-item diff between two snapshots
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
  movement text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  IF NOT user_can_access_project(p_id) THEN
    RAISE EXCEPTION 'Access denied for project %', p_id;
  END IF;

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
  WHERE pi.project_id = p_id
    AND (filter_discipline_id IS NULL OR pi.discipline_id = filter_discipline_id)
  ORDER BY d.name, iw.name NULLS LAST, pi.dwg;
END;
$$;

-- 7.4 get_project_qty_rollup: composite % + per-discipline contributions
CREATE OR REPLACE FUNCTION get_project_qty_rollup(p_id uuid)
RETURNS TABLE (
  mode text,
  composite_pct numeric,
  per_discipline jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_mode text;
BEGIN
  IF NOT user_can_access_project(p_id) THEN
    RAISE EXCEPTION 'Access denied for project %', p_id;
  END IF;

  SELECT qty_rollup_mode INTO v_mode FROM projects WHERE id = p_id;

  RETURN QUERY
  WITH disc AS (
    SELECT
      d.id AS discipline_id,
      d.name,
      COALESCE(SUM(pi.budget_hrs), 0) AS budget_hrs,
      COALESCE(SUM(pi.budget_qty), 0) AS budget_qty,
      COALESCE(SUM(pi.earned_qty), 0) AS earned_qty,
      CASE WHEN COALESCE(SUM(pi.budget_qty), 0) = 0 THEN NULL
           ELSE SUM(pi.earned_qty) / SUM(pi.budget_qty) END AS pct_qty
    FROM disciplines d
    LEFT JOIN progress_items pi ON pi.discipline_id = d.id
    WHERE d.project_id = p_id
    GROUP BY d.id, d.name
  ),
  total_hrs AS (SELECT SUM(budget_hrs) AS h FROM disc),
  weighted AS (
    SELECT
      disc.discipline_id,
      disc.name,
      disc.pct_qty,
      CASE v_mode
        WHEN 'hours_weighted' THEN
          CASE WHEN COALESCE((SELECT h FROM total_hrs), 0) = 0 THEN 0
               ELSE disc.budget_hrs / (SELECT h FROM total_hrs) END
        WHEN 'equal' THEN
          CASE WHEN (SELECT COUNT(*) FROM disc) = 0 THEN 0
               ELSE 1.0 / (SELECT COUNT(*) FROM disc) END
        WHEN 'custom' THEN
          COALESCE(
            (SELECT pdw.weight FROM project_discipline_weights pdw
              WHERE pdw.project_id = p_id AND pdw.discipline_id = disc.discipline_id),
            0
          )
        ELSE 0
      END AS weight
    FROM disc
  )
  SELECT
    v_mode,
    ROUND(COALESCE(SUM(weight * COALESCE(pct_qty, 0)) * 100, 0), 2),
    COALESCE(jsonb_agg(jsonb_build_object(
      'discipline_id', discipline_id,
      'name', name,
      'weight', weight,
      'pct_qty', pct_qty
    ) ORDER BY name), '[]'::jsonb)
  FROM weighted;
END;
$$;

-- 7.5 get_discipline_curve: per-discipline trend across snapshots
CREATE OR REPLACE FUNCTION get_discipline_curve(p_id uuid, d_id uuid)
RETURNS TABLE (
  snapshot_id uuid,
  kind text,
  week_ending date,
  label text,
  earned_hrs numeric,
  earned_qty numeric,
  pct_complete numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
BEGIN
  IF NOT user_can_access_project(p_id) THEN
    RAISE EXCEPTION 'Access denied for project %', p_id;
  END IF;

  RETURN QUERY
  SELECT
    s.id, s.kind, s.week_ending, s.label,
    COALESCE(SUM(psi.earned_hrs), 0),
    COALESCE(SUM(psi.earned_qty), 0),
    CASE WHEN COALESCE(SUM(pi.budget_hrs), 0) = 0 THEN 0
         ELSE ROUND(SUM(psi.earned_hrs) / SUM(pi.budget_hrs) * 100, 2) END
  FROM period_snapshots s
  JOIN period_snapshot_items psi ON psi.snapshot_id = s.id
  JOIN progress_items pi ON pi.id = psi.progress_item_id
  WHERE s.project_id = p_id
    AND pi.discipline_id = d_id
  GROUP BY s.id, s.kind, s.week_ending, s.label, s.snapshot_date
  ORDER BY COALESCE(s.week_ending, s.snapshot_date);
END;
$$;


-- ============================================================================
-- 8. New admin RPCs: project membership management
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_list_project_members(p_id uuid)
RETURNS TABLE (
  user_id uuid,
  email varchar,
  tenant_role text,
  project_role text,
  added_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT user_can_access_project(p_id) THEN
    RAISE EXCEPTION 'Access denied for project %', p_id;
  END IF;
  IF NOT (
    EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'tenant_admin')
    OR EXISTS (SELECT 1 FROM project_members
               WHERE user_id = auth.uid() AND project_id = p_id AND role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Project admin or tenant admin only.';
  END IF;

  RETURN QUERY
  SELECT u_app.id, u.email, u_app.role, 'tenant_admin'::text, NULL::timestamptz
  FROM app_users u_app
  JOIN auth.users u ON u.id = u_app.id
  WHERE u_app.role = 'tenant_admin'
    AND u_app.tenant_id = (SELECT tenant_id FROM projects WHERE id = p_id)
  UNION ALL
  SELECT pm.user_id, u.email, u_app.role, pm.role, pm.added_at
  FROM project_members pm
  JOIN app_users u_app ON u_app.id = pm.user_id
  JOIN auth.users u ON u.id = pm.user_id
  WHERE pm.project_id = p_id
  ORDER BY 4, 2;
END;
$$;

CREATE OR REPLACE FUNCTION admin_add_project_member(
  target_user_id uuid,
  p_id uuid,
  p_role text DEFAULT 'viewer'
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF p_role NOT IN ('admin','editor','viewer') THEN
    RAISE EXCEPTION 'Invalid project role: %', p_role;
  END IF;
  IF NOT (
    EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'tenant_admin')
    OR EXISTS (SELECT 1 FROM project_members
               WHERE user_id = auth.uid() AND project_id = p_id AND role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Project admin or tenant admin only.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM app_users u, projects p
    WHERE u.id = target_user_id AND p.id = p_id AND u.tenant_id = p.tenant_id
  ) THEN
    RAISE EXCEPTION 'User and project tenants do not match.';
  END IF;

  INSERT INTO project_members (user_id, project_id, role, added_by)
  VALUES (target_user_id, p_id, p_role, auth.uid())
  ON CONFLICT (user_id, project_id) DO UPDATE SET role = EXCLUDED.role;
END;
$$;

CREATE OR REPLACE FUNCTION admin_remove_project_member(target_user_id uuid, p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'tenant_admin')
    OR EXISTS (SELECT 1 FROM project_members
               WHERE user_id = auth.uid() AND project_id = p_id AND role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Project admin or tenant admin only.';
  END IF;

  DELETE FROM project_members WHERE user_id = target_user_id AND project_id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_project_member_role(
  target_user_id uuid,
  p_id uuid,
  p_role text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF p_role NOT IN ('admin','editor','viewer') THEN
    RAISE EXCEPTION 'Invalid project role: %', p_role;
  END IF;
  IF NOT (
    EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'tenant_admin')
    OR EXISTS (SELECT 1 FROM project_members
               WHERE user_id = auth.uid() AND project_id = p_id AND role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Project admin or tenant admin only.';
  END IF;

  UPDATE project_members SET role = p_role
  WHERE user_id = target_user_id AND project_id = p_id;
END;
$$;


-- ============================================================================
-- 9. New project-settings RPCs: baseline reset + qty rollup
-- ============================================================================

CREATE OR REPLACE FUNCTION admin_reset_first_audit_baseline(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'tenant_admin')
    OR EXISTS (SELECT 1 FROM project_members
               WHERE user_id = auth.uid() AND project_id = p_id AND role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Project admin or tenant admin only.';
  END IF;

  DELETE FROM period_snapshots
  WHERE project_id = p_id AND kind = 'baseline_first_audit';
  -- Next call to create_period_snapshot() will auto-write the new baseline.
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_qty_rollup(
  p_id uuid,
  p_mode text,
  p_weights jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_total numeric := 0;
  v_record jsonb;
BEGIN
  IF p_mode NOT IN ('hours_weighted','equal','custom') THEN
    RAISE EXCEPTION 'Invalid mode: %', p_mode;
  END IF;
  IF NOT (
    EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'tenant_admin')
    OR EXISTS (SELECT 1 FROM project_members
               WHERE user_id = auth.uid() AND project_id = p_id AND role = 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied. Project admin or tenant admin only.';
  END IF;

  UPDATE projects SET qty_rollup_mode = p_mode WHERE id = p_id;

  IF p_mode = 'custom' THEN
    IF p_weights IS NULL THEN
      RAISE EXCEPTION 'Custom mode requires weights.';
    END IF;
    FOR v_record IN SELECT * FROM jsonb_array_elements(p_weights) LOOP
      v_total := v_total + (v_record->>'weight')::numeric;
    END LOOP;
    IF ABS(v_total - 1.0) > 0.001 THEN
      RAISE EXCEPTION 'Custom weights must sum to 1.0 (got %).', v_total;
    END IF;

    DELETE FROM project_discipline_weights WHERE project_id = p_id;
    INSERT INTO project_discipline_weights (project_id, discipline_id, weight)
    SELECT p_id, (elem->>'discipline_id')::uuid, (elem->>'weight')::numeric
    FROM jsonb_array_elements(p_weights) AS elem;
  ELSE
    DELETE FROM project_discipline_weights WHERE project_id = p_id;
  END IF;
END;
$$;

-- ============================================================================
-- End of demo parity foundations
-- ============================================================================
