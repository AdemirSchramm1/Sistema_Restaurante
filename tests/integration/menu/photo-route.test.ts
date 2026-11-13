import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { photoFileResponse, uploadPhotoResponse } from "../../../src/actions/_menu-photo";
import { testEnv } from "../harness";
import { menuKitchen, recipeRow } from "./fixtures";
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

describe("POST /api/cardapio/foto", () => {
  const upload = async (recipeId: string | null, fileName: string | null) => {
    const form = new FormData();
    if (recipeId) form.set("recipeId", recipeId);
    if (fileName) {
      const bytes = await readFile(`tests/screens/photos/${fileName}`);
      form.set("photo", new Blob([new Uint8Array(bytes)]), fileName);
    }
    return new Request("http://localhost/api/cardapio/foto", { method: "POST", body: form });
  };

  it("grava a foto e devolve 200 com a foto", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    const res = await uploadPhotoResponse(env.deps, k.chef, await upload(k.burger, "deitada.jpg"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { photo: { base: string; widths: number[] } };
    expect(body.photo.widths).toEqual([300, 600, 900, 1200]);
    expect((await recipeRow(k.burger)).photo_base).toBe(body.photo.base);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("sem login: 401, sem ler o corpo", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    const res = await uploadPhotoResponse(env.deps, null, await upload(k.burger, "deitada.jpg"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "UNAUTHENTICATED" });
    expect(env.photos.files.size).toBe(0);
  });

  it("sem menu.write: 403", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    const res = await uploadPhotoResponse(env.deps, k.stockkeeper, await upload(k.burger, "deitada.jpg"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: "FORBIDDEN" });
    expect((await recipeRow(k.burger)).photo_base).toBeNull();
  });

  it("corpo acima de 4 MB: 413, pelo cabeçalho e pelo tamanho do arquivo", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    const declared = await upload(k.burger, "deitada.jpg");
    declared.headers.set("content-length", String(4 * 1024 * 1024 + 4096 + 1));
    expect((await uploadPhotoResponse(env.deps, k.chef, declared)).status).toBe(413);

    const form = new FormData();
    form.set("recipeId", k.burger);
    form.set("photo", new Blob([new Uint8Array(4 * 1024 * 1024 + 1)]), "grande.jpg");
    const big = new Request("http://localhost/api/cardapio/foto", { method: "POST", body: form });
    const res = await uploadPhotoResponse(env.deps, k.chef, big);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ code: "PHOTO_TOO_BIG" });
    expect(env.photos.files.size).toBe(0);
  });

  it("erros de setProductPhoto: 400 com o código", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    const cases: [string, string, string][] = [
      [k.burger, "documento.pdf", "PHOTO_TYPE"],
      [k.burger, "pequena.jpg", "PHOTO_TOO_SMALL"],
      [k.molho, "deitada.jpg", "NOT_A_DISH"],
      ["0b0e7a52-5d4c-4d53-9d0c-6a3b0a2f1c11", "deitada.jpg", "NOT_FOUND"],
    ];
    for (const [id, fileName, code] of cases) {
      const res = await uploadPhotoResponse(env.deps, k.chef, await upload(id, fileName));
      expect(res.status, code).toBe(400);
      expect(await res.json()).toEqual({ code });
    }
    env.photos.failing = true;
    const down = await uploadPhotoResponse(env.deps, k.chef, await upload(k.burger, "deitada.jpg"));
    expect(down.status).toBe(400);
    expect(await down.json()).toEqual({ code: "PHOTO_STORAGE_FAILED" });
  });

  it("formulário sem produto, sem foto ou que não é formulário: 400 VALIDATION", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    const requests = [
      await upload(null, "deitada.jpg"),
      await upload(k.burger, null),
      await upload("não é id", "deitada.jpg"),
      new Request("http://localhost/api/cardapio/foto", { method: "POST", body: "oi" }),
    ];
    for (const request of requests) {
      const res = await uploadPhotoResponse(env.deps, k.chef, request);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ code: "VALIDATION" });
    }
  });
});
