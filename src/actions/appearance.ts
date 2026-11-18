"use server";

import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import { removeAppearanceImage } from "@/application/menu/appearance";
import { err } from "@/domain/shared/result";
import { withContext, type ActionState } from "./_session";

/**
 * Quadro Aparência da tela Cardápio (spec 016, US1). Pôr ou trocar vai pela rota de envio com
 * progresso (`/api/cardapio/foto` com `kind`); tirar é esta ação.
 */
export async function removeAppearanceImageAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const kind = form.get("kind");
  const state = await withContext((ctx) =>
    kind === "LOGO" || kind === "COVER"
      ? removeAppearanceImage(serverDeps(), ctx, { kind })
      : Promise.resolve(err("VALIDATION", "kind")),
  );
  if (state?.ok) revalidatePath("/pedidos/cardapio", "layout");
  return state;
}
