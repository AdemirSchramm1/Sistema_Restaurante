import { isDirection, type Direction } from "@/domain/menu/order";
import { err, ok, type Result } from "@/domain/shared/result";
import { formText, isId } from "../form-input";

/** Leitores dos formulários da tela Cardápio (spec 013). Só formato: a regra é do domínio. */
type Raw = Record<string, unknown>;

const rawText = (v: unknown): string => (typeof v === "string" ? v : "");

export function parseTarget(raw: Raw): Result<{ id: string }> {
  const id = formText(raw.id);
  return isId(id) ? ok({ id }) : err("VALIDATION", "id");
}

/** Id e `version` (inteiro a partir de 1) da trava otimista. */
export function parseVersioned(raw: Raw): Result<{ id: string; version: number }> {
  const target = parseTarget(raw);
  if (!target.ok) return target;
  const text = formText(raw.version);
  const version = /^[1-9]\d*$/.test(text) ? Number.parseInt(text, 10) : null;
  return version ? ok({ id: target.value.id, version }) : err("VALIDATION", "version");
}

export const parseSectionCreate = (raw: Raw): Result<{ name: string }> => ok({ name: rawText(raw.name) });

export function parseSectionRename(raw: Raw): Result<{ id: string; version: number; name: string }> {
  const versioned = parseVersioned(raw);
  return versioned.ok ? ok({ ...versioned.value, name: rawText(raw.name) }) : versioned;
}

export function parseMove(raw: Raw): Result<{ id: string; direction: Direction }> {
  const target = parseTarget(raw);
  if (!target.ok) return target;
  const direction = formText(raw.direction);
  return isDirection(direction) ? ok({ id: target.value.id, direction }) : err("VALIDATION", "direction");
}
