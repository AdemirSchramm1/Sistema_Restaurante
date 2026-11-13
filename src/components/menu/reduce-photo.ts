import type { Result } from "@/domain/shared/result";
import { err } from "@/domain/shared/result";

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
  decode: () => Promise.reject(new Error("a fazer")),
  canvas: () => {
    throw new Error("a fazer");
  },
};

export async function reducePhoto(
  _file: File,
  _tools: PhotoTools = browserPhotoTools,
): Promise<Result<Blob>> {
  return err("VALIDATION");
}
