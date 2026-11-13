import { ok, type Result } from "../shared/result";

/** Seção do cardápio (spec 013, US2.1). Esqueleto. */
export const MAX_SECTION_NAME = 40;
export const OTHER_SECTION = "";
export type ExistingSection = { id: string; name: string; normalized: string };
export function checkSectionName(
  _name: string,
  _existing: readonly ExistingSection[],
  _selfId?: string,
): Result<{ name: string; normalized: string }> {
  return ok({ name: "", normalized: "" });
}
