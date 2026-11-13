import { err, ok, type Result } from "@/domain/shared/result";
import { formText, isId } from "../form-input";
import { parseVersioned } from "./section-input";

export type MenuDetailsInput = { id: string; version: number; description: string; sectionId: string | null };

/** Descrição como veio (a regra é do domínio) e seção: em branco é "Outros". */
export function parseMenuDetails(raw: Record<string, unknown>): Result<MenuDetailsInput> {
  const versioned = parseVersioned(raw);
  if (!versioned.ok) return versioned;
  const sectionId = formText(raw.sectionId);
  if (sectionId && !isId(sectionId)) return err("VALIDATION", "sectionId");
  return ok({
    ...versioned.value,
    description: typeof raw.description === "string" ? raw.description : "",
    sectionId: sectionId || null,
  });
}
