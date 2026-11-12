-- Feature 012 (specs/012-nova-cara-e-desempenho/data-model.md): índices das telas mais usadas.
-- Sem eles, essas consultas liam a tabela inteira (de todos os restaurantes) e o RLS filtrava depois.
CREATE INDEX "item_subgroups_restaurant_code" ON "item_subgroups" USING btree ("restaurant_id","code");--> statement-breakpoint
CREATE INDEX "recipes_kind_name" ON "recipes" USING btree ("restaurant_id","kind","name_normalized");--> statement-breakpoint
CREATE INDEX "suppliers_restaurant_name" ON "suppliers" USING btree ("restaurant_id","name_normalized");--> statement-breakpoint
CREATE INDEX "addons_restaurant_name" ON "addons" USING btree ("restaurant_id","name_normalized");--> statement-breakpoint
CREATE INDEX "dining_tables_restaurant" ON "dining_tables" USING btree ("restaurant_id","name_normalized");--> statement-breakpoint
CREATE INDEX "order_line_removals_line" ON "order_line_removals" USING btree ("order_line_id");--> statement-breakpoint
CREATE INDEX "recipe_removables_recipe" ON "recipe_removables" USING btree ("recipe_id","position");