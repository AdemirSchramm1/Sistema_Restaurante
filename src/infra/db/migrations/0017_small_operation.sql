CREATE TABLE "exception_reviews" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"week_start" date NOT NULL,
	"note" text,
	CONSTRAINT "exception_reviews_monday" CHECK (extract(isodow from week_start) = 1),
	CONSTRAINT "exception_reviews_by" CHECK (created_by is not null),
	CONSTRAINT "exception_reviews_note" CHECK (note is null or char_length(note) between 1 and 140)
);
--> statement-breakpoint
ALTER TABLE "adjustment_requests" DROP CONSTRAINT "adjustment_requests_other_decider";--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "small_operation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "adjustment_requests" ADD COLUMN "self_decided" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "exception_reviews_week" ON "exception_reviews" USING btree ("restaurant_id","week_start");--> statement-breakpoint
CREATE INDEX "audit_log_period" ON "audit_log" USING btree ("restaurant_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "audit_log_user_period" ON "audit_log" USING btree ("restaurant_id","user_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "adjustment_requests_exceptions" ON "adjustment_requests" USING btree ("restaurant_id","decided_at") WHERE self_decided and status = 'APPROVED';--> statement-breakpoint
ALTER TABLE "adjustment_requests" ADD CONSTRAINT "adjustment_requests_self_decided" CHECK (not self_decided or (decided_by = created_by and status in ('APPROVED', 'REJECTED')));--> statement-breakpoint
ALTER TABLE "adjustment_requests" ADD CONSTRAINT "adjustment_requests_other_decider" CHECK (decided_by is null or decided_by <> created_by or status = 'CANCELLED' or self_decided);--> statement-breakpoint
-- Revisão da semana (spec 019, R8): a aplicação só lê e insere; uma por semana; nada muda depois.
GRANT SELECT, INSERT ON exception_reviews TO app_user;--> statement-breakpoint
ALTER TABLE exception_reviews ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenant_isolation ON exception_reviews
  USING (restaurant_id = app_current_restaurant())
  WITH CHECK (restaurant_id = app_current_restaurant());--> statement-breakpoint
CREATE TRIGGER exception_reviews_append_only BEFORE UPDATE OR DELETE ON exception_reviews
  FOR EACH ROW EXECUTE FUNCTION app_reject_change();
