import { err, ok, type Result } from "../shared/result";

/**
 * Foto do produto no cardápio (spec 013, US1 e FR-003). Tamanhos em pixels e bytes são inteiros;
 * nada aqui é dinheiro nem quantidade de estoque.
 */

/** Como o banco guarda a foto: a base do endereço e as larguras gravadas. */
export type Photo = { base: string; widths: number[] };
export type PhotoFile = { type: string; bytes: number; width: number; height: number };

const PHOTO_TYPES: readonly string[] = ["image/jpeg", "image/png", "image/webp"];
/** Limite do arquivo que a pessoa escolhe no aparelho. */
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
/** Limite do que chega ao servidor, depois de o navegador reduzir a foto (research R2). */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MIN_PHOTO_SIDE = 600;
export const PHOTO_WIDTHS = [300, 600, 900, 1200] as const;

/**
 * Formatos (spec 016, R8): a foto do prato (013), o logo e a capa do restaurante. Recorte no centro
 * na proporção dada e as larguras gravadas.
 */
export type PhotoShape = "PRODUCT" | "LOGO" | "COVER";
export const PHOTO_SHAPES: Record<PhotoShape, { ratio: [number, number]; widths: readonly number[] }> = {
  PRODUCT: { ratio: [4, 3], widths: PHOTO_WIDTHS },
  LOGO: { ratio: [1, 1], widths: [96, 192, 384] },
  COVER: { ratio: [3, 1], widths: [600, 1200, 1920] },
};
/** Logo: 200 px no lado menor. Capa: 1200 px de largura. */
export const MIN_LOGO_SIDE = 200;
export const MIN_COVER_WIDTH = 1200;

const bigEnough = (f: PhotoFile, shape: PhotoShape) =>
  shape === "LOGO"
    ? Math.min(f.width, f.height) >= MIN_LOGO_SIDE
    : shape === "COVER"
      ? f.width >= MIN_COVER_WIDTH
      : Math.min(f.width, f.height) >= MIN_PHOTO_SIDE;

/** JPG, PNG ou WebP, até o limite de bytes, grande o bastante para o formato (US1.3; 016 US1-6). */
export function checkPhotoFile(
  file: PhotoFile,
  maxBytes = MAX_PHOTO_BYTES,
  shape: PhotoShape = "PRODUCT",
): Result<true> {
  if (!PHOTO_TYPES.includes(file.type)) return err("PHOTO_TYPE");
  if (file.bytes > maxBytes) return err("PHOTO_TOO_BIG");
  if (!bigEnough(file, shape))
    return shape === "PRODUCT" ? err("PHOTO_TOO_SMALL") : err("PHOTO_TOO_SMALL", undefined, { kind: shape });
  return ok(true);
}

/** Maior recorte na proporção do formato que cabe na foto, em pixels inteiros. */
export function croppedSize(
  width: number,
  height: number,
  shape: PhotoShape = "PRODUCT",
): { width: number; height: number } {
  const [w, h] = PHOTO_SHAPES[shape].ratio;
  const unit = Math.min(Math.floor(width / w), Math.floor(height / h));
  return { width: unit * w, height: unit * h };
}

/** Larguras gravadas: as do formato que não passam da foto recortada (nunca amplia). */
export function variantWidths(croppedWidth: number, shape: PhotoShape = "PRODUCT"): number[] {
  return PHOTO_SHAPES[shape].widths.filter((w) => w <= croppedWidth);
}

export const photoUrl = (photo: Photo, width: number): string => `${photo.base}/${width}.webp`;

/** `srcset` com todas as larguras; produto sem foto não tem (US6.3). */
export function photoSrcSet(photo: Photo): string;
export function photoSrcSet(photo: Photo | null): string | null;
export function photoSrcSet(photo: Photo | null): string | null {
  if (!photo) return null;
  return photo.widths.map((w) => `${photoUrl(photo, w)} ${w}w`).join(", ");
}
