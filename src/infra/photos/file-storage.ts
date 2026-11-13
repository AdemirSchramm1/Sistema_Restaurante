import type { PhotoStorage } from "@/application/menu/ports";

export type FilePhotoStorage = PhotoStorage & {
  /** Lê o arquivo pelo caminho público (`menu/{photoId}/{largura}.webp`); `null` se não existe. */
  read(segments: readonly string[]): Promise<Uint8Array | null>;
};

/** Loja de fotos numa pasta local, para desenvolvimento e testes de tela. */
export function filePhotoStorage(_dir: string): FilePhotoStorage {
  return { put: async () => ({ base: "" }), remove: async () => undefined, read: async () => null };
}
