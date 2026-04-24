-- Fix existing users who have broken metadata logic
UPDATE auth.users 
SET raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb 
WHERE raw_app_meta_data IS NULL;

UPDATE auth.users 
SET raw_user_meta_data = '{}'::jsonb 
WHERE raw_user_meta_data IS NULL;

-- Redefine create_user to insert metadata accurately to prevent GoTrue panic
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

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, aud, role, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
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

  UPDATE app_users SET role = new_role WHERE id = new_user_id;

END;
$$ LANGUAGE plpgsql;
