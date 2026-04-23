BEGIN;
SELECT plan(8);

-- Check if tables exist
SELECT has_table('projects', 'Table projects should exist');
SELECT has_table('disciplines', 'Table disciplines should exist');
SELECT has_table('iwps', 'Table iwps should exist');
SELECT has_table('progress_items', 'Table progress_items should exist');
SELECT has_table('period_snapshots', 'Table period_snapshots should exist');

-- Check RLS is enabled
SELECT tables_are_secure('public');

SELECT has_column('progress_items', 'earned_hrs', 'Column earned_hrs should exist');
SELECT col_is_pk('projects', 'id', 'id should be the primary key of projects');

SELECT * FROM finish();
ROLLBACK;
