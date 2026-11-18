import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { addMember, newRestaurant, ownerTestDb, testEnv } from "../harness";
import { code, unwrap } from "./fixtures";
import {
  getAppearance,
  removeAppearanceImage,
  setAppearanceImage,
} from "../../../src/application/menu/appearance";

/** Aparência do restaurante: logo e capa do cardápio (spec 016, US1; contracts "Aparência"). */
const file = async (name: string) => new Uint8Array(await readFile(`tests/screens/photos/${name}`));
const row = async (id: string) =>
  (
    await ownerTestDb().execute<{
      logo_base: string | null;
      logo_widths: number[] | null;
      cover_base: string | null;
      cover_widths: number[] | null;
      version: number;
    }>(
      sql`select logo_base, logo_widths, cover_base, cover_widths, version from restaurants where id = ${id}`,
    )
  ).rows[0]!;
const audit = async (restaurantId: string) =>
  (
    await ownerTestDb().execute<{ entity: string; action: string; changes: Record<string, unknown> }>(
      sql`select entity, action, changes from audit_log
          where restaurant_id = ${restaurantId} and entity = 'restaurant' and changes ? 'event' order by occurred_at, id`,
    )
  ).rows;

describe("aparência do cardápio (spec 016, US1)", () => {
  it("o gerente põe logo e capa: variantes, versão + 1 e auditoria com as bases", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const before = await row(m.restaurantId);
    const logo = unwrap(
      await setAppearanceImage(env.deps, m, { kind: "LOGO", bytes: await file("logo.png") }),
    );
    expect(logo.photo.widths).toEqual([96, 192, 384]);
    const cover = unwrap(
      await setAppearanceImage(env.deps, m, { kind: "COVER", bytes: await file("capa.jpg") }),
    );
    expect(cover.photo.widths).toEqual([600, 1200, 1920]);
    expect(await row(m.restaurantId)).toEqual({
      logo_base: logo.photo.base,
      logo_widths: [96, 192, 384],
      cover_base: cover.photo.base,
      cover_widths: [600, 1200, 1920],
      version: before.version + 2,
    });
    expect(await audit(m.restaurantId)).toEqual([
      {
        entity: "restaurant",
        action: "UPDATE",
        changes: { event: "appearance.set", kind: "LOGO", base: [null, logo.photo.base] },
      },
      {
        entity: "restaurant",
        action: "UPDATE",
        changes: { event: "appearance.set", kind: "COVER", base: [null, cover.photo.base] },
      },
    ]);
    expect(unwrap(await getAppearance(env.deps, m))).toEqual({ logo: logo.photo, cover: cover.photo });
  });

  it("trocar apaga os arquivos antigos só depois de gravar", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const first = unwrap(
      await setAppearanceImage(env.deps, m, { kind: "LOGO", bytes: await file("logo.png") }),
    );
    const second = unwrap(
      await setAppearanceImage(env.deps, m, { kind: "LOGO", bytes: await file("logo.png") }),
    );
    const keys = [...env.photos.files.keys()];
    expect(keys.every((k) => k.includes(second.photo.base.split("/").at(-1)!))).toBe(true);
    expect(keys.some((k) => k.includes(first.photo.base.split("/").at(-1)!))).toBe(false);
  });

  it("se o banco falha, apaga os arquivos novos e fica como estava", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const broken = {
      ...env.deps,
      tenant: (() => Promise.reject(new Error("banco caiu"))) as typeof env.deps.tenant,
    };
    await expect(
      setAppearanceImage(broken, m, { kind: "COVER", bytes: await file("capa.jpg") }),
    ).rejects.toThrow("banco caiu");
    expect(env.photos.files.size).toBe(0);
    expect((await row(m.restaurantId)).cover_base).toBeNull();
  });

  it("imagem pequena: PHOTO_TOO_SMALL com o formato, nada gravado", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const r = await setAppearanceImage(env.deps, m, {
      kind: "COVER",
      bytes: await file("capa-estreita.jpg"),
    });
    expect(r).toEqual({ ok: false, error: { code: "PHOTO_TOO_SMALL", details: { kind: "COVER" } } });
    expect(env.photos.files.size).toBe(0);
  });

  it("tirar: apaga a imagem e os arquivos; sem imagem, NO_CHANGE", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    expect(code(await removeAppearanceImage(env.deps, m, { kind: "LOGO" }))).toBe("NO_CHANGE");
    const logo = unwrap(
      await setAppearanceImage(env.deps, m, { kind: "LOGO", bytes: await file("logo.png") }),
    );
    const version = (await row(m.restaurantId)).version;
    expect(code(await removeAppearanceImage(env.deps, m, { kind: "LOGO" }))).toBe("OK");
    expect(await row(m.restaurantId)).toMatchObject({
      logo_base: null,
      logo_widths: null,
      version: version + 1,
    });
    expect(env.photos.files.size).toBe(0);
    expect((await audit(m.restaurantId)).at(-1)).toEqual({
      entity: "restaurant",
      action: "UPDATE",
      changes: { event: "appearance.remove", kind: "LOGO", base: [logo.photo.base, null] },
    });
  });

  it("chef vê a aparência mas não troca (FORBIDDEN com DENIED); caixa nem vê", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const chef = await addMember(env, m, ["CHEF"], "Chef");
    const cashier = await addMember(env, m, ["CASHIER"], "Caixa");
    expect(unwrap(await getAppearance(env.deps, chef))).toEqual({ logo: null, cover: null });
    expect(code(await getAppearance(env.deps, cashier))).toBe("FORBIDDEN");
    expect(
      code(await setAppearanceImage(env.deps, chef, { kind: "LOGO", bytes: await file("logo.png") })),
    ).toBe("FORBIDDEN");
    expect(code(await removeAppearanceImage(env.deps, chef, { kind: "LOGO" }))).toBe("FORBIDDEN");
    const denied = await ownerTestDb().execute<{ n: number }>(
      sql`select count(*)::int as n from audit_log where restaurant_id = ${m.restaurantId} and action = 'DENIED'`,
    );
    expect(denied.rows[0]!.n).toBeGreaterThanOrEqual(3);
    expect(env.photos.files.size).toBe(0);
  });
});
