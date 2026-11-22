import type { Photo } from "@/domain/menu/photo";
import { err, ok, type ErrorCode, type Result } from "@/domain/shared/result";

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

const FAILED = err("PHOTO_STORAGE_FAILED");

type Answer = { photo?: Photo; code?: ErrorCode } | null;
function parse(text: string): Answer {
  try {
    return JSON.parse(text) as Answer;
  } catch {
    return null;
  }
}

/** Lê a resposta da rota: a foto no 200, o código do erro nos demais. */
function outcome(status: number, text: string): Result<Photo> {
  const body = parse(text);
  if (status === 200 && body?.photo) return ok(body.photo);
  return status !== 200 && body?.code ? err(body.code) : FAILED;
}

/** `XMLHttpRequest` em vez de `fetch` porque só ele informa o progresso do envio. */
export function uploadPhoto(
  input: (
    | { recipeId: string; kind?: undefined }
    /** Logo ou capa do restaurante (spec 016). */
    | { recipeId?: undefined; kind: "LOGO" | "COVER" }
  ) & { file: Blob; onProgress: (percent: number) => void },
  create: () => UploadRequest = () => new XMLHttpRequest() as unknown as UploadRequest,
): Promise<Result<Photo>> {
  return new Promise((resolve) => {
    const xhr = create();
    const form = new FormData();
    if (input.kind) form.set("kind", input.kind);
    else form.set("recipeId", input.recipeId);
    form.set("photo", input.file);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) input.onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve(outcome(xhr.status, xhr.responseText));
    xhr.onerror = () => resolve(FAILED);
    xhr.open("POST", "/api/cardapio/foto");
    xhr.send(form);
  });
}
