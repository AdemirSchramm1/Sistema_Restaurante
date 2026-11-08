-- Feature 008: preço de venda do produto (specs/008-painel-custo-produtos/plan.md).
ALTER TABLE "recipes" ADD COLUMN "sale_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_sale_price_positive" CHECK (sale_price > 0);--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_sale_price_dish" CHECK (sale_price is null or kind = 'DISH');