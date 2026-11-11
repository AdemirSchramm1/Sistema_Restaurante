CREATE TYPE "public"."menu_access_end_reason" AS ENUM('RESCAN', 'TAB_CLOSED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'PIX', 'DEBIT_CARD', 'CREDIT_CARD', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."tab_event_kind" AS ENUM('OPENED', 'PAYMENT_ADDED', 'PAYMENT_REMOVED', 'SERVICE_WAIVED', 'SERVICE_RESTORED', 'CLOSED', 'REOPENED');--> statement-breakpoint
CREATE TYPE "public"."tab_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'CASHIER';--> statement-breakpoint
ALTER TYPE "public"."movement_type" ADD VALUE 'SALE_RECIPE';--> statement-breakpoint
CREATE TABLE "tab_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"tab_id" uuid NOT NULL,
	"kind" "tab_event_kind" NOT NULL,
	"reason" text,
	"details" jsonb,
	"user_id" uuid,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "tab_events_reason" CHECK ((kind = 'REOPENED') = (reason is not null)),
	CONSTRAINT "tab_events_reason_length" CHECK (char_length(reason) between 1 and 140),
	CONSTRAINT "tab_events_user" CHECK (kind = 'OPENED' or user_id is not null)
);
--> statement-breakpoint
CREATE TABLE "tab_payment_removals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"payment_id" uuid NOT NULL,
	CONSTRAINT "tab_payment_removals_by" CHECK (created_by is not null)
);
--> statement-breakpoint
CREATE TABLE "tab_payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"tab_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"received" numeric(12, 2),
	"change" numeric(12, 2),
	"client_request_id" uuid NOT NULL,
	CONSTRAINT "tab_payments_amount" CHECK (amount > 0),
	CONSTRAINT "tab_payments_by" CHECK (created_by is not null),
	CONSTRAINT "tab_payments_cash" CHECK (case when method = 'CASH' then received is not null and change >= 0 and received = amount + change else received is null and change is null end)
);
--> statement-breakpoint
CREATE TABLE "table_tabs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"table_id" uuid NOT NULL,
	"status" "tab_status" DEFAULT 'OPEN' NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"service_rate" numeric(5, 2),
	"service_waived" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	"closed_day" date,
	"subtotal" numeric(12, 2),
	"service_charge" numeric(12, 2),
	"total" numeric(12, 2),
	CONSTRAINT "table_tabs_service_rate" CHECK (service_rate between 0 and 20),
	CONSTRAINT "table_tabs_closed" CHECK (num_nonnulls(closed_at, closed_by, closed_day, subtotal, service_charge, total) = case when status = 'CLOSED' then 6 else 0 end),
	CONSTRAINT "table_tabs_total" CHECK (total = subtotal + service_charge)
);
--> statement-breakpoint
ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_reason";--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "service_charge_rate" numeric(5, 2) DEFAULT '10.00';--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "order_id" uuid;--> statement-breakpoint
ALTER TABLE "menu_accesses" ADD COLUMN "end_reason" "menu_access_end_reason";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tab_id" uuid;--> statement-breakpoint
ALTER TABLE "tab_events" ADD CONSTRAINT "tab_events_tab_id_table_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."table_tabs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tab_payment_removals" ADD CONSTRAINT "tab_payment_removals_payment_id_tab_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."tab_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tab_payments" ADD CONSTRAINT "tab_payments_tab_id_table_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."table_tabs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_tabs" ADD CONSTRAINT "table_tabs_table_id_dining_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."dining_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tab_events_tab" ON "tab_events" USING btree ("tab_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "tab_payment_removals_payment" ON "tab_payment_removals" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tab_payments_client_request" ON "tab_payments" USING btree ("tab_id","client_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "table_tabs_one_open" ON "table_tabs" USING btree ("restaurant_id","table_id") WHERE status = 'OPEN';--> statement-breakpoint
CREATE INDEX "table_tabs_closed_day" ON "table_tabs" USING btree ("restaurant_id","closed_day");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tab_id_table_tabs_id_fk" FOREIGN KEY ("tab_id") REFERENCES "public"."table_tabs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_sale_once" ON "stock_movements" USING btree ("order_id","item_id") WHERE order_id is not null and reason_id is null;--> statement-breakpoint
CREATE INDEX "stock_movements_order" ON "stock_movements" USING btree ("order_id") WHERE order_id is not null;--> statement-breakpoint
CREATE INDEX "menu_accesses_table" ON "menu_accesses" USING btree ("restaurant_id","table_id","expires_at");--> statement-breakpoint
CREATE INDEX "orders_tab" ON "orders" USING btree ("tab_id");--> statement-breakpoint
ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_service_charge_rate" CHECK (service_charge_rate between 0 and 20);--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_order" CHECK (type::text <> 'SALE_RECIPE' or order_id is not null);--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_out" CHECK (type::text <> 'SALE_RECIPE' or quantity < 0);--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_type" CHECK (order_id is null or type::text in ('SALE_RECIPE', 'REVERSAL', 'LOSS'));--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reason" CHECK ((type::text in ('PURCHASE', 'SALE_RECIPE')) = (reason_id is null));--> statement-breakpoint
-- Acessos encerrados antes da 011 foram por nova leitura do QR code (spec 009).
UPDATE menu_accesses SET end_reason = 'RESCAN' WHERE ended_at IS NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_accesses" ADD CONSTRAINT "menu_accesses_end_reason" CHECK ((ended_at is null) = (end_reason is null));--> statement-breakpoint
-- Conta: a aplicação abre, muda a situação e fecha; pagamentos, remoções e histórico são só inserção.
GRANT SELECT, INSERT, UPDATE ON table_tabs TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT ON tab_payments, tab_payment_removals, tab_events TO app_user;--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['table_tabs', 'tab_payments', 'tab_payment_removals', 'tab_events'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (restaurant_id = app_current_restaurant()) WITH CHECK (restaurant_id = app_current_restaurant())',
      t
    );
  END LOOP;
END $$;--> statement-breakpoint
CREATE TRIGGER tab_payments_append_only BEFORE UPDATE OR DELETE ON tab_payments
  FOR EACH ROW EXECUTE FUNCTION app_reject_change();--> statement-breakpoint
CREATE TRIGGER tab_payment_removals_append_only BEFORE UPDATE OR DELETE ON tab_payment_removals
  FOR EACH ROW EXECUTE FUNCTION app_reject_change();--> statement-breakpoint
CREATE TRIGGER tab_events_append_only BEFORE UPDATE OR DELETE ON tab_events
  FOR EACH ROW EXECUTE FUNCTION app_reject_change();--> statement-breakpoint
-- Conta não some e não troca de mesa, abertura nem taxa copiada do restaurante.
CREATE FUNCTION app_tab_fixed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'APPEND_ONLY: % não aceita %', TG_TABLE_NAME, TG_OP USING ERRCODE = 'P0001';
  END IF;
  IF (NEW.id, NEW.restaurant_id, NEW.created_at, NEW.created_by, NEW.table_id, NEW.opened_at, NEW.service_rate)
     IS DISTINCT FROM
     (OLD.id, OLD.restaurant_id, OLD.created_at, OLD.created_by, OLD.table_id, OLD.opened_at, OLD.service_rate) THEN
    RAISE EXCEPTION 'APPEND_ONLY: table_tabs só muda a situação, a taxa tirada e o fechamento' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER table_tabs_fixed BEFORE UPDATE OR DELETE ON table_tabs
  FOR EACH ROW EXECUTE FUNCTION app_tab_fixed();--> statement-breakpoint
-- Pedido também não troca de conta (spec 011).
CREATE OR REPLACE FUNCTION app_order_status_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'APPEND_ONLY: % não aceita %', TG_TABLE_NAME, TG_OP USING ERRCODE = 'P0001';
  END IF;
  IF (NEW.id, NEW.restaurant_id, NEW.created_at, NEW.created_by, NEW.table_id, NEW.menu_access_id,
      NEW.client_request_id, NEW.business_day, NEW.number, NEW.total, NEW.submitted_at, NEW.tab_id)
     IS DISTINCT FROM
     (OLD.id, OLD.restaurant_id, OLD.created_at, OLD.created_by, OLD.table_id, OLD.menu_access_id,
      OLD.client_request_id, OLD.business_day, OLD.number, OLD.total, OLD.submitted_at, OLD.tab_id) THEN
    RAISE EXCEPTION 'APPEND_ONLY: orders só muda a situação' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
-- Motivos do cancelamento de pedido (igual a src/domain/inventory/movement-reasons.ts).
INSERT INTO movement_reasons (id, movement_type, code, label, family, position) VALUES
  ('0193a100-0000-7000-8000-000000000012', 'LOSS', 'ORDER_CANCELLED', 'Pedido cancelado', 'OPERATIONAL', 19),
  ('0193a100-0000-7000-8000-000000000034', 'REVERSAL', 'ORDER_CANCELLED', 'Pedido cancelado', 'REVERSAL', 20);
