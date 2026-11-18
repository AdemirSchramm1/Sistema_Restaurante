import { describe, expect, it } from "vitest";
import type { Repos } from "../ports";
import { customerMenu } from "./menu";
import { loadAccess } from "./menu-access";
import { d } from "@/domain/shared/decimal";

/**
 * Guardas do cardápio que o banco real não alcança (mesma transação): produto que some do catálogo
 * entre as duas leituras e acesso ou mesa que não existem mais.
 */
const row = (id: string) => ({
  id,
  name: id,
  kind: "DISH" as const,
  active: true,
  salePrice: d("10.00"),
  soldOutOn: null,
  description: null,
  photo: null,
  sectionId: null,
  menuPosition: 1,
});
const product = (
  id: string,
  over: { available?: boolean; salePrice?: ReturnType<typeof d> | null } = {},
) => ({
  id,
  name: id,
  versionId: `${id}-v1`,
  salePrice: d("10.00"),
  available: true,
  options: { addons: [], removables: [] },
  ...over,
});

describe("cardápio: guardas (spec 009/016)", () => {
  it("fora do catálogo, indisponível ou sem preço agora: não aparece", async () => {
    const repos = {
      menuBoard: {
        sections: async () => [],
        products: async () => ["a", "sumiu", "parado", "sem-preco"].map(row),
      },
      menu: {
        catalog: async () =>
          new Map([
            ["a", product("a")],
            ["parado", product("parado", { available: false })],
            ["sem-preco", product("sem-preco", { salePrice: null })],
          ]),
      },
    } as unknown as Repos;
    const menu = await customerMenu(repos, "2026-11-18");
    expect(menu.sections.flatMap((s) => s.products.map((p) => p.id))).toEqual(["a"]);
  });

  it("acesso ou mesa que não existem: ACCESS_EXPIRED", async () => {
    const access = { id: "x", tableId: "t" };
    const make = (a: unknown, t: unknown) =>
      ({
        menuAccesses: { get: async () => a },
        tables: { get: async () => t },
        orderingSettings: { get: async () => ({}) },
      }) as unknown as Repos;
    for (const repos of [make(null, null), make(access, null)])
      expect(await loadAccess(repos, "x")).toMatchObject({ ok: false, error: { code: "ACCESS_EXPIRED" } });
  });
});
