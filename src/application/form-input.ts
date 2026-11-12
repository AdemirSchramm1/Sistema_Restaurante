import type { ComponentRef } from "@/domain/inventory/recipe";
import { parseBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { err, ok, type ErrorCode, type Result } from "@/domain/shared/result";

/**
 * Leitura do que vem de formulários e de JSON (spec 012, FR-011). Só formato: a regra de negócio
 * fica no domínio e cada caso de uso decide o que pode ficar vazio.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Texto sem espaços nas pontas; o que não é texto vira "". */
export const formText = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Campo opcional: em branco vira null. */
export const optionalText = (v: unknown): string | null => formText(v) || null;

/** Número opcional com vírgula decimal: em branco vira null; inválido aponta o campo. */
export function optionalDecimal(
  v: unknown,
  field: string,
  code: ErrorCode = "INVALID_NUMBER",
): Result<Decimal | null> {
  const t = formText(v);
  if (!t) return ok(null);
  const r = parseBrDecimal(t);
  return r.ok ? r : err(code, field);
}

/** Id no formato do banco. Malformado é recusado antes de chegar ao banco. */
export const isId = (v: string): boolean => UUID.test(v);

/** "ITEM:<id>" ou "RECIPE:<id>" dos selects de componente; outro formato dá null. */
export function componentRef(v: unknown): ComponentRef | null {
  const [kind, id, ...rest] = formText(v).split(":");
  if ((kind !== "ITEM" && kind !== "RECIPE") || !id || rest.length || !isId(id)) return null;
  return { kind, id };
}

/** FormData → objeto, ignorando os campos internos do Next e arquivos. Campo repetido fica com o último. */
export function formDataToObject(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (k.startsWith("$ACTION") || typeof v !== "string") continue;
    out[k] = v;
  }
  return out;
}
