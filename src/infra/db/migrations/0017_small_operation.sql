ALTER TABLE "adjustment_requests" DROP CONSTRAINT "adjustment_requests_other_decider";--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "small_operation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "adjustment_requests" ADD COLUMN "self_decided" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "audit_log_period" ON "audit_log" USING btree ("restaurant_id","occurred_at","id");--> statement-breakpoint
CREATE INDEX "audit_log_user_period" ON "audit_log" USING btree ("restaurant_id","user_id","occurred_at","id");--> statement-breakpoint
ALTER TABLE "adjustment_requests" ADD CONSTRAINT "adjustment_requests_self_decided" CHECK (not self_decided or (decided_by = created_by and status in ('APPROVED', 'REJECTED')));--> statement-breakpoint
ALTER TABLE "adjustment_requests" ADD CONSTRAINT "adjustment_requests_other_decider" CHECK (decided_by is null or decided_by <> created_by or status = 'CANCELLED' or self_decided);