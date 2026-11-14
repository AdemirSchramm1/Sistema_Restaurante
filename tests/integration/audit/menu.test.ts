import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { ownerTestDb, testEnv } from "../harness";
import { menuScenario, unwrap } from "../menu/fixtures";
import { itemLine } from "../../builders/recipe-data";
import { getAuditHistory } from "../../../src/application/audit/get-audit-history";
import { createMenuProduct } from "../../../src/application/menu/create-product";
import { setMenuDetails } from "../../../src/application/menu/details";
import { moveProduct } from "../../../src/application/menu/order";
import { removeProductPhoto, setProductPhoto } from "../../../src/application/menu/photo";
import {
  createSection,
  deleteSection,
  moveSection,
  renameSection,
} from "../../../src/application/menu/sections";
import { d } from "../../../src/domain/shared/decimal";

/** FR-009: toda escrita da tela Cardápio fica na auditoria, e toda tentativa sem permissão também. */
const photo = async () => new Uint8Array(await readFile("tests/screens/photos/prato.png"));

describe("auditoria da tela Cardápio (spec 013, FR-009)", () => {
  it("o histórico do produto mostra quem, quando e o que mudou no cardápio", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const start = env.clock.now().getTime();
    const step = () => env.clock.advance(60_000);

    step();
    unwrap(await setProductPhoto(env.deps, s.chef, { id: s.salada, bytes: await photo() }));
    step();
    unwrap(
      await setMenuDetails(env.deps, s.chef, {
        id: s.salada,
        // A foto não mexe na trava do produto: a versão continua a do preço.
        version: 2,
        description: "Com alface e tomate.",
        sectionId: s.entradas,
      }),
    );
    step();
    unwrap(
      await setMenuDetails(env.deps, s.m, {
        id: s.salada,
        version: 3,
        description: "",
        sectionId: s.lanches,
      }),
    );
    step();
    unwrap(await moveProduct(env.deps, s.m, { id: s.salada, direction: "up" }));
    step();
    unwrap(await removeProductPhoto(env.deps, s.chef, { id: s.salada }));

    const history = unwrap(await getAuditHistory(env.deps, s.m, "recipe", s.salada));
    const menu = history.filter((h) => typeof h.changes?.event === "string");
    expect(menu.map((h) => [h.action, h.changes!.event, h.userName, h.occurredAt.getTime() - start])).toEqual(
      [
        ["UPDATE", "menu.photo.set", "Chef", 60_000],
        ["UPDATE", "menu.details", "Chef", 120_000],
        ["UPDATE", "menu.details", "Gerente", 180_000],
        ["UPDATE", "menu.product.move", "Gerente", 240_000],
        ["UPDATE", "menu.photo.remove", "Chef", 300_000],
      ],
    );
    expect(menu[1]!.changes).toEqual({
      event: "menu.details",
      menuDescription: [null, "Com alface e tomate."],
      menuSection: ["Lanches", "Entradas"],
    });
    expect(menu[3]!.changes).toMatchObject({ section: "Lanches", menuPosition: [2, 1] });
  });

  it("o histórico da seção mostra criar, renomear, mover e apagar", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const { id } = unwrap(await createSection(env.deps, s.chef, { name: "Sobremesas" }));
    unwrap(await renameSection(env.deps, s.m, { id, version: 1, name: "Doces" }));
    unwrap(await moveSection(env.deps, s.chef, { id, direction: "up" }));
    unwrap(await deleteSection(env.deps, s.m, { id }));
    const history = unwrap(await getAuditHistory(env.deps, s.m, "menu_section", id));
    expect(history.map((h) => [h.action, h.changes!.event, h.userName])).toEqual([
      ["CREATE", "menu.section.create", "Chef"],
      ["UPDATE", "menu.section.rename", "Gerente"],
      ["UPDATE", "menu.section.move", "Chef"],
      ["DEACTIVATE", "menu.section.delete", "Gerente"],
    ]);
    expect(history[1]!.changes).toMatchObject({ name: ["Sobremesas", "Doces"] });
  });

  it("produto criado pelo Cardápio tem a criação e o preço no histórico", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const { id } = unwrap(
      await createMenuProduct(env.deps, s.chef, {
        name: "Pudim",
        lines: [itemLine(s.pao, "1", "un")],
        salePrice: d("12.00"),
        sectionId: null,
        description: "",
      }),
    );
    const history = unwrap(await getAuditHistory(env.deps, s.m, "recipe", id));
    expect(history.map((h) => [h.action, h.userName])).toEqual([
      ["CREATE", "Chef"],
      ["UPDATE", "Chef"],
    ]);
    expect(history[1]!.changes).toEqual({ salePrice: [null, "12.00"] });
  });

  it("cada tentativa sem permissão fica gravada como negada, com quem tentou", async () => {
    const env = testEnv();
    const s = await menuScenario(env);
    const who = s.stockkeeper;
    const attempts = [
      () => createSection(env.deps, who, { name: "Sobremesas" }),
      () => renameSection(env.deps, who, { id: s.lanches, version: 1, name: "Sanduíches" }),
      () => moveSection(env.deps, who, { id: s.lanches, direction: "down" }),
      () => deleteSection(env.deps, who, { id: s.lanches }),
      () => moveProduct(env.deps, who, { id: s.burger, direction: "down" }),
      () => setMenuDetails(env.deps, who, { id: s.burger, version: 1, description: "x", sectionId: null }),
      async () => setProductPhoto(env.deps, who, { id: s.burger, bytes: await photo() }),
      () => removeProductPhoto(env.deps, who, { id: s.burger }),
      () =>
        createMenuProduct(env.deps, who, {
          name: "Pudim",
          lines: [itemLine(s.pao, "1", "un")],
          salePrice: null,
          sectionId: null,
          description: "",
        }),
    ];
    for (const attempt of attempts) {
      const r = await attempt();
      expect(r.ok ? "OK" : r.error.code).toBe("FORBIDDEN");
    }
    const denied = await ownerTestDb().execute<{
      entity: string;
      action: string;
      changes: { action?: string };
    }>(
      sql`select entity, action, changes from audit_log
          where restaurant_id = ${s.m.restaurantId} and user_id = ${who.userId} order by occurred_at, id`,
    );
    expect(denied.rows.map((r) => [r.entity, r.action])).toEqual([
      ["menu_section", "DENIED"],
      ["menu_section", "DENIED"],
      ["menu_section", "DENIED"],
      ["menu_section", "DENIED"],
      ["recipe", "DENIED"],
      ["recipe", "DENIED"],
      ["recipe", "DENIED"],
      ["recipe", "DENIED"],
      ["recipe", "DENIED"],
    ]);
  });
});
