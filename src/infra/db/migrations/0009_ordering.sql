-- Feature 009: pedidos pelo QR code da mesa (specs/009-pedidos-qr-mesa/data-model.md).
CREATE TYPE "public"."order_cancel_reason" AS ENUM('CUSTOMER_GAVE_UP', 'OUT_OF_PRODUCT', 'IMPROPER_ORDER', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('RECEIVED', 'PREPARING', 'READY', 'DELIVERED', 'CANCELLED');--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'WAITER';--> statement-breakpoint
CREATE TABLE "dining_tables" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"qr_token" text NOT NULL,
	"qr_rotated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "dining_tables_qr_token_unique" UNIQUE("qr_token"),
	CONSTRAINT "dining_tables_name_length" CHECK (char_length(name) between 1 and 30)
);
--> statement-breakpoint
CREATE TABLE "menu_accesses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"table_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"ip" text,
	"user_agent" text,
	CONSTRAINT "menu_accesses_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "menu_accesses_twenty_minutes" CHECK (expires_at = opened_at + interval '20 minutes')
);
--> statement-breakpoint
CREATE TABLE "order_day_counters" (
	"restaurant_id" uuid NOT NULL,
	"business_day" date NOT NULL,
	"last_number" integer NOT NULL,
	CONSTRAINT "order_day_counters_restaurant_id_business_day_pk" PRIMARY KEY("restaurant_id","business_day")
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"order_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"recipe_id" uuid NOT NULL,
	"recipe_version_id" uuid NOT NULL,
	"quantity" smallint NOT NULL,
	"base_price" numeric(12, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	CONSTRAINT "order_lines_quantity" CHECK (quantity between 1 and 20),
	CONSTRAINT "order_lines_base_price" CHECK (base_price > 0),
	CONSTRAINT "order_lines_unit_price" CHECK (unit_price >= base_price)
);
--> statement-breakpoint
CREATE TABLE "order_status_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"reason" "order_cancel_reason",
	"user_id" uuid,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"table_id" uuid NOT NULL,
	"menu_access_id" uuid NOT NULL,
	"client_request_id" uuid NOT NULL,
	"business_day" date NOT NULL,
	"number" integer NOT NULL,
	"status" "order_status" NOT NULL,
	"cancel_reason" "order_cancel_reason",
	"cancel_note" text,
	"total" numeric(12, 2) NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"status_changed_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "orders_total_positive" CHECK (total > 0),
	CONSTRAINT "orders_cancel_reason" CHECK ((status = 'CANCELLED') = (cancel_reason is not null)),
	CONSTRAINT "orders_cancel_note" CHECK (cancel_reason is distinct from 'OTHER' or cancel_note is not null),
	CONSTRAINT "orders_cancel_note_length" CHECK (char_length(cancel_note) <= 140)
);
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "accepting_qr_orders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "sold_out_on" date;--> statement-breakpoint
ALTER TABLE "menu_accesses" ADD CONSTRAINT "menu_accesses_table_id_dining_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."dining_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_recipe_version_id_recipe_versions_id_fk" FOREIGN KEY ("recipe_version_id") REFERENCES "public"."recipe_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_dining_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."dining_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_menu_access_id_menu_accesses_id_fk" FOREIGN KEY ("menu_access_id") REFERENCES "public"."menu_accesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dining_tables_active_name" ON "dining_tables" USING btree ("restaurant_id","name_normalized") WHERE active;--> statement-breakpoint
CREATE INDEX "menu_accesses_open" ON "menu_accesses" USING btree ("restaurant_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "order_lines_position" ON "order_lines" USING btree ("order_id","position");--> statement-breakpoint
CREATE INDEX "order_status_events_order" ON "order_status_events" USING btree ("order_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_client_request" ON "orders" USING btree ("menu_access_id","client_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_day_number" ON "orders" USING btree ("restaurant_id","business_day","number");--> statement-breakpoint
CREATE INDEX "orders_open" ON "orders" USING btree ("restaurant_id","status","submitted_at");--> statement-breakpoint
CREATE INDEX "orders_day" ON "orders" USING btree ("restaurant_id","business_day");--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_sold_out_dish" CHECK (sold_out_on is null or kind = 'DISH');--> statement-breakpoint
-- Feature 009: permissões da aplicação, isolamento, livro só de inserção e busca pública pelo token.
GRANT SELECT, INSERT, UPDATE ON dining_tables, menu_accesses, orders, order_day_counters TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT ON order_lines, order_status_events TO app_user;--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'dining_tables', 'menu_accesses', 'orders', 'order_lines', 'order_status_events', 'order_day_counters'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (restaurant_id = app_current_restaurant()) WITH CHECK (restaurant_id = app_current_restaurant())',
      t
    );
  END LOOP;
END $$;--> statement-breakpoint
CREATE TRIGGER order_lines_append_only BEFORE UPDATE OR DELETE ON order_lines
  FOR EACH ROW EXECUTE FUNCTION app_reject_change();--> statement-breakpoint
CREATE TRIGGER order_status_events_append_only BEFORE UPDATE OR DELETE ON order_status_events
  FOR EACH ROW EXECUTE FUNCTION app_reject_change();--> statement-breakpoint
-- Pedido: só a situação muda; nada é apagado.
CREATE FUNCTION app_order_status_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'APPEND_ONLY: % não aceita %', TG_TABLE_NAME, TG_OP USING ERRCODE = 'P0001';
  END IF;
  IF (NEW.id, NEW.restaurant_id, NEW.created_at, NEW.created_by, NEW.table_id, NEW.menu_access_id,
      NEW.client_request_id, NEW.business_day, NEW.number, NEW.total, NEW.submitted_at)
     IS DISTINCT FROM
     (OLD.id, OLD.restaurant_id, OLD.created_at, OLD.created_by, OLD.table_id, OLD.menu_access_id,
      OLD.client_request_id, OLD.business_day, OLD.number, OLD.total, OLD.submitted_at) THEN
    RAISE EXCEPTION 'APPEND_ONLY: orders só muda a situação' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER orders_status_only BEFORE UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION app_order_status_only();--> statement-breakpoint
-- Rota pública: acha restaurante e mesa pelo token do QR code, e o acesso pelo hash do cookie.
CREATE FUNCTION app_table_by_qr_token(p_token text)
  RETURNS TABLE (restaurant_id uuid, table_id uuid, active boolean)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT t.restaurant_id, t.id, t.active FROM dining_tables t WHERE t.qr_token = p_token
$$;--> statement-breakpoint
CREATE FUNCTION app_menu_access_by_token_hash(p_hash text)
  RETURNS TABLE (restaurant_id uuid, menu_access_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT a.restaurant_id, a.id FROM menu_accesses a WHERE a.token_hash = p_hash
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION app_table_by_qr_token(text), app_menu_access_by_token_hash(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_table_by_qr_token(text), app_menu_access_by_token_hash(text) TO app_user;
