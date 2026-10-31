CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('MANAGER', 'CHEF', 'STOCKKEEPER', 'BUYER', 'ADMINISTRATIVE');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('CREATE', 'UPDATE', 'DEACTIVATE', 'REACTIVATE', 'DENIED');--> statement-breakpoint
CREATE TYPE "public"."count_frequency" AS ENUM('SHIFT', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY');--> statement-breakpoint
CREATE TYPE "public"."dimension" AS ENUM('MASS', 'VOLUME', 'COUNT');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('INGREDIENT', 'RESALE', 'PRODUCED', 'CONSUMABLE', 'ASSET');--> statement-breakpoint
CREATE TYPE "public"."location_kind" AS ENUM('DRY', 'CHILLED', 'FROZEN', 'QUARANTINE', 'IN_TRANSIT', 'CHEMICALS', 'STATION', 'BAR', 'NON_FOOD');--> statement-breakpoint
CREATE TYPE "public"."storage_class" AS ENUM('FOOD', 'CHEMICAL', 'OTHER_NON_FOOD');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"email" text NOT NULL,
	"roles" "role"[] NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "invitation_status" DEFAULT 'PENDING' NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "membership_roles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"membership_id" uuid NOT NULL,
	"role" "role" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"user_id" uuid NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "memberships_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"next_group_code" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"action" "audit_action" NOT NULL,
	"changes" jsonb NOT NULL,
	"user_id" uuid,
	"occurred_at" timestamp with time zone NOT NULL,
	"origin" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_groups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"code" char(2) NOT NULL,
	"name" text NOT NULL,
	"storage_class" "storage_class" NOT NULL,
	"in_cogs" boolean NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"next_subgroup_code" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_locations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"item_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sheet_position" integer NOT NULL,
	CONSTRAINT "item_locations_position" CHECK (sheet_position >= 1)
);
--> statement-breakpoint
CREATE TABLE "item_subgroups" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"group_id" uuid NOT NULL,
	"code" char(2) NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"next_item_seq" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_unit_conversions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"item_id" uuid NOT NULL,
	"from_unit_id" uuid NOT NULL,
	"to_unit_id" uuid NOT NULL,
	"factor" numeric(14, 4) NOT NULL,
	CONSTRAINT "item_unit_conversions_factor" CHECK (factor > 0)
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"description_normalized" text NOT NULL,
	"type" "item_type" NOT NULL,
	"subgroup_id" uuid NOT NULL,
	"stock_unit_id" uuid NOT NULL,
	"stock_unit_locked_at" timestamp with time zone,
	"recipe_unit_id" uuid NOT NULL,
	"purchase_unit_label" text NOT NULL,
	"purchase_factor" numeric(14, 4) NOT NULL,
	"in_cogs_override" boolean,
	"ean_unit" text,
	"ean_package" text,
	"no_gtin" boolean DEFAULT false NOT NULL,
	"financial_category" text,
	"presentation" text,
	"net_weight" numeric(14, 4),
	"drained_weight" numeric(14, 4),
	"catch_weight" boolean DEFAULT false NOT NULL,
	"correction_factor" numeric(8, 4) DEFAULT '1' NOT NULL,
	"yield_factor" numeric(8, 4),
	"storage_temp_max_c" numeric(4, 1),
	"receiving_temp_min_c" numeric(4, 1),
	"receiving_temp_max_c" numeric(4, 1),
	"shelf_life_days" integer,
	"opened_life_days" integer,
	"lot_control" boolean DEFAULT false NOT NULL,
	"expiry_alert_days" integer,
	"allergens" text[] DEFAULT '{}'::text[] NOT NULL,
	"ncm" text,
	"cest" text,
	"origin" char(1),
	"tax_group" text,
	"countable" boolean DEFAULT true NOT NULL,
	"count_frequency" "count_frequency",
	"average_cost" numeric(14, 4),
	"last_cost" numeric(14, 4),
	"cost_updated_at" timestamp with time zone,
	"abc_class" char(1),
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "items_purchase_factor" CHECK (purchase_factor > 0),
	CONSTRAINT "items_correction_factor" CHECK (correction_factor >= 1),
	CONSTRAINT "items_yield_factor" CHECK (yield_factor is null or (yield_factor > 0 and yield_factor <= 1))
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"kind" "location_kind" NOT NULL,
	"temp_min_c" numeric(4, 1),
	"temp_max_c" numeric(4, 1),
	"responsible_user_id" uuid,
	"count_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "locations_temp_required" CHECK (kind not in ('CHILLED', 'FROZEN') or (temp_min_c is not null and temp_max_c is not null)),
	CONSTRAINT "locations_temp_order" CHECK (temp_min_c is null or temp_max_c is null or temp_min_c <= temp_max_c),
	CONSTRAINT "locations_count_order" CHECK (count_order >= 0)
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"dimension" "dimension" NOT NULL,
	"to_base" numeric(14, 4) NOT NULL,
	"label" text NOT NULL,
	CONSTRAINT "units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership_roles" ADD CONSTRAINT "membership_roles_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_locations" ADD CONSTRAINT "item_locations_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_locations" ADD CONSTRAINT "item_locations_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_subgroups" ADD CONSTRAINT "item_subgroups_group_id_item_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."item_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_conversions_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_conversions_from_unit_id_units_id_fk" FOREIGN KEY ("from_unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_unit_conversions" ADD CONSTRAINT "item_unit_conversions_to_unit_id_units_id_fk" FOREIGN KEY ("to_unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_subgroup_id_item_subgroups_id_fk" FOREIGN KEY ("subgroup_id") REFERENCES "public"."item_subgroups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_stock_unit_id_units_id_fk" FOREIGN KEY ("stock_unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_recipe_unit_id_units_id_fk" FOREIGN KEY ("recipe_unit_id") REFERENCES "public"."units"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_pending_email" ON "invitations" USING btree ("restaurant_id","email") WHERE status = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX "membership_roles_unique" ON "membership_roles" USING btree ("membership_id","role");--> statement-breakpoint
CREATE INDEX "audit_log_entity" ON "audit_log" USING btree ("restaurant_id","entity","entity_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "item_groups_code" ON "item_groups" USING btree ("restaurant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "item_groups_active_name" ON "item_groups" USING btree ("restaurant_id",lower("name")) WHERE active;--> statement-breakpoint
CREATE UNIQUE INDEX "item_locations_unique" ON "item_locations" USING btree ("item_id","location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "item_locations_one_default" ON "item_locations" USING btree ("item_id") WHERE is_default;--> statement-breakpoint
CREATE UNIQUE INDEX "item_subgroups_code" ON "item_subgroups" USING btree ("group_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "item_subgroups_active_name" ON "item_subgroups" USING btree ("group_id",lower("name")) WHERE active;--> statement-breakpoint
CREATE UNIQUE INDEX "items_code" ON "items" USING btree ("restaurant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "items_active_description" ON "items" USING btree ("restaurant_id","subgroup_id","description_normalized") WHERE active;--> statement-breakpoint
CREATE INDEX "items_description_trgm" ON "items" USING gin ("description_normalized" gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "locations_active_name" ON "locations" USING btree ("restaurant_id",lower("name")) WHERE active;--> statement-breakpoint
CREATE UNIQUE INDEX "locations_one_system_quarantine" ON "locations" USING btree ("restaurant_id") WHERE kind = 'QUARANTINE' and is_system;