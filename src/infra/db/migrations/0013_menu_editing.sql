-- Feature 013: gerente e chef editam o cardápio (specs/013-editar-cardapio/data-model.md).
CREATE TABLE "menu_sections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"name_normalized" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "menu_sections_name_length" CHECK (char_length(name) between 1 and 40),
	CONSTRAINT "menu_sections_position_positive" CHECK (position > 0)
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "menu_section_id" uuid;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "menu_position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "photo_base" text;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "photo_widths" smallint[];--> statement-breakpoint
CREATE UNIQUE INDEX "menu_sections_name" ON "menu_sections" USING btree ("restaurant_id","name_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_sections_id_restaurant" ON "menu_sections" USING btree ("id","restaurant_id");--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_menu_section_fk" FOREIGN KEY ("menu_section_id","restaurant_id") REFERENCES "public"."menu_sections"("id","restaurant_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_description_length" CHECK (char_length(description) between 1 and 300);--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_photo_pair" CHECK ((photo_base is null) = (photo_widths is null) and (photo_widths is null or cardinality(photo_widths) >= 1));--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_menu_only_dish" CHECK (kind = 'DISH' or (description is null and menu_section_id is null and menu_position = 0 and photo_base is null and photo_widths is null));--> statement-breakpoint
-- Duas seções não ficam na mesma posição, mas a troca de vizinhas acontece dentro de uma transação:
-- por isso a unicidade só é conferida no commit.
ALTER TABLE "menu_sections" ADD CONSTRAINT "menu_sections_position" UNIQUE ("restaurant_id","position") DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
-- Permissões da aplicação e isolamento por restaurante. A seção é apagada de verdade (o que foi
-- apagado fica na trilha de auditoria).
GRANT SELECT, INSERT, UPDATE, DELETE ON menu_sections TO app_user;--> statement-breakpoint
ALTER TABLE menu_sections ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON menu_sections USING (restaurant_id = app_current_restaurant()) WITH CHECK (restaurant_id = app_current_restaurant());--> statement-breakpoint
-- Os produtos vendidos de hoje ficam em "Outros", na ordem alfabética que o cliente já vê.
update recipes r set menu_position = o.pos
  from (select id, row_number() over (partition by restaurant_id order by name_normalized) as pos
          from recipes where kind = 'DISH') o
 where o.id = r.id;
