-- get admin list
CREATE OR REPLACE FUNCTION admin_get_users()
RETURNS TABLE (id uuid, email varchar, role text, created_at timestamptz)
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE app_users.id = auth.uid() AND app_users.role = 'admin') THEN
    RAISE EXCEPTION 'Access denied. You must be an admin.';
  END IF;

  RETURN QUERY
  SELECT a.id, u.email, a.role, u.created_at
  FROM app_users a
  JOIN auth.users u ON a.id = u.id
  WHERE a.tenant_id = (SELECT tenant_id FROM app_users WHERE app_users.id = auth.uid());
END;
$$ LANGUAGE plpgsql;

-- set user role
CREATE OR REPLACE FUNCTION admin_set_user_role(target_id uuid, target_role text)
RETURNS void
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;
  
  -- ensure tenant
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE id = target_id AND tenant_id = (SELECT tenant_id FROM app_users WHERE id = auth.uid())) THEN
    RAISE EXCEPTION 'Cannot modify users outside your tenant.';
  END IF;

  UPDATE app_users SET role = target_role WHERE id = target_id;
END;
$$ LANGUAGE plpgsql;

-- delete user
CREATE OR REPLACE FUNCTION admin_delete_user(target_id uuid)
RETURNS void
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM app_users WHERE id = target_id AND tenant_id = (SELECT tenant_id FROM app_users WHERE id = auth.uid())) THEN
    RAISE EXCEPTION 'Cannot modify users outside your tenant.';
  END IF;

  DELETE FROM auth.users WHERE id = target_id;
END;
$$ LANGUAGE plpgsql;

-- create user implicitly bypass
CREATE OR REPLACE FUNCTION admin_create_user(new_email varchar, new_password varchar, new_role text)
RETURNS void
SECURITY DEFINER
AS $$
DECLARE
  new_user_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_users WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Access denied.';
  END IF;

  INSERT INTO auth.users (id, instance_id, email, encrypted_password, aud, role, email_confirmed_at) 
  VALUES (
    new_user_id, 
    '00000000-0000-0000-0000-000000000000',
    new_email, 
    extensions.crypt(new_password, extensions.gen_salt('bf')), 
    'authenticated', 
    'authenticated', 
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

  UPDATE app_users SET role = new_role WHERE id = new_user_id;

END;
$$ LANGUAGE plpgsql;
