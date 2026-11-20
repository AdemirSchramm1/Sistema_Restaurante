CREATE TYPE "public"."order_source" AS ENUM('QR', 'STAFF');--> statement-breakpoint
ALTER TYPE "public"."order_cancel_reason" ADD VALUE 'ENTERED_BY_MISTAKE' BEFORE 'OTHER';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "menu_access_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order_lines" ADD COLUMN "kitchen_note" text;--> statement-breakpoint
-- Pedidos que já existem vieram todos pelo QR code (spec 015, data-model). O default fica: um
-- pedido da equipe sem origem cai no check orders_source_shape (tem quem lançou e não tem acesso).
ALTER TABLE "orders" ADD COLUMN "source" "order_source" DEFAULT 'QR' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "placed_by" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_placed_by_users_id_fk" FOREIGN KEY ("placed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_staff_client_request" ON "orders" USING btree ("restaurant_id","placed_by","client_request_id") WHERE source = 'STAFF';--> statement-breakpoint
CREATE INDEX "orders_placed_by" ON "orders" USING btree ("restaurant_id","placed_by","business_day") WHERE source = 'STAFF';--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_kitchen_note" CHECK (char_length(kitchen_note) between 1 and 140);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_source_shape" CHECK ((source = 'QR' and menu_access_id is not null and placed_by is null) or (source = 'STAFF' and menu_access_id is null and placed_by is not null));--> statement-breakpoint
-- Origem, quem lançou e o acesso também não mudam depois do envio (spec 015, FR-006).
CREATE OR REPLACE FUNCTION app_order_status_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'APPEND_ONLY: % não aceita %', TG_TABLE_NAME, TG_OP USING ERRCODE = 'P0001';
  END IF;
  IF (NEW.id, NEW.restaurant_id, NEW.created_at, NEW.created_by, NEW.table_id, NEW.menu_access_id,
      NEW.client_request_id, NEW.business_day, NEW.number, NEW.total, NEW.submitted_at, NEW.tab_id,
      NEW.source, NEW.placed_by)
     IS DISTINCT FROM
     (OLD.id, OLD.restaurant_id, OLD.created_at, OLD.created_by, OLD.table_id, OLD.menu_access_id,
      OLD.client_request_id, OLD.business_day, OLD.number, OLD.total, OLD.submitted_at, OLD.tab_id,
      OLD.source, OLD.placed_by) THEN
    RAISE EXCEPTION 'APPEND_ONLY: orders só muda a situação' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
