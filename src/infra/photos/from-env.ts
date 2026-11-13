import type { PhotoStorage } from "@/application/menu/ports";
import { vercelBlobStorage, type BlobApi } from "./vercel-blob-storage";
import { memoryPhotoStorage } from "./memory-storage";
import { filePhotoStorage } from "./file-storage";

export type ChosenPhotoStorage = {
  kind: "memory" | "file" | "vercel-blob";
  storage: PhotoStorage;
  /** Só a loja em pasta serve os arquivos pela rota `/fotos`. */
  read?: (segments: readonly string[]) => Promise<Uint8Array | null>;
};

/** Escolhe a loja de fotos pela variável `MENU_PHOTOS` (padrão: memória). */
export function photoStorageFromEnv(
  env: Record<string, string | undefined>,
  blob: BlobApi,
): ChosenPhotoStorage {
  const kind = env.MENU_PHOTOS ?? "memory";
  if (kind === "memory") return { kind, storage: memoryPhotoStorage() };
  if (kind === "file") {
    const storage = filePhotoStorage(env.MENU_PHOTO_DIR ?? ".menu-photos");
    return { kind, storage, read: storage.read };
  }
  if (kind === "vercel-blob") return { kind, storage: vercelBlobStorage(blob) };
  throw new Error("MENU_PHOTOS deve ser memory, file ou vercel-blob");
}
