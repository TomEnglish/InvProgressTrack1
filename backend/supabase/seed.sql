-- Mock Seed Data for ProgressTracker Environment

-- Create mock tenant auth reference mathematically capable of native UI Login
INSERT INTO auth.users (id, email, encrypted_password, aud, role, email_confirmed_at) 
VALUES (
  '00000000-0000-0000-0000-000000000001', 
  'admin@invenio.kis', 
  extensions.crypt('password123', extensions.gen_salt('bf')), 
  'authenticated', 
  'authenticated', 
  now()
);

-- The app_users table is now automatically seeded via the handle_new_user() trigger during the step above!

-- Force GoTrue to recognize the user via the Identities table
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at) 
VALUES (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000001',
    format('{"sub":"%s","email":"%s"}', '00000000-0000-0000-0000-000000000001', 'admin@invenio.kis')::jsonb,
    'email',
    'admin@invenio.kis',
    current_timestamp,
    current_timestamp,
    current_timestamp
);

-- Create mock project matching the React UI UUID bound to that Tenant
INSERT INTO projects (id, name, tenant_id, planned_start, planned_end) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'LNG Facility Export Expansion', '11111111-1111-1111-1111-111111111111', '2026-01-01', '2026-12-31');

-- Create generic disciplines (six-discipline coverage for demo parity)
INSERT INTO disciplines (id, project_id, name, code) VALUES
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '550e8400-e29b-41d4-a716-446655440000', 'Civil',           'CIV'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '550e8400-e29b-41d4-a716-446655440000', 'Pipe',            'PIP'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '550e8400-e29b-41d4-a716-446655440000', 'Steel',           'STR'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '550e8400-e29b-41d4-a716-446655440000', 'Electrical',      'ELE'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '550e8400-e29b-41d4-a716-446655440000', 'Mechanical',      'MEC'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', '550e8400-e29b-41d4-a716-446655440000', 'Instrumentation', 'INS');

-- Insert period tracking snapshots representing historical variance plotting for the S-Curve graph
INSERT INTO period_snapshots (project_id, snapshot_date, label, total_budget, total_earned, total_actual, cpi, spi) VALUES
('550e8400-e29b-41d4-a716-446655440000', '2026-03-01', 'Week 01', 10000,   500,   600, 0.83, 0.05),
('550e8400-e29b-41d4-a716-446655440000', '2026-03-08', 'Week 02', 10000,  1500,  1400, 1.07, 0.15),
('550e8400-e29b-41d4-a716-446655440000', '2026-03-15', 'Week 03', 10000,  3500,  3400, 1.03, 0.35),
('550e8400-e29b-41d4-a716-446655440000', '2026-03-22', 'Week 04', 10000,  5500,  5200, 1.05, 0.55);

-- Insert comprehensive dummy progress items to seed the live 'Current' data pool out to all disciplines!
-- One unit per discipline by convention (Civil m3, Pipe LF, Steel TON, Electrical EA, Mechanical EA, Instrumentation EA).
INSERT INTO progress_items (project_id, discipline_id, dwg, budget_hrs, actual_hrs, percent_complete, unit, budget_qty, actual_qty) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CIV-001-FND', 1200, 1100, 100, 'm3',  600,  600),
('550e8400-e29b-41d4-a716-446655440000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CIV-002-SIT',  800,  700, 100, 'm3',  400,  400),
('550e8400-e29b-41d4-a716-446655440000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'PIP-101-FWD', 2000, 1100,  60, 'LF', 5000, 3000),
('550e8400-e29b-41d4-a716-446655440000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'PIP-102-REV', 2000,  900,  30, 'LF', 5000, 1500),
('550e8400-e29b-41d4-a716-446655440000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'STR-301-BLD', 1500,  850,  45, 'TON', 200,   90),
('550e8400-e29b-41d4-a716-446655440000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'STR-302-SUP', 1000,  150,  15, 'TON', 150,   22),
('550e8400-e29b-41d4-a716-446655440000', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'ELE-500-UGD', 1000,  300,  20, 'EA',  120,   24),
('550e8400-e29b-41d4-a716-446655440000', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'ELE-501-AGD',  500,  100,  35, 'EA',   60,   21),
('550e8400-e29b-41d4-a716-446655440000', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'MEC-700-PMP',  900,  300,  25, 'EA',   40,   10),
('550e8400-e29b-41d4-a716-446655440000', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'MEC-701-VLV',  600,  100,  10, 'EA',   80,    8),
('550e8400-e29b-41d4-a716-446655440000', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'INS-900-LOOP', 700,  150,  18, 'EA',  300,   54),
('550e8400-e29b-41d4-a716-446655440000', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'INS-901-TXM',  400,   60,  12, 'EA',  100,   12);
