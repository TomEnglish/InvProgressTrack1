-- Backfill NULL timestamp columns on auth.users.
-- GoTrue scans created_at/updated_at as *time.Time without NullTime support; NULLs here
-- cause: 500 "Database error querying schema" / "storing driver.Value type <nil> into type *time.Time".
UPDATE auth.users
SET created_at = COALESCE(email_confirmed_at, now())
WHERE created_at IS NULL;

UPDATE auth.users
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL;
