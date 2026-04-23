-- Init Schema for ProgressTracker

-- Enable UUID extension (not natively required for gen_random_uuid, but left for safety)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tenant_id uuid NOT NULL, -- For multi-tenancy or logical grouping
  planned_start date,
  planned_end date,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Disciplines
CREATE TABLE disciplines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  created_at timestamptz DEFAULT now()
);

-- IWPs (Installation Work Packages)
CREATE TABLE iwps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  discipline_id uuid REFERENCES disciplines(id),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Progress Items
CREATE TABLE progress_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  discipline_id uuid REFERENCES disciplines(id),
  iwp_id uuid REFERENCES iwps(id),
  name text, -- e.g., drawing or iso number
  dwg text,
  budget_hrs numeric DEFAULT 0,
  actual_hrs numeric DEFAULT 0,
  percent_complete numeric DEFAULT 0,
  earned_hrs numeric GENERATED ALWAYS AS (budget_hrs * percent_complete / 100.0) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Period Snapshots (for delta comparisons)
CREATE TABLE period_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  label text NOT NULL,
  total_budget numeric,
  total_earned numeric,
  total_actual numeric,
  cpi numeric,
  spi numeric,
  created_at timestamptz DEFAULT now()
);

-- App Users for Multi-Tenancy
CREATE TABLE app_users (
  id uuid PRIMARY KEY, -- maps to auth.users in real implementation
  tenant_id uuid NOT NULL,
  role text DEFAULT 'viewer',
  created_at timestamptz DEFAULT now()
);

-- Helper function for RLS
CREATE OR REPLACE FUNCTION get_auth_tenant_id() RETURNS uuid AS $$
  SELECT tenant_id FROM app_users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Trigger to safely capture manual Dashboard signups and map them to the Dummy Tenant
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.app_users (id, tenant_id, role)
  VALUES (new.id, '11111111-1111-1111-1111-111111111111', 'admin');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- RLS Setup
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE disciplines ENABLE ROW LEVEL SECURITY;
ALTER TABLE iwps ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE period_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Isolation" ON app_users FOR ALL TO authenticated USING (tenant_id = get_auth_tenant_id());
CREATE POLICY "Tenant Isolation" ON projects FOR ALL TO authenticated USING (tenant_id = get_auth_tenant_id());
CREATE POLICY "Tenant Isolation" ON disciplines FOR ALL TO authenticated USING (project_id IN (SELECT id FROM projects WHERE tenant_id = get_auth_tenant_id()));
CREATE POLICY "Tenant Isolation" ON iwps FOR ALL TO authenticated USING (project_id IN (SELECT id FROM projects WHERE tenant_id = get_auth_tenant_id()));
CREATE POLICY "Tenant Isolation" ON progress_items FOR ALL TO authenticated USING (project_id IN (SELECT id FROM projects WHERE tenant_id = get_auth_tenant_id()));
CREATE POLICY "Tenant Isolation" ON period_snapshots FOR ALL TO authenticated USING (project_id IN (SELECT id FROM projects WHERE tenant_id = get_auth_tenant_id()));

-- (In a real implementation, we would add insert/update policies as well, restricted appropriately)
