-- Backfill NULL token/string columns in auth.users.
-- GoTrue scans these as plain Go string (not sql.NullString); a NULL in any of them
-- makes every auth call fail with: 500 "Database error querying schema".
UPDATE auth.users SET confirmation_token        = '' WHERE confirmation_token        IS NULL;
UPDATE auth.users SET recovery_token            = '' WHERE recovery_token            IS NULL;
UPDATE auth.users SET email_change_token_new    = '' WHERE email_change_token_new    IS NULL;
UPDATE auth.users SET email_change_token_current= '' WHERE email_change_token_current IS NULL;
UPDATE auth.users SET email_change              = '' WHERE email_change              IS NULL;
UPDATE auth.users SET phone_change              = '' WHERE phone_change              IS NULL;
UPDATE auth.users SET phone_change_token        = '' WHERE phone_change_token        IS NULL;
UPDATE auth.users SET reauthentication_token    = '' WHERE reauthentication_token    IS NULL;

-- Redefine admin_create_user so future admin-created users have '' instead of NULL
-- in every string column GoTrue scans.
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

  UPDATE app_users SET role = new_role WHERE id = new_user_id;

END;
$$ LANGUAGE plpgsql;
