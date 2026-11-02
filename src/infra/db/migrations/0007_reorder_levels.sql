-- Feature 006: aviso de reposição no item (specs/006-alerta-reposicao/plan.md).
ALTER TABLE "items" ADD COLUMN "reorder_point" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "par_level" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_reorder_point" CHECK (reorder_point >= 0);--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_par_level" CHECK (par_level is null or (reorder_point is not null and par_level > reorder_point));