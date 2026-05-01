-- ============================================================================
-- Mock Seed Data — runs on `supabase db reset`
-- ============================================================================
-- Generates a realistic dataset that exercises every feature added through
-- Phase 7B: per-discipline IWPs, milestone progress, attribute columns,
-- foreman names (some unmatched for Reconciliation testing), historical
-- snapshots, and a second project for multi-project flows.
-- ============================================================================


-- 1. Tenant admin user (auth + identity)
INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@invenio.kis',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  'authenticated',
  'authenticated',
  now()
);

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000001',
  format('{"sub":"%s","email":"%s"}', '00000000-0000-0000-0000-000000000001', 'admin@invenio.kis')::jsonb,
  'email',
  'admin@invenio.kis',
  current_timestamp, current_timestamp, current_timestamp
);


-- 2. LNG project + six disciplines (migrations seed_default_milestones() runs after)
INSERT INTO projects (id, name, tenant_id, planned_start, planned_end)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'LNG Facility Export Expansion', '11111111-1111-1111-1111-111111111111', '2026-01-01', '2026-12-31');

INSERT INTO disciplines (id, project_id, name, code) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '550e8400-e29b-41d4-a716-446655440000', 'Civil',           'CIV'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '550e8400-e29b-41d4-a716-446655440000', 'Pipe',            'PIP'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '550e8400-e29b-41d4-a716-446655440000', 'Steel',           'STR'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '550e8400-e29b-41d4-a716-446655440000', 'Electrical',      'ELE'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '550e8400-e29b-41d4-a716-446655440000', 'Mechanical',      'MEC'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '550e8400-e29b-41d4-a716-446655440000', 'Instrumentation', 'INS');

-- The init migration's seed_default_milestones() backfill runs in the migration,
-- but the disciplines didn't exist yet at that point on a fresh `db reset`. Apply
-- the seeder explicitly here.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM disciplines WHERE project_id = '550e8400-e29b-41d4-a716-446655440000' LOOP
    PERFORM seed_default_milestones(r.id);
  END LOOP;
END$$;


-- 3. LNG IWPs — 5–8 per discipline, with realistic naming patterns
DO $$
DECLARE
  v_proj uuid := '550e8400-e29b-41d4-a716-446655440000';
  v_disc record;
  v_iwp_names text[];
  v_n text;
BEGIN
  FOR v_disc IN SELECT id, name FROM disciplines WHERE project_id = v_proj LOOP
    v_iwp_names := CASE v_disc.name
      WHEN 'Civil'           THEN ARRAY['04110','04120','04130','04140','04210']
      WHEN 'Pipe'            THEN ARRAY['PI-000-001','PI-000-002','PI-100-101','PI-100-102','PI-100-103','PI-200-201','PI-200-202','PI-300-301']
      WHEN 'Steel'           THEN ARRAY['ST-100-001','ST-100-002','ST-100-003','ST-200-001','ST-200-002','ST-300-001']
      WHEN 'Electrical'      THEN ARRAY['09220C','09310','09340','09420','09510','09620']
      WHEN 'Mechanical'      THEN ARRAY['07120','07130','07140','07150','07160']
      WHEN 'Instrumentation' THEN ARRAY['10110','10210','10310','10410','10510']
      ELSE ARRAY['IWP-001']
    END;
    FOREACH v_n IN ARRAY v_iwp_names LOOP
      INSERT INTO iwps (project_id, discipline_id, name) VALUES (v_proj, v_disc.id, v_n);
    END LOOP;
  END LOOP;
END$$;


-- 4. LNG progress_items + milestone progress — procedurally generated
-- Each item gets:
--   * dwg, line_area, attrs (per discipline conventions)
--   * a randomized completion "stage" 0..N where N = milestone count
--   * milestones earlier than stage = 100%, at stage = partial, after stage = 0%
-- This keeps milestone progress realistic (no "Connect 50% / Receive 0%" anomalies)
-- and yields a roughly bell-shaped distribution of overall % across items.
DO $$
DECLARE
  v_proj uuid := '550e8400-e29b-41d4-a716-446655440000';
  v_disc record;
  v_iwp record;
  v_iwps_count int;
  v_iwp_idx int := 0;
  v_per_iwp int;
  v_seq int;
  v_dwg text;
  v_unit text;
  v_qty numeric;
  v_hrs numeric;
  v_size text;
  v_spec text;
  v_atype text;
  v_area text;
  v_foreman text;
  v_foremen_civ text[]    := ARRAY['Joe Smith','Maria Garcia','Brad Olson','Joe Smith','Daryl Reeves'];
  v_foremen_pipe text[]   := ARRAY['Tom Hayes','Liz Park','Sam Rivera','Tom Hayes','Roger Cole','Liz Park','Sam Rivera'];
  v_foremen_steel text[]  := ARRAY['Carl Bishop','Dee Cortez','Carl Bishop','Phil Tran'];
  v_foremen_elec text[]   := ARRAY['Wes Allen','Nora Vega','Wes Allen','Brent Mac'];
  v_foremen_mech text[]   := ARRAY['Hank Doss','Hank Doss','Vince Korda'];
  v_foremen_inst text[]   := ARRAY['Cara Liu','Marcus Oh','Cara Liu'];
  v_foremen text[];
  v_pipe_specs text[]     := ARRAY['01HDPE','02CS150','03SS304','04CS300','05CS150'];
  v_pipe_sizes text[]     := ARRAY['02','04','06','08','10','12'];
  v_pipe_types text[]     := ARRAY['UG','AG'];
  v_steel_sizes text[]    := ARRAY['W10X49','W10X26','W12X35','WT5X11','C8X11.5'];
  v_elec_specs text[]     := ARRAY['12/C #12','1C/750 MCM (15KV)','2/C #10','3/C #1/0AWG','4/C #14'];
  v_areas text[]          := ARRAY['100','120','200','220','300'];
  v_milestones record;
  v_milestone_count int;
  v_stage int;
  v_partial numeric;
  v_pct numeric;
  v_milestone_idx int;
  v_item_id uuid;
  v_template_id uuid;
  v_total_for_disc int;
BEGIN
  FOR v_disc IN SELECT id, name FROM disciplines WHERE project_id = v_proj LOOP

    SELECT COUNT(*) INTO v_milestone_count
    FROM audit_milestone_templates WHERE discipline_id = v_disc.id;

    -- Per-discipline foreman pool
    v_foremen := CASE v_disc.name
      WHEN 'Civil'           THEN v_foremen_civ
      WHEN 'Pipe'            THEN v_foremen_pipe
      WHEN 'Steel'           THEN v_foremen_steel
      WHEN 'Electrical'      THEN v_foremen_elec
      WHEN 'Mechanical'      THEN v_foremen_mech
      WHEN 'Instrumentation' THEN v_foremen_inst
      ELSE ARRAY['Joe Smith']
    END;

    -- Items per IWP varies by discipline (mechanical has fewer, electrical/pipe more)
    v_per_iwp := CASE v_disc.name
      WHEN 'Civil'           THEN 6
      WHEN 'Pipe'            THEN 8
      WHEN 'Steel'           THEN 7
      WHEN 'Electrical'      THEN 7
      WHEN 'Mechanical'      THEN 3
      WHEN 'Instrumentation' THEN 8
      ELSE 5
    END;

    SELECT COUNT(*) INTO v_iwps_count FROM iwps WHERE discipline_id = v_disc.id;
    v_iwp_idx := 0;
    v_total_for_disc := 0;

    FOR v_iwp IN SELECT id, name FROM iwps WHERE discipline_id = v_disc.id ORDER BY name LOOP
      v_iwp_idx := v_iwp_idx + 1;

      FOR v_seq IN 1..v_per_iwp LOOP
        v_total_for_disc := v_total_for_disc + 1;

        -- Discipline-specific shape
        v_unit := CASE v_disc.name
          WHEN 'Civil' THEN 'CY' WHEN 'Pipe' THEN 'LF' WHEN 'Steel' THEN 'TN'
          WHEN 'Electrical' THEN CASE WHEN random() < 0.6 THEN 'LF' ELSE 'EA' END
          ELSE 'EA' END;

        v_qty := CASE v_disc.name
          WHEN 'Civil' THEN (5 + floor(random() * 90))::numeric
          WHEN 'Pipe'  THEN (5 + floor(random() * 500))::numeric
          WHEN 'Steel' THEN (1 + floor(random() * 5))::numeric
          WHEN 'Electrical' THEN
            CASE WHEN v_unit = 'LF' THEN (50 + floor(random() * 5000))::numeric ELSE (1 + floor(random() * 6))::numeric END
          WHEN 'Mechanical' THEN (1 + floor(random() * 3))::numeric
          ELSE 1::numeric END;

        v_hrs := CASE v_disc.name
          WHEN 'Civil' THEN (10 + random() * 90)
          WHEN 'Pipe'  THEN (8 + random() * 1200)
          WHEN 'Steel' THEN (5 + random() * 100)
          WHEN 'Electrical' THEN (5 + random() * 150)
          WHEN 'Mechanical' THEN (50 + random() * 400)
          ELSE (10 + random() * 30) END;

        v_size := CASE v_disc.name
          WHEN 'Pipe'  THEN v_pipe_sizes[1 + floor(random() * array_length(v_pipe_sizes, 1))::int]
          WHEN 'Steel' THEN v_steel_sizes[1 + floor(random() * array_length(v_steel_sizes, 1))::int]
          ELSE NULL END;

        v_spec := CASE v_disc.name
          WHEN 'Pipe'       THEN v_pipe_specs[1 + floor(random() * array_length(v_pipe_specs, 1))::int]
          WHEN 'Electrical' THEN CASE WHEN v_unit = 'LF' THEN v_elec_specs[1 + floor(random() * array_length(v_elec_specs, 1))::int] ELSE NULL END
          ELSE NULL END;

        v_atype := CASE v_disc.name
          WHEN 'Pipe'  THEN v_pipe_types[1 + floor(random() * array_length(v_pipe_types, 1))::int]
          ELSE NULL END;

        v_area := v_areas[1 + floor(random() * array_length(v_areas, 1))::int];

        v_foreman := v_foremen[1 + floor(random() * array_length(v_foremen, 1))::int];

        v_dwg := CASE v_disc.name
          WHEN 'Civil'           THEN format('P02.03-CV-%s-DWG-%s', v_area, lpad((1000 + v_total_for_disc)::text, 5, '0'))
          WHEN 'Pipe'            THEN format('120-FP-%s-SHT%s', lpad((100 + v_total_for_disc)::text, 4, '0'), lpad(v_seq::text, 2, '0'))
          WHEN 'Steel'           THEN format('1224A25-%s-ST-%s', v_area, lpad((1000 + v_total_for_disc)::text, 4, '0'))
          WHEN 'Electrical'      THEN format('P02.03-EL-%s-PLN-%s', v_area, lpad((10000 + v_total_for_disc)::text, 5, '0'))
          WHEN 'Mechanical'      THEN format('12224A25-%s-PP-%s', v_area, lpad((3000 + v_total_for_disc)::text, 4, '0'))
          WHEN 'Instrumentation' THEN format('12224A25-%s-IN-%s', v_area, lpad((5000 + v_total_for_disc)::text, 4, '0'))
          ELSE format('GEN-%s', v_total_for_disc) END;

        INSERT INTO progress_items (
          project_id, discipline_id, iwp_id, dwg, name,
          budget_hrs, actual_hrs, percent_complete,
          unit, budget_qty, actual_qty,
          attr_type, attr_size, attr_spec, line_area, foreman_name
        ) VALUES (
          v_proj, v_disc.id, v_iwp.id, v_dwg, NULL,
          round(v_hrs::numeric, 2),
          round((v_hrs * (0.4 + random() * 0.7))::numeric, 2),
          0,                         -- placeholder; recompute trigger fills in once milestones land
          v_unit, v_qty, NULL,
          v_atype, v_size, v_spec, v_area, v_foreman
        )
        RETURNING id INTO v_item_id;

        -- Milestone progress: pick a "stage" 0..N+1 where stage = number of fully-completed milestones
        -- (with stage > N meaning fully complete). Distribution favors mid-progress items.
        v_stage := floor(random() * (v_milestone_count + 1))::int;
        v_partial := round((random() * 100)::numeric, 2);
        v_milestone_idx := 0;

        FOR v_milestones IN
          SELECT id FROM audit_milestone_templates
           WHERE discipline_id = v_disc.id ORDER BY sort_order
        LOOP
          v_milestone_idx := v_milestone_idx + 1;
          v_template_id := v_milestones.id;

          IF v_stage > v_milestone_count THEN
            v_pct := 100;
          ELSIF v_milestone_idx <= v_stage THEN
            v_pct := 100;
          ELSIF v_milestone_idx = v_stage + 1 THEN
            v_pct := v_partial;
          ELSE
            v_pct := 0;
          END IF;

          INSERT INTO progress_item_milestones (
            progress_item_id, milestone_template_id, project_id, percent_complete
          ) VALUES (v_item_id, v_template_id, v_proj, v_pct);
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
END$$;


-- 5. Historical snapshots for LNG: 1st-audit baseline + 3 weekly snapshots
-- Each historical snapshot scales every item's earned values down by a factor
-- (so the S-curve trends upward over time). Per-item snapshot rows are written
-- into period_snapshot_items so Period Tracking comparison has data.
DO $$
DECLARE
  v_proj uuid := '550e8400-e29b-41d4-a716-446655440000';
  v_snaps record;
  v_snap_id uuid;
  v_total_budget numeric;
  v_total_earned numeric;
  v_total_actual numeric;
  v_factor numeric;
  v_label text;
  v_we date;
  v_kind text;
BEGIN
  FOR v_snaps IN
    SELECT * FROM (VALUES
      ('Baseline – 1st Audit', DATE '2026-04-05', 'baseline_first_audit', 0.50),
      ('Q2 Week 1',            DATE '2026-04-12', 'weekly',               0.65),
      ('Q2 Week 2',            DATE '2026-04-19', 'weekly',               0.85),
      ('Q2 Week 3',            DATE '2026-04-26', 'weekly',               1.00)
    ) AS t(label, week_ending, kind, factor)
  LOOP
    v_label  := v_snaps.label;
    v_we     := v_snaps.week_ending;
    v_kind   := v_snaps.kind;
    v_factor := v_snaps.factor;

    SELECT
      COALESCE(SUM(budget_hrs), 0),
      COALESCE(SUM(earned_hrs * v_factor), 0),
      COALESCE(SUM(actual_hrs * v_factor), 0)
    INTO v_total_budget, v_total_earned, v_total_actual
    FROM progress_items WHERE project_id = v_proj;

    INSERT INTO period_snapshots (
      project_id, snapshot_date, label,
      total_budget, total_earned, total_actual,
      cpi, spi,
      kind, week_ending, source_filename, uploaded_by, uploaded_at
    ) VALUES (
      v_proj, v_we, v_label,
      v_total_budget, v_total_earned, v_total_actual,
      CASE WHEN v_total_actual = 0 THEN 0 ELSE round(v_total_earned / v_total_actual, 2) END,
      CASE WHEN v_total_budget = 0 THEN 0 ELSE round(v_total_earned / v_total_budget, 2) END,
      v_kind, v_we, NULL, '00000000-0000-0000-0000-000000000001', v_we::timestamptz
    )
    RETURNING id INTO v_snap_id;

    INSERT INTO period_snapshot_items (
      snapshot_id, progress_item_id, project_id,
      percent_complete, earned_hrs, earned_qty, actual_hrs, actual_qty
    )
    SELECT
      v_snap_id, pi.id, pi.project_id,
      round(pi.percent_complete * v_factor, 2),
      round(pi.earned_hrs * v_factor, 2),
      CASE WHEN pi.earned_qty IS NULL THEN NULL ELSE round(pi.earned_qty * v_factor, 2) END,
      round(pi.actual_hrs * v_factor, 2),
      NULL
    FROM progress_items pi
    WHERE pi.project_id = v_proj;
  END LOOP;
END$$;


-- 6. Foreman aliases — link a couple of names to the admin user so reconciliation
-- shows a mix of matched and unmatched entries.
INSERT INTO foreman_aliases (name, user_id) VALUES
  ('Joe Smith', '00000000-0000-0000-0000-000000000001'),
  ('Tom Hayes', '00000000-0000-0000-0000-000000000001');

-- The aliases trigger backfilled foreman_user_id for matching items already.


-- 7. Second project — a smaller "Refinery Maintenance" so the project picker has
-- something to switch to and multi-project flows are testable.
INSERT INTO projects (id, name, tenant_id, planned_start, planned_end)
VALUES ('660e8400-e29b-41d4-a716-446655440000', 'Refinery Maintenance Q2', '11111111-1111-1111-1111-111111111111', '2026-04-01', '2026-06-30');

INSERT INTO disciplines (project_id, name, code) VALUES
('660e8400-e29b-41d4-a716-446655440000', 'Pipe',       'PIP'),
('660e8400-e29b-41d4-a716-446655440000', 'Steel',      'STR'),
('660e8400-e29b-41d4-a716-446655440000', 'Electrical', 'ELE');

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM disciplines WHERE project_id = '660e8400-e29b-41d4-a716-446655440000' LOOP
    PERFORM seed_default_milestones(r.id);
  END LOOP;
END$$;

DO $$
DECLARE
  v_proj uuid := '660e8400-e29b-41d4-a716-446655440000';
  v_disc record;
  v_iwp_id uuid;
  v_item_id uuid;
  v_milestones record;
  v_seq int;
  v_milestone_idx int;
  v_milestone_count int;
  v_stage int;
  v_partial numeric;
  v_pct numeric;
BEGIN
  FOR v_disc IN SELECT id, name FROM disciplines WHERE project_id = v_proj LOOP
    INSERT INTO iwps (project_id, discipline_id, name)
    VALUES (v_proj, v_disc.id, v_disc.code || '-MAINT-001')
    RETURNING id INTO v_iwp_id;

    SELECT COUNT(*) INTO v_milestone_count
    FROM audit_milestone_templates WHERE discipline_id = v_disc.id;

    FOR v_seq IN 1..10 LOOP
      INSERT INTO progress_items (
        project_id, discipline_id, iwp_id, dwg,
        budget_hrs, actual_hrs, percent_complete,
        unit, budget_qty, foreman_name
      ) VALUES (
        v_proj, v_disc.id, v_iwp_id,
        format('MAINT-%s-%s', v_disc.code, lpad(v_seq::text, 3, '0')),
        round((20 + random() * 80)::numeric, 2),
        round((10 + random() * 60)::numeric, 2),
        0,
        CASE v_disc.name WHEN 'Pipe' THEN 'LF' WHEN 'Steel' THEN 'TN' ELSE 'EA' END,
        (1 + floor(random() * 50))::numeric,
        'Maint Crew'
      )
      RETURNING id INTO v_item_id;

      v_stage := floor(random() * (v_milestone_count + 1))::int;
      v_partial := round((random() * 100)::numeric, 2);
      v_milestone_idx := 0;

      FOR v_milestones IN
        SELECT id FROM audit_milestone_templates
         WHERE discipline_id = v_disc.id ORDER BY sort_order
      LOOP
        v_milestone_idx := v_milestone_idx + 1;
        IF v_stage > v_milestone_count THEN v_pct := 100;
        ELSIF v_milestone_idx <= v_stage THEN v_pct := 100;
        ELSIF v_milestone_idx = v_stage + 1 THEN v_pct := v_partial;
        ELSE v_pct := 0;
        END IF;

        INSERT INTO progress_item_milestones (
          progress_item_id, milestone_template_id, project_id, percent_complete
        ) VALUES (v_item_id, v_milestones.id, v_proj, v_pct);
      END LOOP;
    END LOOP;
  END LOOP;
END$$;


-- 8. Refinery historical snapshots (1st-audit baseline + 2 weekly)
DO $$
DECLARE
  v_proj uuid := '660e8400-e29b-41d4-a716-446655440000';
  v_snaps record;
  v_snap_id uuid;
  v_total_budget numeric;
  v_total_earned numeric;
  v_total_actual numeric;
  v_factor numeric;
  v_label text;
  v_we date;
  v_kind text;
BEGIN
  FOR v_snaps IN
    SELECT * FROM (VALUES
      ('Baseline – 1st Audit', DATE '2026-04-12', 'baseline_first_audit', 0.55),
      ('Q2 Week 1',            DATE '2026-04-19', 'weekly',               0.80),
      ('Q2 Week 2',            DATE '2026-04-26', 'weekly',               1.00)
    ) AS t(label, week_ending, kind, factor)
  LOOP
    v_label  := v_snaps.label;
    v_we     := v_snaps.week_ending;
    v_kind   := v_snaps.kind;
    v_factor := v_snaps.factor;

    SELECT
      COALESCE(SUM(budget_hrs), 0),
      COALESCE(SUM(earned_hrs * v_factor), 0),
      COALESCE(SUM(actual_hrs * v_factor), 0)
    INTO v_total_budget, v_total_earned, v_total_actual
    FROM progress_items WHERE project_id = v_proj;

    INSERT INTO period_snapshots (
      project_id, snapshot_date, label,
      total_budget, total_earned, total_actual,
      cpi, spi,
      kind, week_ending, source_filename, uploaded_by, uploaded_at
    ) VALUES (
      v_proj, v_we, v_label,
      v_total_budget, v_total_earned, v_total_actual,
      CASE WHEN v_total_actual = 0 THEN 0 ELSE round(v_total_earned / v_total_actual, 2) END,
      CASE WHEN v_total_budget = 0 THEN 0 ELSE round(v_total_earned / v_total_budget, 2) END,
      v_kind, v_we, NULL, '00000000-0000-0000-0000-000000000001', v_we::timestamptz
    )
    RETURNING id INTO v_snap_id;

    INSERT INTO period_snapshot_items (
      snapshot_id, progress_item_id, project_id,
      percent_complete, earned_hrs, earned_qty, actual_hrs, actual_qty
    )
    SELECT
      v_snap_id, pi.id, pi.project_id,
      round(pi.percent_complete * v_factor, 2),
      round(pi.earned_hrs * v_factor, 2),
      CASE WHEN pi.earned_qty IS NULL THEN NULL ELSE round(pi.earned_qty * v_factor, 2) END,
      round(pi.actual_hrs * v_factor, 2),
      NULL
    FROM progress_items pi
    WHERE pi.project_id = v_proj;
  END LOOP;
END$$;
