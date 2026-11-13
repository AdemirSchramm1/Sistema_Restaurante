import type { Photo } from "@/domain/menu/photo";
import { err, type Result } from "@/domain/shared/result";

/** Envio da foto com progresso (spec 013, research R2). */

export type UploadRequest = {
  status: number;
  responseText: string;
  upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  open(method: string, url: string): void;
  send(body: FormData): void;
};

export function uploadPhoto(
  _input: { recipeId: string; file: Blob; onProgress: (percent: number) => void },
  _create: () => UploadRequest = () => new XMLHttpRequest() as unknown as UploadRequest,
): Promise<Result<Photo>> {
  return Promise.resolve(err("VALIDATION"));
}
