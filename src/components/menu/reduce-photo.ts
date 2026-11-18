import {
  checkPhotoFile,
  MAX_PHOTO_BYTES,
  MAX_UPLOAD_BYTES,
  MIN_COVER_WIDTH,
  type PhotoShape,
} from "@/domain/menu/photo";
import { err, ok, type Result } from "@/domain/shared/result";

/** O navegador reduz a foto antes de enviar (spec 013, research R2). */

export type Bitmap = { width: number; height: number; close(): void };
export type PhotoCanvas = {
  width: number;
  height: number;
  getContext(
    kind: "2d",
  ): { drawImage(image: never, x: number, y: number, w: number, h: number): void } | null;
  toBlob(done: (blob: Blob | null) => void, type: string, quality: number): void;
};
export type PhotoTools = {
  decode(file: Blob, options: { imageOrientation: "from-image" }): Promise<Bitmap>;
  canvas(): PhotoCanvas;
};

export const browserPhotoTools: PhotoTools = {
  decode: (file, options) => createImageBitmap(file, options),
  canvas: () => document.createElement("canvas") as unknown as PhotoCanvas,
};

/**
 * Lado maior da foto que vai para o servidor: sobra para a maior variante do formato (1200 px do
 * prato, 384 do logo e 1920 de largura da capa; spec 016).
 */
const MAX_SIDE: Record<PhotoShape, number> = { PRODUCT: 1600, LOGO: 800, COVER: 1920 };
const JPEG_QUALITY = 0.85;

/** Desenha a foto no tamanho de envio. Devolve null se o aparelho não conseguir. */
async function draw(bitmap: Bitmap, tools: PhotoTools, maxSide: number): Promise<Blob | null> {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = tools.canvas();
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap as never, 0, 0, width, height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
}

/**
 * Confere o arquivo que a pessoa escolheu (tipo, 10 MB, lado menor de 600 px) e devolve a foto
 * reduzida para o envio. Se o aparelho não conseguir reduzir, vai o original, desde que caiba no
 * limite do servidor (4 MB); o servidor confere tudo de novo.
 */
export async function reducePhoto(
  file: File,
  tools: PhotoTools = browserPhotoTools,
  shape: PhotoShape = "PRODUCT",
): Promise<Result<Blob>> {
  const bitmap = await tools.decode(file, { imageOrientation: "from-image" }).catch(() => null);
  // Sem conseguir ler a foto, o tamanho em pixels fica para o servidor conferir.
  // O maior mínimo dos formatos (a largura da capa) passa em todos.
  const { width, height } = bitmap ?? { width: MIN_COVER_WIDTH, height: MIN_COVER_WIDTH };
  const checked = checkPhotoFile(
    { type: file.type, bytes: file.size, width, height },
    MAX_PHOTO_BYTES,
    shape,
  );
  const reduced = bitmap && checked.ok ? await draw(bitmap, tools, MAX_SIDE[shape]) : null;
  bitmap?.close();
  if (!checked.ok) return checked;
  const best = reduced ?? file;
  return best.size <= MAX_UPLOAD_BYTES ? ok(best) : err("PHOTO_PREPARE_FAILED");
}
