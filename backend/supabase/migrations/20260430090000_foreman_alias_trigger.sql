-- ============================================================================
-- Foreman alias auto-resolve trigger
-- ============================================================================
-- When a progress_items row is inserted/updated with a foreman_name and no
-- foreman_user_id, look up the alias table and fill in the user_id if found.
-- Lets imports stay simple ("foreman" string from the xlsx) while still
-- linking to a real user when an admin has registered the alias.
-- ============================================================================

CREATE OR REPLACE FUNCTION resolve_foreman_user_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.foreman_name IS NOT NULL AND NEW.foreman_user_id IS NULL THEN
    NEW.foreman_user_id := (
      SELECT user_id FROM foreman_aliases WHERE name = NEW.foreman_name
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS resolve_foreman_user_id_trigger ON progress_items;
CREATE TRIGGER resolve_foreman_user_id_trigger
  BEFORE INSERT OR UPDATE OF foreman_name, foreman_user_id ON progress_items
  FOR EACH ROW EXECUTE PROCEDURE resolve_foreman_user_id();

-- When a new alias is registered, retroactively resolve unmatched items.
CREATE OR REPLACE FUNCTION backfill_foreman_alias()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE progress_items
     SET foreman_user_id = NEW.user_id
   WHERE foreman_name = NEW.name
     AND foreman_user_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS backfill_foreman_alias_trigger ON foreman_aliases;
CREATE TRIGGER backfill_foreman_alias_trigger
  AFTER INSERT OR UPDATE ON foreman_aliases
  FOR EACH ROW EXECUTE PROCEDURE backfill_foreman_alias();
