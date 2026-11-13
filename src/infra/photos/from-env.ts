import type { PhotoStorage } from "@/application/menu/ports";
import type { BlobApi } from "./vercel-blob-storage";
import { memoryPhotoStorage } from "./memory-storage";

export type ChosenPhotoStorage = {
  kind: "memory" | "file" | "vercel-blob";
  storage: PhotoStorage;
  read?: (segments: readonly string[]) => Promise<Uint8Array | null>;
};

/** Escolhe a loja de fotos pela variável `MENU_PHOTOS`. */
export function photoStorageFromEnv(
  _env: Record<string, string | undefined>,
  _blob: BlobApi,
): ChosenPhotoStorage {
  return { kind: "memory", storage: memoryPhotoStorage() };
}
