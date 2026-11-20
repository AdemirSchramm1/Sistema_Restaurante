CREATE TYPE "public"."cash_entry_kind" AS ENUM('WITHDRAWAL', 'SUPPLY');--> statement-breakpoint
CREATE TYPE "public"."cash_session_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."cash_withdrawal_reason" AS ENUM('SAFE', 'SUPPLIER_PAYMENT', 'DAILY_EXPENSE', 'OTHER');--> statement-breakpoint
CREATE TABLE "cash_counts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"cash_session_id" uuid NOT NULL,
	"counted" numeric(12, 2) NOT NULL,
	"denominations" jsonb,
	"session_version" integer NOT NULL,
	CONSTRAINT "cash_counts_counted" CHECK (counted >= 0),
	CONSTRAINT "cash_counts_by" CHECK (created_by is not null)
);
--> statement-breakpoint
CREATE TABLE "cash_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"cash_session_id" uuid NOT NULL,
	"kind" "cash_entry_kind" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" "cash_withdrawal_reason",
	"note" text,
	"client_request_id" uuid NOT NULL,
	CONSTRAINT "cash_entries_amount" CHECK (amount > 0),
	CONSTRAINT "cash_entries_by" CHECK (created_by is not null),
	CONSTRAINT "cash_entries_reason" CHECK ((kind = 'WITHDRAWAL') = (reason is not null)),
	CONSTRAINT "cash_entries_note_length" CHECK (char_length(note) between 1 and 140),
	CONSTRAINT "cash_entries_note" CHECK (reason is distinct from 'OTHER' or note is not null)
);
--> statement-breakpoint
CREATE TABLE "cash_entry_removals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"entry_id" uuid NOT NULL,
	CONSTRAINT "cash_entry_removals_by" CHECK (created_by is not null)
);
--> statement-breakpoint
CREATE TABLE "cash_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone NOT NULL,
	"updated_by" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "cash_session_status" DEFAULT 'OPEN' NOT NULL,
	"business_day" date NOT NULL,
	"opened_at" timestamp with time zone NOT NULL,
	"opened_by" uuid NOT NULL,
	"opening_float" numeric(12, 2) NOT NULL,
	"previous_kept" numeric(12, 2),
	"opening_note" text,
	"client_request_id" uuid NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	"expected" numeric(12, 2),
	"counted" numeric(12, 2),
	"difference" numeric(12, 2),
	"kept" numeric(12, 2),
	"service_charge" numeric(12, 2),
	"closing_count_id" uuid,
	"close_note" text,
	CONSTRAINT "cash_sessions_opening_float" CHECK (opening_float >= 0),
	CONSTRAINT "cash_sessions_opening_note_length" CHECK (char_length(opening_note) between 1 and 140),
	CONSTRAINT "cash_sessions_opening_note" CHECK (previous_kept is null or previous_kept = opening_float or opening_note is not null),
	CONSTRAINT "cash_sessions_closed" CHECK (num_nonnulls(closed_at, closed_by, expected, counted, difference, kept, service_charge, closing_count_id) = case when status = 'CLOSED' then 8 else 0 end),
	CONSTRAINT "cash_sessions_difference" CHECK (difference = counted - expected),
	CONSTRAINT "cash_sessions_counted" CHECK (counted >= 0),
	CONSTRAINT "cash_sessions_kept" CHECK (kept between 0 and counted),
	CONSTRAINT "cash_sessions_close_note_length" CHECK (char_length(close_note) between 1 and 140),
	CONSTRAINT "cash_sessions_close_note" CHECK (case when status = 'OPEN' then close_note is null else difference = 0 or close_note is not null end)
);
--> statement-breakpoint
ALTER TABLE "tab_payment_removals" ADD COLUMN "cash_session_id" uuid;--> statement-breakpoint
ALTER TABLE "tab_payments" ADD COLUMN "cash_session_id" uuid;--> statement-breakpoint
ALTER TABLE "table_tabs" ADD COLUMN "cash_session_id" uuid;--> statement-breakpoint
ALTER TABLE "cash_counts" ADD CONSTRAINT "cash_counts_cash_session_id_cash_sessions_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_entries" ADD CONSTRAINT "cash_entries_cash_session_id_cash_sessions_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_entry_removals" ADD CONSTRAINT "cash_entry_removals_entry_id_cash_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."cash_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_sessions" ADD CONSTRAINT "cash_sessions_closing_count_id_cash_counts_id_fk" FOREIGN KEY ("closing_count_id") REFERENCES "public"."cash_counts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_counts_session" ON "cash_counts" USING btree ("cash_session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_entries_client_request" ON "cash_entries" USING btree ("cash_session_id","client_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_entry_removals_entry" ON "cash_entry_removals" USING btree ("entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_sessions_one_open" ON "cash_sessions" USING btree ("restaurant_id") WHERE status = 'OPEN';--> statement-breakpoint
CREATE INDEX "cash_sessions_day" ON "cash_sessions" USING btree ("restaurant_id","business_day");--> statement-breakpoint
ALTER TABLE "tab_payment_removals" ADD CONSTRAINT "tab_payment_removals_cash_session_id_cash_sessions_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tab_payments" ADD CONSTRAINT "tab_payments_cash_session_id_cash_sessions_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_tabs" ADD CONSTRAINT "table_tabs_cash_session_id_cash_sessions_id_fk" FOREIGN KEY ("cash_session_id") REFERENCES "public"."cash_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tab_payment_removals_cash_session" ON "tab_payment_removals" USING btree ("cash_session_id");--> statement-breakpoint
CREATE INDEX "tab_payments_cash_session" ON "tab_payments" USING btree ("cash_session_id","method");--> statement-breakpoint
CREATE INDEX "table_tabs_cash_session" ON "table_tabs" USING btree ("cash_session_id");--> statement-breakpoint
ALTER TABLE "tab_payment_removals" ADD CONSTRAINT "tab_payment_removals_cash_session" CHECK (cash_session_id is not null) NOT VALID;--> statement-breakpoint
ALTER TABLE "tab_payments" ADD CONSTRAINT "tab_payments_cash_session" CHECK (cash_session_id is not null) NOT VALID;--> statement-breakpoint
-- As duas checagens acima são NOT VALID: valem para toda linha nova e deixam os pagamentos de antes
-- da 014 (sem turno) como estão.
-- Turno: a aplicação abre, soma a versão e fecha. Lançamentos, remoções e contagens são só inserção.
GRANT SELECT, INSERT, UPDATE ON cash_sessions TO app_user;--> statement-breakpoint
GRANT SELECT, INSERT ON cash_entries, cash_entry_removals, cash_counts TO app_user;--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cash_sessions', 'cash_entries', 'cash_entry_removals', 'cash_counts'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (restaurant_id = app_current_restaurant()) WITH CHECK (restaurant_id = app_current_restaurant())',
      t
    );
  END LOOP;
END $$;--> statement-breakpoint
CREATE TRIGGER cash_entries_append_only BEFORE UPDATE OR DELETE ON cash_entries
  FOR EACH ROW EXECUTE FUNCTION app_reject_change();--> statement-breakpoint
CREATE TRIGGER cash_entry_removals_append_only BEFORE UPDATE OR DELETE ON cash_entry_removals
  FOR EACH ROW EXECUTE FUNCTION app_reject_change();--> statement-breakpoint
CREATE TRIGGER cash_counts_append_only BEFORE UPDATE OR DELETE ON cash_counts
  FOR EACH ROW EXECUTE FUNCTION app_reject_change();--> statement-breakpoint
-- Turno fechado não muda (SC-004). Turno aberto não some e só muda a versão e o fechamento.
CREATE FUNCTION app_cash_session_closed_is_final() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'APPEND_ONLY: % não aceita %', TG_TABLE_NAME, TG_OP USING ERRCODE = 'P0001';
  END IF;
  IF OLD.status = 'CLOSED' THEN
    RAISE EXCEPTION 'APPEND_ONLY: turno do caixa fechado não muda' USING ERRCODE = 'P0001';
  END IF;
  IF (NEW.id, NEW.restaurant_id, NEW.created_at, NEW.created_by, NEW.business_day, NEW.opened_at, NEW.opened_by,
      NEW.opening_float, NEW.previous_kept, NEW.opening_note, NEW.client_request_id)
     IS DISTINCT FROM
     (OLD.id, OLD.restaurant_id, OLD.created_at, OLD.created_by, OLD.business_day, OLD.opened_at, OLD.opened_by,
      OLD.opening_float, OLD.previous_kept, OLD.opening_note, OLD.client_request_id) THEN
    RAISE EXCEPTION 'APPEND_ONLY: a abertura do turno do caixa não muda' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER cash_session_closed_is_final BEFORE UPDATE OR DELETE ON cash_sessions
  FOR EACH ROW EXECUTE FUNCTION app_cash_session_closed_is_final();--> statement-breakpoint
-- Nada entra em turno fechado (SC-003): pagamento, remoção de pagamento, sangria, reforço e contagem
-- só são aceitos com o turno aberto. A aplicação já trava o turno antes; aqui é a segunda barreira.
CREATE FUNCTION app_cash_session_must_be_open() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.cash_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM cash_sessions s WHERE s.id = NEW.cash_session_id AND s.status = 'OPEN'
  ) THEN
    RAISE EXCEPTION 'CASH_SESSION_CLOSED: % não entra em turno do caixa fechado', TG_TABLE_NAME USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER tab_payments_open_cash_session BEFORE INSERT ON tab_payments
  FOR EACH ROW EXECUTE FUNCTION app_cash_session_must_be_open();--> statement-breakpoint
CREATE TRIGGER tab_payment_removals_open_cash_session BEFORE INSERT ON tab_payment_removals
  FOR EACH ROW EXECUTE FUNCTION app_cash_session_must_be_open();--> statement-breakpoint
CREATE TRIGGER cash_entries_open_cash_session BEFORE INSERT ON cash_entries
  FOR EACH ROW EXECUTE FUNCTION app_cash_session_must_be_open();--> statement-breakpoint
CREATE TRIGGER cash_counts_open_cash_session BEFORE INSERT ON cash_counts
  FOR EACH ROW EXECUTE FUNCTION app_cash_session_must_be_open();
