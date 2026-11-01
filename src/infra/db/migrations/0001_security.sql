-- Segurança e seeds da feature 001 (ADR 0004).
-- A aplicação conecta com um papel que NÃO é dono das tabelas e NÃO tem BYPASSRLS,
-- membro de `app_user`. Migrações rodam com o papel dono.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END $$;--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON
  users, sessions, accounts, verifications,
  restaurants, memberships, membership_roles, invitations,
  item_groups, item_subgroups, locations, items, item_unit_conversions, item_locations
TO app_user;--> statement-breakpoint
GRANT SELECT ON units TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT ON audit_log TO app_user;--> statement-breakpoint

-- Row Level Security: cada transação define app.restaurant_id (withTenantTx).
CREATE FUNCTION app_current_restaurant() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.restaurant_id', true), '')::uuid $$;--> statement-breakpoint

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON restaurants
  USING (id = app_current_restaurant()) WITH CHECK (id = app_current_restaurant());--> statement-breakpoint

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'memberships', 'membership_roles', 'invitations', 'item_groups', 'item_subgroups',
    'locations', 'items', 'item_unit_conversions', 'item_locations', 'audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (restaurant_id = app_current_restaurant()) WITH CHECK (restaurant_id = app_current_restaurant())',
      t
    );
  END LOOP;
END $$;--> statement-breakpoint

-- Trilha de auditoria: só inserção (segunda barreira, além do GRANT).
CREATE FUNCTION app_reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY: % não aceita %', TG_TABLE_NAME, TG_OP USING ERRCODE = 'P0001';
END $$;--> statement-breakpoint
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION app_reject_change();--> statement-breakpoint

-- Unidade de estoque bloqueada depois da 1ª movimentação (FR-023, research R8).
CREATE FUNCTION app_lock_stock_unit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.stock_unit_locked_at IS NOT NULL AND NEW.stock_unit_id IS DISTINCT FROM OLD.stock_unit_id THEN
    RAISE EXCEPTION 'ITEM_UNIT_LOCKED' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER items_stock_unit_lock BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION app_lock_stock_unit();--> statement-breakpoint

-- Consultas que precisam atravessar o RLS antes de saber o restaurante.
-- SECURITY DEFINER: rodam como dono e devolvem só o mínimo.
CREATE FUNCTION app_membership_for_user(p_user_id uuid)
  RETURNS TABLE (restaurant_id uuid, membership_id uuid, active boolean)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT m.restaurant_id, m.id, m.active FROM memberships m WHERE m.user_id = p_user_id
$$;--> statement-breakpoint
CREATE FUNCTION app_invitation_by_token_hash(p_hash text)
  RETURNS TABLE (restaurant_id uuid, invitation_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT i.restaurant_id, i.id FROM invitations i WHERE i.token_hash = p_hash
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_membership_for_user(uuid), app_invitation_by_token_hash(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_membership_for_user(uuid), app_invitation_by_token_hash(text), app_current_restaurant() TO app_user;--> statement-breakpoint

-- Catálogo global de unidades (igual a src/domain/inventory/units.ts).
INSERT INTO units (id, code, dimension, to_base, label) VALUES
  ('0193a000-0000-7000-8000-000000000001', 'g',  'MASS',   1,    'grama'),
  ('0193a000-0000-7000-8000-000000000002', 'kg', 'MASS',   1000, 'quilograma'),
  ('0193a000-0000-7000-8000-000000000003', 'ml', 'VOLUME', 1,    'mililitro'),
  ('0193a000-0000-7000-8000-000000000004', 'l',  'VOLUME', 1000, 'litro'),
  ('0193a000-0000-7000-8000-000000000005', 'un', 'COUNT',  1,    'unidade');
