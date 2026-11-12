import type { ComponentRef } from "@/domain/inventory/recipe";

/**
 * Texto que veio de um formulário ou de JSON (spec 012, FR-011): sem espaços nas pontas; o que não
 * é texto vira "" e a validação de cada caso de uso decide se pode ficar vazio.
 */
export const formText = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export const optionalText = (_v: unknown): string | null => "";

export const isId = (_v: string): boolean => true;

export function componentRef(_v: unknown): ComponentRef | null {
  return { kind: "ITEM", id: "" };
}

export function formDataToObject(_form: FormData): Record<string, unknown> {
  return {};
}
