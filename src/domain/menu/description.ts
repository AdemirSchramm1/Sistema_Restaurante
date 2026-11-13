import { ok, type Result } from "../shared/result";

/** Descrição do produto no cardápio (spec 013, US1.6 e US1.7). Esqueleto. */
export const MAX_DESCRIPTION = 300;
export function descriptionLength(_text: string): number {
  return -1;
}
export function cleanDescription(_text: string | null | undefined): Result<string | null> {
  return ok("");
}
