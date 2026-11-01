-- Feature 002: cadastro simplificado (docs/produto/estoque/13-decisoes-adotadas.md).
-- Sai tudo o que é sanitário, fiscal, de contagem e a unidade de receita.
-- A quarentena antiga deixa de ser registro de sistema para o gerente poder inativá-la.
UPDATE "locations" SET "is_system" = false WHERE "kind" = 'QUARANTINE';--> statement-breakpoint
ALTER TABLE "item_unit_conversions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "item_unit_conversions" CASCADE;--> statement-breakpoint
ALTER TABLE "item_locations" DROP CONSTRAINT "item_locations_position";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_correction_factor";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_yield_factor";--> statement-breakpoint
ALTER TABLE "locations" DROP CONSTRAINT "locations_temp_required";--> statement-breakpoint
ALTER TABLE "locations" DROP CONSTRAINT "locations_temp_order";--> statement-breakpoint
ALTER TABLE "locations" DROP CONSTRAINT "locations_count_order";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_recipe_unit_id_units_id_fk";
--> statement-breakpoint
DROP INDEX "locations_one_system_quarantine";--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "purchase_unit_label" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "purchase_factor" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "item_locations" DROP COLUMN "sheet_position";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "recipe_unit_id";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "ean_unit";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "ean_package";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "no_gtin";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "financial_category";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "presentation";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "net_weight";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "drained_weight";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "catch_weight";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "correction_factor";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "yield_factor";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "storage_temp_max_c";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "receiving_temp_min_c";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "receiving_temp_max_c";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "shelf_life_days";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "opened_life_days";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "lot_control";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "expiry_alert_days";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "allergens";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "ncm";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "cest";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "origin";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "tax_group";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "countable";--> statement-breakpoint
ALTER TABLE "items" DROP COLUMN "count_frequency";--> statement-breakpoint
ALTER TABLE "locations" DROP COLUMN "temp_min_c";--> statement-breakpoint
ALTER TABLE "locations" DROP COLUMN "temp_max_c";--> statement-breakpoint
ALTER TABLE "locations" DROP COLUMN "responsible_user_id";--> statement-breakpoint
ALTER TABLE "locations" DROP COLUMN "count_order";--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_purchase_pair" CHECK ((purchase_unit_label is null) = (purchase_factor is null));--> statement-breakpoint
DROP TYPE "public"."count_frequency";