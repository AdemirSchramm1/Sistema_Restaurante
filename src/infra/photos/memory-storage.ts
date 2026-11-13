import type { PhotoStorage } from "@/application/menu/ports";

export type MemoryPhotoStorage = PhotoStorage & { files: Map<string, Uint8Array>; failing: boolean };

/** Loja de fotos na memória, para os testes. */
export function memoryPhotoStorage(): MemoryPhotoStorage {
  return { files: new Map(), failing: false, put: async () => ({ base: "" }), remove: async () => undefined };
}
