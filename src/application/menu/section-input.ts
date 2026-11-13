import type { Direction } from "@/domain/menu/order";
import { err, type Result } from "@/domain/shared/result";

/** Leitores dos formulários da tela Cardápio (spec 013). Só formato. */
const todo = () => err("VALIDATION");
export const parseSectionCreate = (_raw: Record<string, unknown>): Result<{ name: string }> => todo();
export const parseSectionRename = (
  _raw: Record<string, unknown>,
): Result<{ id: string; version: number; name: string }> => todo();
export const parseMove = (_raw: Record<string, unknown>): Result<{ id: string; direction: Direction }> =>
  todo();
export const parseTarget = (_raw: Record<string, unknown>): Result<{ id: string }> => todo();
