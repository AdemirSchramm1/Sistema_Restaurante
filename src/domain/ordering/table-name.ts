import { err, ok, type Result } from "../shared/result";
import { normalizeDescription } from "../inventory/description";

/** Nome da mesa (spec 009, FR-001). */
export const TABLE_NAME_MAX = 30;
export const TABLE_RANGE_MAX = 999;
export const TABLE_RANGE_BATCH = 200;

export function validateTableName(raw: string): Result<{ name: string; normalized: string }> {
  const name = raw.trim();
  if (name.length < 1 || name.length > TABLE_NAME_MAX) return err("INVALID_TABLE_NAME", "name");
  return ok({ name, normalized: normalizeDescription(name) });
}

/** "Criar várias mesas" de `from` a `to` (spec 009, US1-3). */
export function tableRange(from: number, to: number): Result<string[]> {
  const valid =
    Number.isInteger(from) &&
    Number.isInteger(to) &&
    from >= 1 &&
    to <= TABLE_RANGE_MAX &&
    from <= to &&
    to - from + 1 <= TABLE_RANGE_BATCH;
  if (!valid) return err("INVALID_RANGE");
  return ok(Array.from({ length: to - from + 1 }, (_, i) => String(from + i)));
}

const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

/** Ordem natural: "2" antes de "10". */
export const compareTableNames = (a: string, b: string): number => collator.compare(a, b);
