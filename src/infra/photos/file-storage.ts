import { mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PhotoStorage } from "@/application/menu/ports";
import { PUBLIC_PREFIX } from "./memory-storage";

export type FilePhotoStorage = PhotoStorage & {
  /** Lê o arquivo pelo caminho público (`menu/{photoId}/{largura}.webp`); `null` se não existe. */
  read(segments: readonly string[]): Promise<Uint8Array | null>;
};

const SAFE_ID = /^[A-Za-z0-9-]+$/;
const FILE = /^\d+\.webp$/;

/** Loja de fotos numa pasta local, para desenvolvimento e testes de tela. */
export function filePhotoStorage(dir: string): FilePhotoStorage {
  const folder = (photoId: string) => {
    if (!SAFE_ID.test(photoId)) throw new Error("Caminho de foto inválido");
    return path.join(dir, "menu", photoId);
  };
  return {
    async put(photoId, variants) {
      const target = folder(photoId);
      await mkdir(target, { recursive: true });
      await Promise.all(variants.map((v) => writeFile(path.join(target, `${v.width}.webp`), v.bytes)));
      return { base: `${PUBLIC_PREFIX}menu/${photoId}` };
    },
    async remove(base, widths) {
      const target = folder(base.slice(`${PUBLIC_PREFIX}menu/`.length));
      await Promise.all(widths.map((w) => rm(path.join(target, `${w}.webp`), { force: true })));
      // Só sai a pasta vazia; se ainda tem largura gravada, fica.
      await rmdir(target).catch(() => undefined);
    },
    async read(segments) {
      const [root, photoId, file] = segments;
      if (segments.length !== 3 || root !== "menu" || !SAFE_ID.test(photoId!) || !FILE.test(file!))
        return null;
      return readFile(path.join(dir, "menu", photoId!, file!)).then(
        (b) => new Uint8Array(b),
        () => null,
      );
    },
  };
}
