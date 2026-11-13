import { ok, type Result } from "../shared/result";

/** Foto do produto no cardápio (spec 013, US1 e FR-003). Esqueleto. */
export type Photo = { base: string; widths: number[] };
export type PhotoFile = { type: string; bytes: number; width: number; height: number };

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MIN_PHOTO_SIDE = 600;
export const PHOTO_WIDTHS = [300, 600, 900, 1200] as const;

export function checkPhotoFile(_file: PhotoFile, _maxBytes = MAX_PHOTO_BYTES): Result<true> {
  return ok(true);
}
export function croppedSize(_width: number, _height: number): { width: number; height: number } {
  return { width: 0, height: 0 };
}
export function variantWidths(_croppedWidth: number): number[] {
  return [];
}
export function photoUrl(_photo: Photo, _width: number): string {
  return "";
}
export function photoSrcSet(_photo: Photo | null): string | null {
  return null;
}
