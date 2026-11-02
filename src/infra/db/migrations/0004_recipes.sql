-- Feature 003: produtos e preparos (specs/003-produtos/plan.md).
CREATE TYPE "public"."recipe_kind" AS ENUM('DISH', 'SUB_RECIPE');--> statement-breakpoint
CREATE TABLE "recipe_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"recipe_version_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"item_id" uuid,
	"sub_recipe_id" uuid,
	"quantity" numeric(14, 4) NOT NULL,
	"unit_id" uuid NOT NULL,
	CONSTRAINT "recipe_lines_one_component" CHECK ((item_id is null) <> (sub_recipe_id is null)),
	CONSTRAINT "recipe_lines_quantity_positive" CHECK (quantity > 0)
);
--> statement-breakpoint
CREATE TABLE "recipe_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"recipe_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"yield_quantity" numeric(14, 4),
	"yield_unit_id" uuid,
	CONSTRAINT "recipe_versions_yield_pair" CHECK ((yield_quantity is null) = (yield_unit_id is null)),
	CONSTRAINT "recipe_versions_yield_positive" CHECK (yield_quantity > 0)
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"kind" "recipe_kind" NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_recipe_version_id_recipe_versions_id_fk" FOREIGN KEY ("recipe_version_id") REFERENCES "public"."recipe_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_sub_recipe_id_recipes_id_fk" FOREIGN KEY ("sub_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_lines" ADD CONSTRAINT "recipe_lines_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_versions" ADD CONSTRAINT "recipe_versions_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_versions" ADD CONSTRAINT "recipe_versions_yield_unit_id_units_id_fk" FOREIGN KEY ("yield_unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_lines_position" ON "recipe_lines" USING btree ("recipe_version_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_lines_item" ON "recipe_lines" USING btree ("recipe_version_id","item_id") WHERE item_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_lines_sub_recipe" ON "recipe_lines" USING btree ("recipe_version_id","sub_recipe_id") WHERE sub_recipe_id is not null;--> statement-breakpoint
CREATE INDEX "recipe_lines_sub_recipe_lookup" ON "recipe_lines" USING btree ("sub_recipe_id");--> statement-breakpoint
CREATE UNIQUE INDEX "recipe_versions_number" ON "recipe_versions" USING btree ("recipe_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "recipes_active_name" ON "recipes" USING btree ("restaurant_id","name_normalized") WHERE active;--> statement-breakpoint
-- Versões e linhas são só inserção: a aplicação não tem UPDATE/DELETE e o gatilho barra até o dono.
GRANT SELECT, INSERT, UPDATE ON recipes TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT ON recipe_versions, recipe_lines TO app_user;--> statement-breakpoint
CREATE TRIGGER recipe_versions_append_only BEFORE UPDATE OR DELETE ON recipe_versions
  FOR EACH ROW EXECUTE FUNCTION app_reject_change();--> statement-breakpoint
CREATE TRIGGER recipe_lines_append_only BEFORE UPDATE OR DELETE ON recipe_lines
  FOR EACH ROW EXECUTE FUNCTION app_reject_change();--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['recipes', 'recipe_versions', 'recipe_lines'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (restaurant_id = app_current_restaurant()) WITH CHECK (restaurant_id = app_current_restaurant())',
      t
    );
  END LOOP;
END $$;
