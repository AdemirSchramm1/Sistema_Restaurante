import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { photoFileResponse } from "../../../src/actions/_menu-photo";
import { photoStorageFromEnv } from "../../../src/infra/photos/from-env";

/** Rotas das fotos do cardápio (spec 013, contracts/use-cases.md). */
const blob = {
  put: () => Promise.reject(new Error("sem Blob")),
  del: () => Promise.reject(new Error("sem Blob")),
};
const ID = "0b0e7a52-5d4c-4d53-9d0c-6a3b0a2f1c11";

describe("GET /fotos/menu/{photoId}/{largura}.webp (só com MENU_PHOTOS=file)", () => {
  it("devolve o arquivo como WebP, com cache de um ano", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "fotos-"));
    const chosen = photoStorageFromEnv({ MENU_PHOTOS: "file", MENU_PHOTO_DIR: dir }, blob);
    await chosen.storage.put(ID, [{ width: 300, bytes: new Uint8Array([1, 2, 3]) }]);
    const res = await photoFileResponse(chosen, ["menu", ID, "300.webp"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    await rm(dir, { recursive: true, force: true });
  });

  it("arquivo que não existe ou caminho estranho: 404", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "fotos-"));
    const chosen = photoStorageFromEnv({ MENU_PHOTOS: "file", MENU_PHOTO_DIR: dir }, blob);
    for (const segments of [["menu", ID, "600.webp"], ["menu", "..", "..", "etc", "passwd"], ["x"]]) {
      const res = await photoFileResponse(chosen, segments);
      expect(res.status, segments.join("/")).toBe(404);
    }
    await rm(dir, { recursive: true, force: true });
  });

  it("com outra loja (memória ou Vercel Blob) a rota não existe: 404", async () => {
    for (const MENU_PHOTOS of ["memory", "vercel-blob"]) {
      const res = await photoFileResponse(photoStorageFromEnv({ MENU_PHOTOS }, blob), [
        "menu",
        ID,
        "300.webp",
      ]);
      expect(res.status).toBe(404);
    }
  });
});
