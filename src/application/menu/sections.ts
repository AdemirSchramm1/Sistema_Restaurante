import type { Deps } from "../ports";
import type { RequestContext } from "../context";
import type { Direction } from "@/domain/menu/order";
import { err, type Result } from "@/domain/shared/result";

/** Seções do cardápio (spec 013, US2). */
type Use<I, O> = (deps: Deps, ctx: RequestContext, input: I) => Promise<Result<O>>;
export const createSection: Use<{ name: string }, { id: string }> = async () => err("VALIDATION");
export const renameSection: Use<{ id: string; version: number; name: string }, void> = async () =>
  err("VALIDATION");
export const moveSection: Use<{ id: string; direction: Direction }, void> = async () => err("VALIDATION");
export const deleteSection: Use<{ id: string }, { movedProducts: number }> = async () => err("VALIDATION");
