import { isDecimal } from "./decimal";

export type FieldChanges = Record<string, [unknown, unknown]>;

function normalize(v: unknown): unknown {
  if (v === undefined) return null;
  if (isDecimal(v)) return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(normalize);
  return v;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

/** Campos que mudaram entre `before` e `after`, no formato {campo: [antes, depois]}. */
export function diffFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
): FieldChanges {
  const out: FieldChanges = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after)]);
  for (const k of keys) {
    const a = before?.[k] ?? null;
    const b = after[k] ?? null;
    if (!same(a, b)) out[k] = [normalize(a), normalize(b)];
  }
  return out;
}
