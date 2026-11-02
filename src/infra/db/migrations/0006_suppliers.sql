CREATE TABLE "supplier_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"supplier_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"package_label" text,
	"package_quantity" numeric(14, 4),
	"price" numeric(14, 4) NOT NULL,
	"preferred" boolean DEFAULT false NOT NULL,
	CONSTRAINT "supplier_items_price" CHECK (price > 0),
	CONSTRAINT "supplier_items_package_pair" CHECK ((package_label is null) = (package_quantity is null)),
	CONSTRAINT "supplier_items_package_quantity" CHECK (package_quantity > 0)
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"legal_name" text,
	"cnpj" char(14),
	"contact_name" text,
	"phone" text,
	"email" text,
	"delivery_days" smallint[] DEFAULT '{}' NOT NULL,
	"lead_time_days" smallint,
	"min_order_value" numeric(14, 2),
	"payment_terms" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "suppliers_lead_time" CHECK (lead_time_days between 0 and 90),
	CONSTRAINT "suppliers_min_order" CHECK (min_order_value >= 0),
	CONSTRAINT "suppliers_delivery_days" CHECK (delivery_days <@ '{0,1,2,3,4,5,6}'::smallint[])
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_items" ADD CONSTRAINT "supplier_items_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_items_supplier_item" ON "supplier_items" USING btree ("supplier_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_items_preferred" ON "supplier_items" USING btree ("restaurant_id","item_id") WHERE preferred;--> statement-breakpoint
CREATE INDEX "supplier_items_item" ON "supplier_items" USING btree ("restaurant_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_cnpj" ON "suppliers" USING btree ("restaurant_id","cnpj") WHERE cnpj is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_active_name" ON "suppliers" USING btree ("restaurant_id","name_normalized") WHERE active;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movements_supplier" ON "stock_movements" USING btree ("restaurant_id","supplier_id","item_id","created_at");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_supplier_purchase" CHECK (supplier_id is null or type = 'PURCHASE');--> statement-breakpoint
-- Feature 007: permissões da aplicação e isolamento por restaurante.
GRANT SELECT, INSERT, UPDATE ON suppliers TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON supplier_items TO app_user;--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['suppliers', 'supplier_items'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (restaurant_id = app_current_restaurant()) WITH CHECK (restaurant_id = app_current_restaurant())',
      t
    );
  END LOOP;
END $$;
