-- Mock Seed Data for ProgressTracker Environment

-- Create mock tenant auth reference 
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-0000-0000-000000000001', 'admin@invenio.kis');

-- Bind the mock auth user to a hardcoded tenant for RLS tests
INSERT INTO app_users (id, tenant_id, role) VALUES ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'admin');

-- Create mock project matching the React UI UUID bound to that Tenant
INSERT INTO projects (id, name, tenant_id, planned_start, planned_end) 
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'LNG Facility Export Expansion', '11111111-1111-1111-1111-111111111111', '2026-01-01', '2026-12-31');

-- Create generic disciplines
INSERT INTO disciplines (id, project_id, name, code) VALUES 
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '550e8400-e29b-41d4-a716-446655440000', 'Civil', 'CIV'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '550e8400-e29b-41d4-a716-446655440000', 'Piping', 'PIP'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', '550e8400-e29b-41d4-a716-446655440000', 'Structural', 'STR'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', '550e8400-e29b-41d4-a716-446655440000', 'Electrical', 'ELE');

-- Insert period tracking snapshots representing historical variance plotting for the S-Curve graph
INSERT INTO period_snapshots (project_id, snapshot_date, label, total_budget, total_earned, total_actual, cpi, spi) VALUES
('550e8400-e29b-41d4-a716-446655440000', '2026-03-01', 'Week 01', 10000,   500,   600, 0.83, 0.05),
('550e8400-e29b-41d4-a716-446655440000', '2026-03-08', 'Week 02', 10000,  1500,  1400, 1.07, 0.15),
('550e8400-e29b-41d4-a716-446655440000', '2026-03-15', 'Week 03', 10000,  3500,  3400, 1.03, 0.35),
('550e8400-e29b-41d4-a716-446655440000', '2026-03-22', 'Week 04', 10000,  5500,  5200, 1.05, 0.55);

-- Insert dummy progress items to seed the live 'Current' data pool
INSERT INTO progress_items (project_id, discipline_id, dwg, budget_hrs, actual_hrs, percent_complete) VALUES 
('550e8400-e29b-41d4-a716-446655440000', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CIV-001', 2000, 1800, 100),
('550e8400-e29b-41d4-a716-446655440000', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'PIP-001', 4000, 2000, 45),
('550e8400-e29b-41d4-a716-446655440000', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'STR-001', 2500, 1000, 30),
('550e8400-e29b-41d4-a716-446655440000', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'ELE-001', 1500,  400, 25);
