import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { ownerTestDb, testEnv } from "../harness";
import { code, menuKitchen, recipeRow, unwrap } from "./fixtures";
import { removeProductPhoto, setProductPhoto } from "../../../src/application/menu/photo";

/** Foto do produto (spec 013, US1 e FR-003). */
const file = async (name: string) => new Uint8Array(await readFile(`tests/screens/photos/${name}`));
const photoAudit = async (restaurantId: string) => {
  const r = await ownerTestDb().execute<{
    action: string;
    changes: Record<string, unknown>;
    user_id: string;
  }>(
    sql`select action, changes, user_id from audit_log
        where restaurant_id = ${restaurantId} and changes->>'event' like 'menu.photo.%' order by occurred_at, id`,
  );
  return r.rows;
};

describe("foto do produto (spec 013, US1)", () => {
  it("grava as variantes, liga a foto ao produto e audita", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    const { photo } = unwrap(
      await setProductPhoto(env.deps, k.chef, { id: k.burger, bytes: await file("deitada.jpg") }),
    );
    expect(photo.widths).toEqual([300, 600, 900, 1200]);
    expect(photo.base).toMatch(
      /^\/fotos\/menu\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    // O endereço não entrega de quem é a foto.
    expect(photo.base).not.toContain(k.burger);
    expect(photo.base).not.toContain(k.m.restaurantId);
    expect([...env.photos.files.keys()].sort()).toEqual(
      [300, 600, 900, 1200].map((w) => `${photo.base.slice("/fotos/".length)}/${w}.webp`).sort(),
    );
    expect(await recipeRow(k.burger)).toMatchObject({
      photo_base: photo.base,
      photo_widths: [300, 600, 900, 1200],
      version: 2,
    });
    expect(await photoAudit(k.m.restaurantId)).toEqual([
      {
        action: "UPDATE",
        user_id: k.chef.userId,
        changes: { event: "menu.photo.set", photo: [null, photo.base] },
      },
    ]);
  });

  it("trocar a foto apaga os arquivos da anterior depois de gravar", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    const first = unwrap(
      await setProductPhoto(env.deps, k.m, { id: k.burger, bytes: await file("deitada.jpg") }),
    );
    const second = unwrap(
      await setProductPhoto(env.deps, k.m, { id: k.burger, bytes: await file("prato.png") }),
    );
    expect(second.photo.base).not.toBe(first.photo.base);
    expect(second.photo.widths).toEqual([300, 600]);
    const keys = [...env.photos.files.keys()];
    expect(keys).toHaveLength(2);
    expect(keys.every((key) => second.photo.base.endsWith(key.split("/")[1]!))).toBe(true);
    expect((await photoAudit(k.m.restaurantId))[1]!.changes).toEqual({
      event: "menu.photo.set",
      photo: [first.photo.base, second.photo.base],
    });
  });

  it("recusa PDF e foto pequena sem gravar nada", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    expect(
      code(await setProductPhoto(env.deps, k.m, { id: k.burger, bytes: await file("documento.pdf") })),
    ).toBe("PHOTO_TYPE");
    expect(
      code(await setProductPhoto(env.deps, k.m, { id: k.burger, bytes: await file("pequena.jpg") })),
    ).toBe("PHOTO_TOO_SMALL");
    expect(env.photos.files.size).toBe(0);
    expect((await recipeRow(k.burger)).photo_base).toBeNull();
  });

  it("loja de fotos fora do ar: PHOTO_STORAGE_FAILED e o produto continua como estava", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    const before = unwrap(
      await setProductPhoto(env.deps, k.m, { id: k.burger, bytes: await file("prato.png") }),
    );
    env.photos.failing = true;
    expect(
      code(await setProductPhoto(env.deps, k.m, { id: k.burger, bytes: await file("deitada.jpg") })),
    ).toBe("PHOTO_STORAGE_FAILED");
    expect((await recipeRow(k.burger)).photo_base).toBe(before.photo.base);
    expect(env.photos.files.size).toBe(2);
  });

  it("se a gravação no banco falha, apaga os arquivos novos e mantém a foto antiga", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    const before = unwrap(
      await setProductPhoto(env.deps, k.m, { id: k.burger, bytes: await file("prato.png") }),
    );
    let calls = 0;
    const broken = {
      ...env.deps,
      tenant: ((restaurantId, fn) => {
        calls += 1;
        if (calls === 2) return Promise.reject(new Error("banco caiu"));
        return env.deps.tenant(restaurantId, fn);
      }) as typeof env.deps.tenant,
    };
    await expect(
      setProductPhoto(broken, k.m, { id: k.burger, bytes: await file("deitada.jpg") }),
    ).rejects.toThrow("banco caiu");
    expect((await recipeRow(k.burger)).photo_base).toBe(before.photo.base);
    expect([...env.photos.files.keys()].map((key) => key.split("/")[1])).toEqual(
      Array(2).fill(before.photo.base.split("/").at(-1)),
    );
  });

  it("apagar os arquivos antigos falhar não desfaz a troca", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    unwrap(await setProductPhoto(env.deps, k.m, { id: k.burger, bytes: await file("prato.png") }));
    env.photos.remove = () => Promise.reject(new Error("loja fora do ar"));
    const second = unwrap(
      await setProductPhoto(env.deps, k.m, { id: k.burger, bytes: await file("lanche.webp") }),
    );
    expect((await recipeRow(k.burger)).photo_base).toBe(second.photo.base);
  });

  it("tirar a foto limpa o produto, apaga os arquivos e audita; sem foto não há o que tirar", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    const { photo } = unwrap(
      await setProductPhoto(env.deps, k.m, { id: k.burger, bytes: await file("prato.png") }),
    );
    expect(code(await removeProductPhoto(env.deps, k.chef, { id: k.burger }))).toBe("OK");
    expect(await recipeRow(k.burger)).toMatchObject({ photo_base: null, photo_widths: null, version: 2 });
    expect(env.photos.files.size).toBe(0);
    expect((await photoAudit(k.m.restaurantId)).at(-1)).toEqual({
      action: "UPDATE",
      user_id: k.chef.userId,
      changes: { event: "menu.photo.remove", photo: [photo.base, null] },
    });
    expect(code(await removeProductPhoto(env.deps, k.chef, { id: k.burger }))).toBe("NO_CHANGE");
  });

  it("preparo não tem foto; sem permissão não mexe; de outro restaurante não existe", async () => {
    const env = testEnv();
    const k = await menuKitchen(env);
    const other = await menuKitchen(env);
    const bytes = await file("prato.png");
    expect(code(await setProductPhoto(env.deps, k.m, { id: k.molho, bytes }))).toBe("NOT_A_DISH");
    expect(code(await setProductPhoto(env.deps, k.stockkeeper, { id: k.burger, bytes }))).toBe("FORBIDDEN");
    expect(code(await setProductPhoto(env.deps, other.m, { id: k.burger, bytes }))).toBe("NOT_FOUND");
    expect(code(await removeProductPhoto(env.deps, k.m, { id: k.molho }))).toBe("NOT_A_DISH");
    expect(code(await removeProductPhoto(env.deps, k.stockkeeper, { id: k.burger }))).toBe("FORBIDDEN");
    expect(code(await removeProductPhoto(env.deps, other.m, { id: k.burger }))).toBe("NOT_FOUND");
    expect(env.photos.files.size).toBe(0);
  });
});
