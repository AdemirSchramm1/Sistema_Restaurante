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

/** JPG, PNG ou WebP, até o limite de bytes, com o lado menor de pelo menos 600 px (US1.3). */
export function checkPhotoFile(file: PhotoFile, maxBytes = MAX_PHOTO_BYTES): Result<true> {
  if (!PHOTO_TYPES.includes(file.type)) return err("PHOTO_TYPE");
  if (file.bytes > maxBytes) return err("PHOTO_TOO_BIG");
  if (Math.min(file.width, file.height) < MIN_PHOTO_SIDE) return err("PHOTO_TOO_SMALL");
  return ok(true);
}

/** Maior recorte 4:3 que cabe na foto, em pixels inteiros. */
export function croppedSize(width: number, height: number): { width: number; height: number } {
  const unit = Math.min(Math.floor(width / 4), Math.floor(height / 3));
  return { width: unit * 4, height: unit * 3 };
}

/** Larguras gravadas: as de `PHOTO_WIDTHS` que não passam da foto recortada (nunca amplia). */
export function variantWidths(croppedWidth: number): number[] {
  return PHOTO_WIDTHS.filter((w) => w <= croppedWidth);
}

export const photoUrl = (photo: Photo, width: number): string => `${photo.base}/${width}.webp`;

/** `srcset` com todas as larguras; produto sem foto não tem (US6.3). */
export function photoSrcSet(photo: Photo | null): string | null {
  if (!photo) return null;
  return photo.widths.map((w) => `${photoUrl(photo, w)} ${w}w`).join(", ");
}
