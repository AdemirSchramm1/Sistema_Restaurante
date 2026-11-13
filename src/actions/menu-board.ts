"use server";

import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import { createSection, deleteSection, moveSection, renameSection } from "@/application/menu/sections";
import {
  parseMove,
  parseSectionCreate,
  parseSectionRename,
  parseTarget,
} from "@/application/menu/section-input";
import { formDataToObject } from "@/application/form-input";
import type { Deps } from "@/application/ports";
import type { RequestContext } from "@/application/context";
import type { Result } from "@/domain/shared/result";
import { withContext, type ActionState } from "./_session";

/** Tela Cardápio da equipe (spec 013): uma Server Action por caso de uso. */

const BOARD = "/pedidos/cardapio";

/** Lê o formulário, chama o caso de uso e, se deu certo, atualiza a tela Cardápio. */
async function run<I, O>(
  form: FormData,
  parse: (raw: Record<string, unknown>) => Result<I>,
  useCase: (deps: Deps, ctx: RequestContext, input: I) => Promise<Result<O>>,
): Promise<ActionState> {
  const state = await withContext(async (ctx) => {
    const parsed = parse(formDataToObject(form));
    return parsed.ok ? useCase(serverDeps(), ctx, parsed.value) : parsed;
  });
  if (state?.ok) revalidatePath(BOARD, "layout");
  return state;
}

export async function createSectionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(form, parseSectionCreate, createSection);
}

export async function renameSectionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(form, parseSectionRename, renameSection);
}

export async function moveSectionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(form, parseMove, moveSection);
}

export async function deleteSectionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(form, parseTarget, deleteSection);
}
