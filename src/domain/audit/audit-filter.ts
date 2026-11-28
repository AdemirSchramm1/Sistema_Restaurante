import { err, ok, type Result } from "../shared/result";
import { OPERATION_TYPES, type OperationType } from "./operation-types";

/** Filtro do relatório de auditoria (spec 019, US1-2 a US1-4), lido do endereço da página. */
export type AuditFilter = {
  /** Dias locais "AAAA-MM-DD", do início ao fim, até 31 dias. */
  from: string;
  to: string;
  userId: string | null;
  type: OperationType | null;
  deniedOnly: boolean;
  page: number;
};

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_MAX_DAYS = 31;

type Query = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "2026-02-30" não é dia: a data tem de voltar igual depois de lida. Dia inválido é NaN. */
const dayMs = (v: string) => {
  const ms = Date.parse(`${v}T00:00:00Z`);
  if (Number.isNaN(ms)) return NaN;
  return new Date(ms).toISOString().slice(0, 10) === v ? ms : NaN;
};

export function readAuditFilter(q: Query, today: string): Result<AuditFilter> {
  const from = first(q.de) ?? first(q.ate) ?? today;
  const to = first(q.ate) ?? from;
  const span = (dayMs(to) - dayMs(from)) / 86_400_000;
  // NaN (dia inválido) também cai aqui.
  if (!(span >= 0 && span < AUDIT_MAX_DAYS)) return err("INVALID_PERIOD", "de");
  const user = first(q.pessoa);
  const type = first(q.tipo);
  const page = Number(first(q.pagina));
  return ok({
    from,
    to,
    userId: user && UUID.test(user) ? user : null,
    type: OPERATION_TYPES.find((t) => t === type) ?? null,
    deniedOnly: first(q.negadas) === "1",
    page: Number.isInteger(page) && page > 0 ? page : 1,
  });
}
