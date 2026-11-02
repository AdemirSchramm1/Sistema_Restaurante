-- Feature 004: livro de movimentações, saldo e pedidos de acerto (specs/004-entradas-perdas-saldo/plan.md).
CREATE TYPE "public"."adjustment_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."movement_type" AS ENUM('PURCHASE', 'LOSS', 'ADJUSTMENT', 'REVERSAL');--> statement-breakpoint
CREATE TABLE "adjustment_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"item_id" uuid NOT NULL,
	"counted_quantity" numeric(14, 4) NOT NULL,
	"system_quantity" numeric(14, 4) NOT NULL,
	"difference" numeric(14, 4) NOT NULL,
	"reason_id" uuid NOT NULL,
	"notes" text,
	"status" "adjustment_status" DEFAULT 'PENDING' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_notes" text,
	"movement_id" uuid,
	CONSTRAINT "adjustment_requests_other_decider" CHECK (decided_by is null or decided_by <> created_by or status = 'CANCELLED'),
	CONSTRAINT "adjustment_requests_difference" CHECK (difference <> 0)
);
--> statement-breakpoint
CREATE TABLE "movement_reasons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"movement_type" "movement_type" NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"family" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_balances" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"type" "movement_type" NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(14, 4) NOT NULL,
	"entered_quantity" numeric(14, 4) NOT NULL,
	"entered_unit" text NOT NULL,
	"unit_cost" numeric(14, 4) NOT NULL,
	"total_cost" numeric(14, 2) NOT NULL,
	"reason_id" uuid,
	"notes" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"reverses_id" uuid,
	"approved_by" uuid,
	"idempotency_key" text,
	CONSTRAINT "stock_movements_reason" CHECK ((type = 'PURCHASE') = (reason_id is null)),
	CONSTRAINT "stock_movements_reversal" CHECK ((type = 'REVERSAL') = (reverses_id is not null)),
	CONSTRAINT "stock_movements_purchase_in" CHECK (type <> 'PURCHASE' or quantity > 0),
	CONSTRAINT "stock_movements_loss_out" CHECK (type <> 'LOSS' or quantity < 0),
	CONSTRAINT "stock_movements_not_zero" CHECK (quantity <> 0)
);
--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "average_cost" SET DATA TYPE numeric(18, 8);--> statement-breakpoint
ALTER TABLE "adjustment_requests" ADD CONSTRAINT "adjustment_requests_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustment_requests" ADD CONSTRAINT "adjustment_requests_reason_id_movement_reasons_id_fk" FOREIGN KEY ("reason_id") REFERENCES "public"."movement_reasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustment_requests" ADD CONSTRAINT "adjustment_requests_movement_id_stock_movements_id_fk" FOREIGN KEY ("movement_id") REFERENCES "public"."stock_movements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reason_id_movement_reasons_id_fk" FOREIGN KEY ("reason_id") REFERENCES "public"."movement_reasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adjustment_requests_status" ON "adjustment_requests" USING btree ("restaurant_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_reverses" ON "stock_movements" USING btree ("reverses_id") WHERE reverses_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_movements_idempotency" ON "stock_movements" USING btree ("restaurant_id","idempotency_key") WHERE idempotency_key is not null;--> statement-breakpoint
CREATE INDEX "stock_movements_item" ON "stock_movements" USING btree ("restaurant_id","item_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_recorded" ON "stock_movements" USING btree ("restaurant_id","created_at");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_reverses_id_fk" FOREIGN KEY ("reverses_id") REFERENCES "public"."stock_movements"("id");--> statement-breakpoint
-- Livro só de inserção: a aplicação não tem UPDATE/DELETE e o gatilho barra até o dono.
GRANT SELECT ON movement_reasons TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT ON stock_movements TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON stock_balances, adjustment_requests TO app_user;--> statement-breakpoint
CREATE TRIGGER stock_movements_append_only BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION app_reject_change();--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['stock_movements', 'stock_balances', 'adjustment_requests'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (restaurant_id = app_current_restaurant()) WITH CHECK (restaurant_id = app_current_restaurant())',
      t
    );
  END LOOP;
END $$;--> statement-breakpoint
-- Motivos em lista fechada (igual a src/domain/inventory/movement-reasons.ts).
INSERT INTO movement_reasons (id, movement_type, code, label, family, position) VALUES
  ('0193a100-0000-7000-8000-000000000001', 'LOSS', 'PREP_TRIM', 'Limpeza ou apara acima do normal', 'PREP', 1),
  ('0193a100-0000-7000-8000-000000000002', 'LOSS', 'PREP_ERROR', 'Erro no preparo', 'PREP', 2),
  ('0193a100-0000-7000-8000-000000000003', 'LOSS', 'BURNT', 'Queimou', 'PREP', 3),
  ('0193a100-0000-7000-8000-000000000004', 'LOSS', 'RETURNED', 'Cliente devolveu', 'PREP', 4),
  ('0193a100-0000-7000-8000-000000000005', 'LOSS', 'EXPIRED', 'Venceu', 'SPOILAGE', 5),
  ('0193a100-0000-7000-8000-000000000006', 'LOSS', 'SPOILED', 'Estragou', 'SPOILAGE', 6),
  ('0193a100-0000-7000-8000-000000000007', 'LOSS', 'PEST', 'Praga', 'SPOILAGE', 7),
  ('0193a100-0000-7000-8000-000000000008', 'LOSS', 'DROPPED', 'Caiu ou quebrou', 'OPERATIONAL', 8),
  ('0193a100-0000-7000-8000-000000000009', 'LOSS', 'WRONG_ORDER', 'Pedido feito errado', 'OPERATIONAL', 9),
  ('0193a100-0000-7000-8000-000000000010', 'LOSS', 'OVER_PORTION', 'Porção maior que a do produto', 'OPERATIONAL', 10),
  ('0193a100-0000-7000-8000-000000000011', 'LOSS', 'OTHER', 'Outro', 'OPERATIONAL', 11),
  ('0193a100-0000-7000-8000-000000000021', 'ADJUSTMENT', 'SHELF_CHECK', 'Conferi na prateleira', 'ADJUSTMENT', 12),
  ('0193a100-0000-7000-8000-000000000022', 'ADJUSTMENT', 'MISSED_ENTRY', 'Lançamento esquecido', 'ADJUSTMENT', 13),
  ('0193a100-0000-7000-8000-000000000023', 'ADJUSTMENT', 'MISSING', 'Sumiu (possível furto)', 'ADJUSTMENT', 14),
  ('0193a100-0000-7000-8000-000000000024', 'ADJUSTMENT', 'OTHER', 'Outro', 'ADJUSTMENT', 15),
  ('0193a100-0000-7000-8000-000000000031', 'REVERSAL', 'WRONG_ENTRY', 'Lançado errado', 'REVERSAL', 16),
  ('0193a100-0000-7000-8000-000000000032', 'REVERSAL', 'DUPLICATE', 'Lançado em dobro', 'REVERSAL', 17),
  ('0193a100-0000-7000-8000-000000000033', 'REVERSAL', 'OTHER', 'Outro', 'REVERSAL', 18);
