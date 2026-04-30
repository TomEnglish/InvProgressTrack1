-- ============================================================================
-- admin_create_project — tenant-admin RPC to create a new project + seed disciplines
-- ============================================================================
-- Direct INSERTs into `projects` are blocked by RLS because the policy's
-- user_can_access_project() check resolves false mid-insert (the row doesn't
-- exist yet to look up its tenant). This RPC bypasses that as SECURITY DEFINER.
-- Six default disciplines are seeded so qty/discipline UIs work immediately.
-- ============================================================================

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
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'tenant_admin'
  ) THEN
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

  RETURN v_project_id;
END;
$$;
