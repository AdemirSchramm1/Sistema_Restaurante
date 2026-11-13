import { serverDeps } from "@/infra/server";
import { currentContext } from "@/actions/_session";
import { uploadPhotoResponse } from "@/actions/_menu-photo";

/** Envio da foto do produto (spec 013, US1). Quem pode: `menu.write`. */
export async function POST(request: Request) {
  return uploadPhotoResponse(serverDeps(), await currentContext(), request);
}
