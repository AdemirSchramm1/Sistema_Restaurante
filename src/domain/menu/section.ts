import { normalizeDescription } from "../inventory/description";
import { err, ok, type Result } from "../shared/result";

/** Seção do cardápio (spec 013, US2). */
export const MAX_SECTION_NAME = 40;
/** Nome mostrado para os produtos sem seção (US2.4). Não pode ser nome de seção. */
export const OTHER_SECTION = "Outros";

export type ExistingSection = { id: string; name: string; normalized: string };

/**
 * Nome obrigatório, até 40 caracteres, único no restaurante sem diferenciar maiúsculas e acentos
 * (US2.1). `selfId` é a própria seção, ao renomear.
 */
export function checkSectionName(
  name: string,
  existing: readonly ExistingSection[],
  selfId?: string,
): Result<{ name: string; normalized: string }> {
  const clean = name.trim();
  if (clean === "" || [...clean].length > MAX_SECTION_NAME)
    return err("INVALID_NAME", "name", { max: MAX_SECTION_NAME });
  const normalized = normalizeDescription(clean);
  if (normalized === normalizeDescription(OTHER_SECTION))
    return err("NAME_IN_USE", "name", { section: OTHER_SECTION });
  const taken = existing.find((s) => s.normalized === normalized && s.id !== selfId);
  if (taken) return err("NAME_IN_USE", "name", { section: taken.name });
  return ok({ name: clean, normalized });
}
