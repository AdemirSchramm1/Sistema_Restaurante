import type { Deps } from "@/application/ports";
import type { RequestContext } from "@/application/context";
import { setProductPhoto } from "@/application/menu/photo";
import { setAppearanceImage } from "@/application/menu/appearance";
import { parseTarget } from "@/application/menu/section-input";
import { MAX_UPLOAD_BYTES } from "@/domain/menu/photo";
import type { ChosenPhotoStorage } from "@/infra/photos/from-env";

/** Rotas das fotos do cardápio (spec 013). A lógica fica aqui para ser testada sem o Next. */

const notFound = () => new Response("Foto não encontrada.", { status: 404 });

/**
 * `GET /fotos/menu/{photoId}/{largura}.webp`: só existe com a loja em pasta (desenvolvimento e
 * testes de tela). O endereço muda a cada foto nova, então o arquivo pode ficar em cache um ano.
 */
export async function photoFileResponse(
  photos: ChosenPhotoStorage,
  segments: readonly string[],
): Promise<Response> {
  const bytes = photos.read ? await photos.read(segments) : null;
  if (!bytes) return notFound();
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" },
  });
}

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

/** O formulário leva, além da foto, o id do produto e as divisas do multipart. */
const FORM_OVERHEAD_BYTES = 4096;

/**
 * `POST /api/cardapio/foto`: recebe a foto já reduzida pelo navegador (até 4 MB) e liga ao produto
 * (`recipeId`) ou vira o logo ou a capa do restaurante (`kind` = `LOGO` ou `COVER`, spec 016).
 * Rota em vez de Server Action para a tela poder mostrar o progresso do envio (research R2).
 */
export async function uploadPhotoResponse(
  deps: Deps,
  ctx: RequestContext | null,
  request: Request,
): Promise<Response> {
  if (!ctx) return json(401, { code: "UNAUTHENTICATED" });
  const declared = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (declared > MAX_UPLOAD_BYTES + FORM_OVERHEAD_BYTES) return json(413, { code: "PHOTO_TOO_BIG" });

  const form = await request.formData().catch(() => null);
  const kind = form?.get("kind");
  const target = parseTarget({ id: form?.get("recipeId") });
  const file = form?.get("photo");
  const appearance = kind === "LOGO" || kind === "COVER" ? kind : null;
  if (
    (kind !== null && kind !== undefined && !appearance) ||
    (!appearance && !target.ok) ||
    !(file instanceof Blob)
  )
    return json(400, { code: "VALIDATION" });
  if (file.size > MAX_UPLOAD_BYTES) return json(413, { code: "PHOTO_TOO_BIG" });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const saved = appearance
    ? await setAppearanceImage(deps, ctx, { kind: appearance, bytes })
    : await setProductPhoto(deps, ctx, { id: target.ok ? target.value.id : "", bytes });
  if (saved.ok) return json(200, saved.value);
  const { code, details } = saved.error;
  return json(
    code === "FORBIDDEN" ? 403 : 400,
    code === "PHOTO_TOO_SMALL" && details ? { code, details } : { code },
  );
}
