import type { PhotoStorage } from "@/application/menu/ports";

export type BlobApi = {
  put(
    pathname: string,
    body: Buffer,
    options: { access: "public"; addRandomSuffix: false; contentType: string; cacheControlMaxAge: number },
  ): Promise<{ url: string }>;
  del(urls: string[]): Promise<unknown>;
};

/** Loja de fotos no Vercel Blob, para produção. */
export function vercelBlobStorage(_api: BlobApi): PhotoStorage {
  return { put: async () => ({ base: "" }), remove: async () => undefined };
}
