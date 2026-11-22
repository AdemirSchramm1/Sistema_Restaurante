import { revalidatePath } from "next/cache";
import { serverDeps } from "@/infra/server";
import { currentContext } from "@/actions/_session";
import { uploadPhotoResponse } from "@/actions/_menu-photo";

/** Envio da foto do produto (spec 013, US1; `menu.write`) e do logo e da capa (spec 016; `menu.appearance`). */
export async function POST(request: Request) {
  const response = await uploadPhotoResponse(serverDeps(), await currentContext(), request);
  if (response.ok) revalidatePath("/pedidos/cardapio", "layout");
  return response;
}
