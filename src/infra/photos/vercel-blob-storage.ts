import type { PhotoStorage } from "@/application/menu/ports";
import { photoUrl } from "@/domain/menu/photo";

export type BlobApi = {
  put(
    pathname: string,
    body: Buffer,
    options: { access: "public"; addRandomSuffix: false; contentType: string; cacheControlMaxAge: number },
  ): Promise<{ url: string }>;
  del(urls: string[]): Promise<unknown>;
};

const ONE_YEAR = 31_536_000;

/** Loja de fotos no Vercel Blob, para produção (ADR 0006). O nome do arquivo já é único. */
export function vercelBlobStorage(api: BlobApi): PhotoStorage {
  return {
    async put(photoId, variants) {
      const saved = await Promise.all(
        variants.map((v) =>
          api.put(`menu/${photoId}/${v.width}.webp`, Buffer.from(v.bytes), {
            access: "public",
            addRandomSuffix: false,
            contentType: "image/webp",
            cacheControlMaxAge: ONE_YEAR,
          }),
        ),
      );
      return { base: saved[0]!.url.slice(0, saved[0]!.url.lastIndexOf("/")) };
    },
    async remove(base, widths) {
      await api.del(widths.map((w) => photoUrl({ base, widths: [] }, w)));
    },
  };
}
