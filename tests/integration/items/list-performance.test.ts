import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { newRestaurant, ownerTestDb, subgroupId, testEnv } from "../harness";
import { itemData } from "../../builders/item-data";
import { createItem } from "../../../src/application/inventory/create-item";
import { listItems } from "../../../src/application/inventory/list-items";

const COLS = sql.raw(
  `restaurant_id, created_at, created_by, updated_at, updated_by, version, type, subgroup_id, stock_unit_id,
   purchase_unit_label, purchase_factor, active`,
);

describe("lista de itens com 2.000 itens (SC-005)", () => {
  it("busca por trecho responde em até 1 s", async () => {
    const env = testEnv();
    const ctx = await newRestaurant(env);
    const sub = await subgroupId(env, ctx, "01", "02");
    const first = await createItem(env.deps, ctx, itemData({ subgroupId: sub }));
    if (!first.ok) throw new Error("createItem");
    // Copia o item 1.999 vezes direto no banco: o objetivo aqui é medir a leitura.
    await ownerTestDb().execute(sql`
      insert into items (id, code, description, description_normalized, ${COLS})
      select gen_random_uuid(), '01.02.' || lpad((n + 1)::text, 4, '0'),
             'Produto de teste ' || n, 'produto de teste ' || n, ${COLS}
      from items, generate_series(1, 1999) as n
      where items.id = ${first.value.id}`);

    const started = performance.now();
    const r = await listItems(env.deps, ctx, { q: "teste 19", page: 1 });
    const elapsed = performance.now() - started;
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.total).toBe(111); // 19, 190–199, 1900–1999
    expect(elapsed).toBeLessThan(1000);

    const all = await listItems(env.deps, ctx, { page: 40 });
    expect(all.ok && all.value.total).toBe(2000);
  });
});
