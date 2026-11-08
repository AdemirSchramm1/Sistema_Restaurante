-- Feature 010: adicionar e tirar por botão (specs/010-adicionais-retiradas/data-model.md).
CREATE TABLE "addons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"item_id" uuid,
	"sub_recipe_id" uuid,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_id" uuid NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "addons_one_component" CHECK ((item_id is null) <> (sub_recipe_id is null)),
	CONSTRAINT "addons_quantity_positive" CHECK (quantity > 0),
	CONSTRAINT "addons_price" CHECK (price >= 0),
	CONSTRAINT "addons_name_length" CHECK (char_length(name) between 1 and 40)
);
--> statement-breakpoint
CREATE TABLE "order_line_addons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"order_line_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"name" text NOT NULL,
	"times" smallint NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"item_id" uuid,
	"sub_recipe_id" uuid,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_id" uuid NOT NULL,
	CONSTRAINT "order_line_addons_times" CHECK (times between 1 and 5),
	CONSTRAINT "order_line_addons_price" CHECK (unit_price >= 0),
	CONSTRAINT "order_line_addons_one_component" CHECK ((item_id is null) <> (sub_recipe_id is null))
);
--> statement-breakpoint
CREATE TABLE "order_line_removals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"order_line_id" uuid NOT NULL,
	"item_id" uuid,
	"sub_recipe_id" uuid,
	"label" text NOT NULL,
	CONSTRAINT "order_line_removals_one_component" CHECK ((item_id is null) <> (sub_recipe_id is null))
);
--> statement-breakpoint
CREATE TABLE "recipe_addons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"recipe_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"max_times" smallint NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "recipe_addons_max_times" CHECK (max_times between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "recipe_removables" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"recipe_id" uuid NOT NULL,
	"item_id" uuid,
	"sub_recipe_id" uuid,
	"label" text NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "recipe_removables_one_component" CHECK ((item_id is null) <> (sub_recipe_id is null)),
	CONSTRAINT "recipe_removables_label" CHECK (char_length(label) between 1 and 40)
);
--> statement-breakpoint
ALTER TABLE "addons" ADD CONSTRAINT "addons_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addons" ADD CONSTRAINT "addons_sub_recipe_id_recipes_id_fk" FOREIGN KEY ("sub_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addons" ADD CONSTRAINT "addons_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_addons" ADD CONSTRAINT "order_line_addons_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_addons" ADD CONSTRAINT "order_line_addons_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_addons" ADD CONSTRAINT "order_line_addons_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_addons" ADD CONSTRAINT "order_line_addons_sub_recipe_id_recipes_id_fk" FOREIGN KEY ("sub_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_addons" ADD CONSTRAINT "order_line_addons_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_removals" ADD CONSTRAINT "order_line_removals_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_removals" ADD CONSTRAINT "order_line_removals_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line_removals" ADD CONSTRAINT "order_line_removals_sub_recipe_id_recipes_id_fk" FOREIGN KEY ("sub_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_addons" ADD CONSTRAINT "recipe_addons_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_addons" ADD CONSTRAINT "recipe_addons_addon_id_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_removables" ADD CONSTRAINT "recipe_removables_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_removables" ADD CONSTRAINT "recipe_removables_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_removables" ADD CONSTRAINT "recipe_removables_sub_recipe_id_recipes_id_fk" FOREIGN KEY ("sub_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "addons_active_name" ON "addons" USING btree ("restaurant_id","name_normalized") WHERE active;--> statement-breakpoint
CREATE UNIQUE INDEX "order_line_addons_unique" ON "order_line_addons" USING btree ("order_line_id","addon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_line_removals_item" ON "order_line_removals" USING btree ("order_line_id","item_id") WHERE item_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "order_line_removals_sub_recipe" ON "order_line_removals" USING btree ("order_line_id","sub_recipe_id") WHERE sub_recipe_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_addons_unique" ON "recipe_addons" USING btree ("recipe_id","addon_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_removables_item" ON "recipe_removables" USING btree ("recipe_id","item_id") WHERE item_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_removables_sub_recipe" ON "recipe_removables" USING btree ("recipe_id","sub_recipe_id") WHERE sub_recipe_id is not null;--> statement-breakpoint
-- Feature 010: permissões da aplicação, isolamento e escolhas do pedido só de inserção.
GRANT SELECT, INSERT, UPDATE ON addons TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON recipe_addons, recipe_removables TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT ON order_line_addons, order_line_removals TO app_user;--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'addons', 'recipe_addons', 'recipe_removables', 'order_line_addons', 'order_line_removals'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (restaurant_id = app_current_restaurant()) WITH CHECK (restaurant_id = app_current_restaurant())',
      t
    );
  END LOOP;
END $$;--> statement-breakpoint
CREATE TRIGGER order_line_addons_append_only BEFORE UPDATE OR DELETE ON order_line_addons
  FOR EACH ROW EXECUTE FUNCTION app_reject_change();--> statement-breakpoint
CREATE TRIGGER order_line_removals_append_only BEFORE UPDATE OR DELETE ON order_line_removals
  FOR EACH ROW EXECUTE FUNCTION app_reject_change();
