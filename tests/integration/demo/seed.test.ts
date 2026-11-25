import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { ownerTestDb, testEnv, type TestEnv } from "../harness";
import { seedDemoRestaurant, type DemoArtist, type SeedClock } from "../../../src/application/demo/seed";
import {
  DEMO_DISHES,
  DEMO_ITEMS,
  DEMO_OWNER,
  DEMO_PASSWORD,
  DEMO_RESTAURANT_NAME,
  DEMO_STAFF,
  DEMO_SUPPLIERS,
  DEMO_TABLES,
} from "../../../src/application/demo/catalog";
import { signUpRestaurant } from "../../../src/application/access/sign-up-restaurant";

/**
 * Spec 017: `pnpm db:seed` povoa o banco com um restaurante de exemplo, pelos casos de uso do app.
 * Quarta-feira 25/11/2026 às 20:00 em Brasília, com 3 dias de histórico: domingo (só almoço),
 * segunda (fechado), terça (almoço e jantar) e hoje até agora (caixa aberto e mesas ocupadas).
 */
const NOW = new Date("2026-11-25T23:00:00Z");
const db = () => ownerTestDb().$client;
const count = async (sql: string, params: unknown[] = []) =>
  (await db().query<{ n: string }>(sql, params)).rows[0]!.n;

let photo: Uint8Array;
beforeAll(async () => {
  photo = new Uint8Array(
    await sharp({ create: { width: 1920, height: 1440, channels: 3, background: "#c06000" } })
      .jpeg()
      .toBuffer(),
  );
});

const artist = (): DemoArtist => ({
  product: async () => photo,
  logo: async () => photo,
  cover: async () => photo,
});

function seedEnv(env: TestEnv): { deps: TestEnv["deps"]; clock: SeedClock; artist: DemoArtist } {
  const clock: SeedClock = {
    now: () => env.clock.now(),
    set: (at) => {
      env.clock.current = new Date(at);
    },
  };
  return { deps: env.deps, clock, artist: artist() };
}

describe("povoamento com restaurante de exemplo (spec 017)", () => {
  it("cria o restaurante com equipe, estoque, cardápio, mesas e dias de movimento", async () => {
    const env = testEnv();
    const r = await seedDemoRestaurant(seedEnv(env), { account: { kind: "new" }, days: 3, now: NOW });
    expect(r.status).toBe("CREATED");
    if (r.status !== "CREATED") return;
    expect(r.restaurantName).toBe(DEMO_RESTAURANT_NAME);
    expect(r.owner).toEqual({ name: DEMO_OWNER.name, email: DEMO_OWNER.email, password: DEMO_PASSWORD });
    expect(r.staff.map((s) => s.email)).toEqual(DEMO_STAFF.map((s) => `${s.local}@sabordaserra.com.br`));
    const rid = r.restaurantId;

    // Equipe: o dono gerente e os convidados, cada um com os seus papéis e login.
    expect(await count("select count(*) n from memberships where restaurant_id = $1 and active", [rid])).toBe(
      String(DEMO_STAFF.length + 1),
    );
    const roles = await db().query<{ email: string; role: string }>(
      `select u.email, mr.role from membership_roles mr join memberships m on m.id = mr.membership_id
       join users u on u.id = m.user_id where m.restaurant_id = $1 order by u.email, mr.role`,
      [rid],
    );
    expect(roles.rows).toContainEqual({ email: "caixa@sabordaserra.com.br", role: "CASHIER" });
    expect(roles.rows).toContainEqual({ email: "estoque@sabordaserra.com.br", role: "BUYER" });
    expect(roles.rows).toContainEqual({ email: DEMO_OWNER.email, role: "MANAGER" });

    // Estoque: itens com aviso de reposição, fornecedores com preço de cada item, saldo nunca negativo.
    expect(
      await count("select count(*) n from items where restaurant_id = $1 and reorder_point is not null", [
        rid,
      ]),
    ).toBe(String(DEMO_ITEMS.length));
    expect(await count("select count(*) n from suppliers where restaurant_id = $1", [rid])).toBe(
      String(DEMO_SUPPLIERS.length),
    );
    expect(await count("select count(*) n from supplier_items where restaurant_id = $1", [rid])).toBe(
      String(DEMO_ITEMS.length),
    );
    expect(
      await count("select count(*) n from stock_balances where restaurant_id = $1 and quantity < 0", [rid]),
    ).toBe("0");
    const movementTypes = await db().query<{ type: string }>(
      "select distinct type::text as type from stock_movements where restaurant_id = $1 order by 1",
      [rid],
    );
    expect(movementTypes.rows.map((m) => m.type)).toEqual(["ADJUSTMENT", "LOSS", "PURCHASE", "SALE_RECIPE"]);

    // Cardápio: todo produto com preço, seção, descrição e foto; logo e capa.
    const dishes = await db().query<{ n: string; priced: string; placed: string; photos: string }>(
      `select count(*) n, count(sale_price) priced, count(menu_section_id) placed, count(photo_base) photos
       from recipes where restaurant_id = $1 and kind = 'DISH'`,
      [rid],
    );
    const all = String(DEMO_DISHES.length);
    expect(dishes.rows[0]).toEqual({ n: all, priced: all, placed: all, photos: all });
    expect(
      await count(
        "select count(*) n from restaurants where id = $1 and logo_base is not null and cover_base is not null",
        [rid],
      ),
    ).toBe("1");
    expect(
      await count("select count(*) n from dining_tables where restaurant_id = $1 and active", [rid]),
    ).toBe(String(DEMO_TABLES));

    // Movimento: domingo e terça com caixa fechado; segunda fechado; hoje com caixa aberto.
    const sessions = await db().query<{ business_day: string; closed: boolean }>(
      `select to_char(business_day, 'YYYY-MM-DD') business_day, closed_at is not null closed
       from cash_sessions where restaurant_id = $1 order by business_day`,
      [rid],
    );
    expect(sessions.rows).toEqual([
      { business_day: "2026-11-22", closed: true },
      { business_day: "2026-11-24", closed: true },
      { business_day: "2026-11-25", closed: false },
    ]);
    expect(
      Number(
        await count("select count(*) n from table_tabs where restaurant_id = $1 and status = 'CLOSED'", [
          rid,
        ]),
      ),
    ).toBeGreaterThan(30);
    expect(
      await count(
        `select count(*) n from orders where restaurant_id = $1 and status not in ('DELIVERED', 'CANCELLED')
         and business_day < '2026-11-25'`,
        [rid],
      ),
    ).toBe("0");
    // Agora: mesas ocupadas, com pedido ainda na cozinha.
    expect(
      Number(
        await count("select count(*) n from table_tabs where restaurant_id = $1 and status = 'OPEN'", [rid]),
      ),
    ).toBeGreaterThanOrEqual(2);
    expect(
      Number(
        await count(
          "select count(*) n from orders where restaurant_id = $1 and status in ('RECEIVED', 'PREPARING', 'READY')",
          [rid],
        ),
      ),
    ).toBeGreaterThanOrEqual(2);
    expect(
      await count("select count(*) n from orders where restaurant_id = $1 and submitted_at > $2", [rid, NOW]),
    ).toBe("0");
  });

  it("rodar de novo não duplica nada", async () => {
    const env = testEnv();
    const first = await seedDemoRestaurant(seedEnv(env), { account: { kind: "new" }, days: 1, now: NOW });
    expect(first.status).toBe("CREATED");
    const orders = await count("select count(*) n from orders");
    const again = await seedDemoRestaurant(seedEnv(env), { account: { kind: "new" }, days: 1, now: NOW });
    expect(again).toMatchObject({ status: "ALREADY_SEEDED", restaurantName: DEMO_RESTAURANT_NAME });
    expect(await count("select count(*) n from orders")).toBe(orders);
    expect(await count("select count(*) n from restaurants")).toBe("1");
  });

  it("povoa o restaurante de uma conta que já existe, pelo e-mail do dono", async () => {
    const env = testEnv();
    const signed = await signUpRestaurant(
      env.deps,
      {
        restaurantName: "Meu Restaurante",
        userName: "Teste",
        email: "teste@teste.com",
        password: "12345678",
      },
      { channel: "test" },
    );
    expect(signed.ok).toBe(true);
    const r = await seedDemoRestaurant(seedEnv(env), {
      account: { kind: "existing", email: "Teste@teste.com" },
      days: 1,
      now: NOW,
    });
    expect(r).toMatchObject({
      status: "CREATED",
      restaurantName: "Meu Restaurante",
      owner: { email: "teste@teste.com", password: null },
    });
    if (r.status !== "CREATED") return;
    expect(r.staff.map((s) => s.email)).toContain("garcom@teste.com");
    expect(await count("select count(*) n from restaurants")).toBe("1");
    expect(await count("select count(*) n from recipes where kind = 'DISH'")).toBe(
      String(DEMO_DISHES.length),
    );
  });

  it("conta que não existe, ou restaurante já em uso, não recebe nada", async () => {
    const env = testEnv();
    const missing = await seedDemoRestaurant(seedEnv(env), {
      account: { kind: "existing", email: "ninguem@teste.com" },
      days: 1,
      now: NOW,
    });
    expect(missing).toEqual({ status: "ACCOUNT_NOT_FOUND", email: "ninguem@teste.com" });
    expect(await count("select count(*) n from restaurants")).toBe("0");
  });
});
