BEGIN;
SELECT plan(3);

-- Seed data
INSERT INTO projects (id, name, tenant_id) VALUES ('00000000-0000-0000-0000-000000000001', 'Test Project', '11111111-1111-1111-1111-111111111111');
INSERT INTO disciplines (id, project_id, name) VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Civil');
INSERT INTO progress_items (project_id, discipline_id, budget_hrs, actual_hrs, percent_complete) 
VALUES 
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 1000, 100, 20),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 2000, 500, 50);

SELECT results_eq(
  $$ SELECT total_budget, total_earned, total_actual, cpi, spi, percent_complete FROM get_project_metrics('00000000-0000-0000-0000-000000000001') $$,
  $$ VALUES (3000.0, 1200.0, 600.0, 2.0, 0.4, 40.0) $$,
  'get_project_metrics calculates correct EV math'
);

SELECT results_eq(
  $$ SELECT discipline_name, total_budget, total_earned, total_actual, percent_complete FROM get_discipline_metrics('00000000-0000-0000-0000-000000000001') $$,
  $$ VALUES ('Civil'::text, 3000.0, 1200.0, 600.0, 40.0) $$,
  'get_discipline_metrics calculates correct EV math'
);

-- Test snapshot creation
SELECT create_period_snapshot('00000000-0000-0000-0000-000000000001', 'Week 1');
SELECT is(
  (SELECT total_earned FROM period_snapshots WHERE project_id = '00000000-0000-0000-0000-000000000001' AND label = 'Week 1'),
  1200.0,
  'Snapshot should record correct total_earned'
);

SELECT * FROM finish();
ROLLBACK;
