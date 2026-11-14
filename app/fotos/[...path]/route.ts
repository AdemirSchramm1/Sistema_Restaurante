import { serverPhotos } from "@/infra/server";
import { photoFileResponse } from "@/actions/_menu-photo";

/** Fotos do cardápio guardadas em pasta (`MENU_PHOTOS=file`). Em produção as fotos vêm do Blob. */
export async function GET(_request: Request, { params }: RouteContext<"/fotos/[...path]">) {
  return photoFileResponse(serverPhotos(), (await params).path);
}
