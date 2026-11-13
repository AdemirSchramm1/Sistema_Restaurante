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
