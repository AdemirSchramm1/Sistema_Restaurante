CREATE TYPE "public"."menu_access_kind" AS ENUM('QR', 'TABLET');--> statement-breakpoint
ALTER TYPE "public"."menu_access_end_reason" ADD VALUE 'RELEASED';--> statement-breakpoint
ALTER TYPE "public"."menu_access_end_reason" ADD VALUE 'LINK_ROTATED';--> statement-breakpoint
ALTER TYPE "public"."order_source" ADD VALUE 'TABLET';--> statement-breakpoint
ALTER TABLE "menu_accesses" DROP CONSTRAINT "menu_accesses_twenty_minutes";--> statement-breakpoint
ALTER TABLE "orders" DROP CONSTRAINT "orders_source_shape";--> statement-breakpoint
ALTER TABLE "menu_accesses" ALTER COLUMN "expires_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "logo_base" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "logo_widths" smallint[];--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "cover_base" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "cover_widths" smallint[];--> statement-breakpoint
ALTER TABLE "dining_tables" ADD COLUMN "tablet_token" text;--> statement-breakpoint
ALTER TABLE "dining_tables" ADD COLUMN "tablet_token_rotated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "menu_accesses" ADD COLUMN "kind" "menu_access_kind" DEFAULT 'QR' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_accesses" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "menu_accesses_one_tablet" ON "menu_accesses" USING btree ("table_id") WHERE kind = 'TABLET' and ended_at is null;--> statement-breakpoint
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_tablet_token_unique" UNIQUE("tablet_token");--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_logo_pair" CHECK ((logo_base is null) = (logo_widths is null) and (logo_widths is null or cardinality(logo_widths) >= 1));--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_cover_pair" CHECK ((cover_base is null) = (cover_widths is null) and (cover_widths is null or cardinality(cover_widths) >= 1));--> statement-breakpoint
ALTER TABLE "dining_tables" ADD CONSTRAINT "dining_tables_tablet_token_pair" CHECK ((tablet_token is null) = (tablet_token_rotated_at is null));--> statement-breakpoint
ALTER TABLE "menu_accesses" ADD CONSTRAINT "menu_accesses_expiry_by_kind" CHECK ((kind = 'QR' and expires_at is not null and expires_at = opened_at + interval '20 minutes') or (kind = 'TABLET' and expires_at is null));--> statement-breakpoint
ALTER TABLE "menu_accesses" ADD CONSTRAINT "menu_accesses_last_seen" CHECK (kind = 'TABLET' or last_seen_at is null);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_source_shape" CHECK ((source::text in ('QR', 'TABLET') and menu_access_id is not null and placed_by is null) or (source = 'STAFF' and menu_access_id is null and placed_by is not null));--> statement-breakpoint
-- Depois de ligar, o acesso só muda o fim e o sinal de vida; nada é apagado (spec 016, data-model).
CREATE FUNCTION app_menu_access_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'APPEND_ONLY: % não aceita %', TG_TABLE_NAME, TG_OP USING ERRCODE = 'P0001';
  END IF;
  IF (NEW.id, NEW.restaurant_id, NEW.created_at, NEW.created_by, NEW.table_id, NEW.token_hash,
      NEW.opened_at, NEW.expires_at, NEW.kind, NEW.ip, NEW.user_agent)
     IS DISTINCT FROM
     (OLD.id, OLD.restaurant_id, OLD.created_at, OLD.created_by, OLD.table_id, OLD.token_hash,
      OLD.opened_at, OLD.expires_at, OLD.kind, OLD.ip, OLD.user_agent) THEN
    RAISE EXCEPTION 'APPEND_ONLY: menu_accesses só muda o fim e o sinal de vida' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER menu_accesses_frozen BEFORE UPDATE OR DELETE ON menu_accesses
  FOR EACH ROW EXECUTE FUNCTION app_menu_access_frozen();--> statement-breakpoint
-- Rota pública do tablet: mesa pelo link, e o tipo do acesso pelo hash do cookie.
CREATE FUNCTION app_table_by_tablet_token(p_token text)
  RETURNS TABLE (restaurant_id uuid, table_id uuid, active boolean)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT t.restaurant_id, t.id, t.active FROM dining_tables t WHERE t.tablet_token = p_token
$$;--> statement-breakpoint
DROP FUNCTION app_menu_access_by_token_hash(text);--> statement-breakpoint
CREATE FUNCTION app_menu_access_by_token_hash(p_hash text)
  RETURNS TABLE (restaurant_id uuid, menu_access_id uuid, kind menu_access_kind)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT a.restaurant_id, a.id, a.kind FROM menu_accesses a WHERE a.token_hash = p_hash
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_table_by_tablet_token(text), app_menu_access_by_token_hash(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_table_by_tablet_token(text), app_menu_access_by_token_hash(text) TO app_user;
