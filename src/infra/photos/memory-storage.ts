import type { PhotoStorage } from "@/application/menu/ports";
import { photoUrl } from "@/domain/menu/photo";

export type MemoryPhotoStorage = PhotoStorage & {
  files: Map<string, Uint8Array>;
  /** Liga para simular a loja fora do ar. */
  failing: boolean;
};

export const PUBLIC_PREFIX = "/fotos/";

/** Loja de fotos na memória, para os testes. */
export function memoryPhotoStorage(): MemoryPhotoStorage {
  const files = new Map<string, Uint8Array>();
  const storage: MemoryPhotoStorage = {
    files,
    failing: false,
    async put(photoId, variants) {
      if (storage.failing) throw new Error("Loja de fotos fora do ar");
      for (const v of variants) files.set(`menu/${photoId}/${v.width}.webp`, v.bytes);
      return { base: `${PUBLIC_PREFIX}menu/${photoId}` };
    },
    async remove(base, widths) {
      for (const w of widths) files.delete(photoUrl({ base, widths: [] }, w).slice(PUBLIC_PREFIX.length));
    },
  };
  return storage;
}
