import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { memoryPhotoStorage } from "./memory-storage";
import { filePhotoStorage } from "./file-storage";
import { vercelBlobStorage } from "./vercel-blob-storage";
import { photoStorageFromEnv } from "./from-env";

/** Spec 013, research R3: a loja de fotos fica atrás de uma porta, com três implementações. */
const bytes = (n: number) => new Uint8Array([n, n, n]);
const variants = [
  { width: 300, bytes: bytes(3) },
  { width: 600, bytes: bytes(6) },
];
const ID = "0b0e7a52-5d4c-4d53-9d0c-6a3b0a2f1c11";

describe("loja de fotos na memória (testes)", () => {
  it("grava menu/{photoId}/{largura}.webp, devolve a base e apaga", async () => {
    const storage = memoryPhotoStorage();
    const { base } = await storage.put(ID, variants);
    expect(base).toBe(`/fotos/menu/${ID}`);
    expect([...storage.files.keys()]).toEqual([`menu/${ID}/300.webp`, `menu/${ID}/600.webp`]);
    expect(storage.files.get(`menu/${ID}/600.webp`)).toEqual(bytes(6));
    await storage.remove(base, [300]);
    expect([...storage.files.keys()]).toEqual([`menu/${ID}/600.webp`]);
  });

  it("fora do ar, gravar falha e nada fica guardado", async () => {
    const storage = memoryPhotoStorage();
    storage.failing = true;
    await expect(storage.put(ID, variants)).rejects.toThrow("fora do ar");
    expect(storage.files.size).toBe(0);
  });
});

describe("loja de fotos em pasta (desenvolvimento e testes de tela)", () => {
  let dir = "";
  afterEach(() => rm(dir, { recursive: true, force: true }));
  const fresh = async () => filePhotoStorage((dir = await mkdtemp(path.join(tmpdir(), "fotos-"))));

  it("grava os arquivos, devolve a base e lê pelo caminho público", async () => {
    const storage = await fresh();
    const { base } = await storage.put(ID, variants);
    expect(base).toBe(`/fotos/menu/${ID}`);
    expect(new Uint8Array(await readFile(path.join(dir, "menu", ID, "300.webp")))).toEqual(bytes(3));
    expect(await storage.read(["menu", ID, "600.webp"])).toEqual(bytes(6));
  });

  it("apaga as larguras pedidas e a pasta da foto quando fica vazia", async () => {
    const storage = await fresh();
    const { base } = await storage.put(ID, variants);
    await storage.remove(base, [300]);
    expect(await storage.read(["menu", ID, "300.webp"])).toBeNull();
    expect(await storage.read(["menu", ID, "600.webp"])).toEqual(bytes(6));
    await storage.remove(base, [600]);
    await expect(stat(path.join(dir, "menu", ID))).rejects.toThrow();
  });

  it("apagar foto que já não existe não é erro", async () => {
    const storage = await fresh();
    await expect(storage.remove(`/fotos/menu/${ID}`, [300])).resolves.toBeUndefined();
  });

  it("recusa caminho com .. ou fora de menu/", async () => {
    const storage = await fresh();
    await expect(storage.put("../fora", variants)).rejects.toThrow("Caminho de foto inválido");
    await expect(storage.remove("/fotos/menu/../..", [300])).rejects.toThrow("Caminho de foto inválido");
    expect(await storage.read(["menu", "..", "..", "etc", "passwd"])).toBeNull();
    expect(await storage.read(["outra", ID, "300.webp"])).toBeNull();
    expect(await storage.read(["menu", ID, "300.png"])).toBeNull();
    expect(await storage.read(["menu", ID])).toBeNull();
  });
});

describe("loja de fotos no Vercel Blob (produção)", () => {
  const blob = () => ({
    put: vi.fn(async (pathname: string) => ({
      url: `https://loja.public.blob.vercel-storage.com/${pathname}`,
    })),
    del: vi.fn(async () => undefined),
  });

  it("grava cada largura como arquivo público, sem sufixo aleatório, WebP, com cache de um ano", async () => {
    const api = blob();
    const { base } = await vercelBlobStorage(api).put(ID, variants);
    expect(base).toBe(`https://loja.public.blob.vercel-storage.com/menu/${ID}`);
    expect(api.put).toHaveBeenCalledTimes(2);
    expect(api.put).toHaveBeenCalledWith(`menu/${ID}/300.webp`, Buffer.from(bytes(3)), {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/webp",
      cacheControlMaxAge: 31_536_000,
    });
  });

  it("apaga pelos endereços das larguras", async () => {
    const api = blob();
    await vercelBlobStorage(api).remove(`https://loja.public.blob.vercel-storage.com/menu/${ID}`, [300, 600]);
    expect(api.del).toHaveBeenCalledWith([
      `https://loja.public.blob.vercel-storage.com/menu/${ID}/300.webp`,
      `https://loja.public.blob.vercel-storage.com/menu/${ID}/600.webp`,
    ]);
  });
});

describe("escolha da loja por MENU_PHOTOS", () => {
  const api = { put: vi.fn(), del: vi.fn() };

  it("memory (ou nada) guarda na memória", () => {
    expect(photoStorageFromEnv({}, api).kind).toBe("memory");
    expect(photoStorageFromEnv({ MENU_PHOTOS: "memory" }, api).kind).toBe("memory");
  });

  it("file guarda em MENU_PHOTO_DIR e sabe ler para a rota /fotos", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "fotos-"));
    const chosen = photoStorageFromEnv({ MENU_PHOTOS: "file", MENU_PHOTO_DIR: dir }, api);
    expect(chosen.kind).toBe("file");
    await chosen.storage.put(ID, variants);
    expect(await chosen.read!(["menu", ID, "300.webp"])).toEqual(bytes(3));
    await rm(dir, { recursive: true, force: true });
  });

  it("file sem MENU_PHOTO_DIR usa .menu-photos", () => {
    expect(photoStorageFromEnv({ MENU_PHOTOS: "file" }, api).kind).toBe("file");
  });

  it("vercel-blob usa a loja Blob", async () => {
    const chosen = photoStorageFromEnv({ MENU_PHOTOS: "vercel-blob" }, api);
    expect(chosen.kind).toBe("vercel-blob");
    expect(chosen.read).toBeUndefined();
    await chosen.storage.remove("https://x/menu/a", [300]);
    expect(api.del).toHaveBeenCalledWith(["https://x/menu/a/300.webp"]);
  });

  it("valor desconhecido é erro de configuração", () => {
    expect(() => photoStorageFromEnv({ MENU_PHOTOS: "s3" }, api)).toThrow(
      "MENU_PHOTOS deve ser memory, file ou vercel-blob",
    );
  });
});
