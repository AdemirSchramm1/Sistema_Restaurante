import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";
import { tableWithQr, unwrap } from "./fixtures";
import { createTabletLink, releaseTablet, rotateTabletLink } from "../../../src/application/ordering/tablets";
import { tabletBindResponse } from "../../../src/actions/_tablet";

/** Rota `GET /t/{token}`: liga o tablet da mesa (spec 016, US4; research R2, R3). */
const request = { cookie: null, ip: "203.0.113.9", userAgent: "Tablet", secure: true };
const tokenOf = async (tableId: string) =>
  (
    await ownerTestDb().execute<{ tablet_token: string }>(
      sql`select tablet_token from dining_tables where id = ${tableId}`,
    )
  ).rows[0]!.tablet_token;
const cookieValue = (res: Response) => /^menu_tablet=([^;]+);/.exec(res.headers.get("set-cookie") ?? "")?.[1];

async function linked(name = "12") {
  const env = testEnv();
  const m = await newRestaurant(env);
  const t = await tableWithQr(env, m, name);
  unwrap(await createTabletLink(env.deps, m, { tableId: t.tableId, version: 1 }));
  return { env, m, t, token: await tokenOf(t.tableId) };
}

describe("rota GET /t/{token} (spec 016, US4)", () => {
  it("token desconhecido: 404 com 'Link inválido. Chame um garçom.'", async () => {
    const env = testEnv();
    const res = await tabletBindResponse(env.deps, { ...request, token: "nao-existe" });
    expect(res.status).toBe(404);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(await res.text()).toContain("Link inválido. Chame um garçom.");
  });

  it("primeiro aparelho: 303 para /cardapio com o cookie de 400 dias e auditoria sem usuário", async () => {
    const { env, m, token } = await linked();
    const res = await tabletBindResponse(env.deps, { ...request, token });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/cardapio");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^menu_tablet=[A-Za-z0-9_-]{43}; /);
    for (const part of ["Path=/", "Max-Age=34560000", "HttpOnly", "SameSite=Lax", "Secure"])
      expect(cookie).toContain(part);
    const audit = await ownerTestDb().execute<{ user_id: string | null; origin: Record<string, unknown> }>(
      sql`select user_id, origin from audit_log where restaurant_id = ${m.restaurantId}
          and changes = '{"tablet":"bound"}'::jsonb`,
    );
    expect(audit.rows).toHaveLength(1);
    expect(audit.rows[0]!.user_id).toBeNull();
    expect(audit.rows[0]!.origin).toMatchObject({ ip: "203.0.113.9", userAgent: "Tablet" });

    // Sem HTTPS (localhost) o cookie vai sem Secure.
    const again = await tabletBindResponse(env.deps, {
      ...request,
      token,
      cookie: cookieValue(res)!,
      secure: false,
    });
    expect(again.headers.get("set-cookie")).not.toContain("Secure");
  });

  it("o mesmo aparelho de novo recebe o mesmo cookie; outro aparelho recebe a mensagem", async () => {
    const { env, token } = await linked();
    const first = await tabletBindResponse(env.deps, { ...request, token });
    const mine = cookieValue(first)!;
    const again = await tabletBindResponse(env.deps, { ...request, token, cookie: mine });
    expect(again.status).toBe(303);
    expect(cookieValue(again)).toBe(mine);
    const other = await tabletBindResponse(env.deps, { ...request, token });
    expect(other.status).toBe(200);
    expect(other.headers.get("set-cookie")).toBeNull();
    expect(await other.text()).toContain(
      "Este link já está ligado em outro tablet. Peça ao gerente para liberar.",
    );
  });

  it("dois aparelhos ao mesmo tempo: sempre um liga e o outro recebe a mensagem (20 rodadas)", async () => {
    const { env, m, t, token } = await linked();
    for (let round = 0; round < 20; round++) {
      const [a, b] = await Promise.all([
        tabletBindResponse(env.deps, { ...request, token }),
        tabletBindResponse(env.deps, { ...request, token }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 303]);
      unwrap(await releaseTablet(env.deps, m, { tableId: t.tableId }));
    }
  });

  it("depois de Liberar o próximo liga; depois de Trocar link o antigo é inválido", async () => {
    const { env, m, t, token } = await linked();
    await tabletBindResponse(env.deps, { ...request, token });
    unwrap(await releaseTablet(env.deps, m, { tableId: t.tableId }));
    expect((await tabletBindResponse(env.deps, { ...request, token })).status).toBe(303);
    unwrap(await rotateTabletLink(env.deps, m, { tableId: t.tableId, version: 2 }));
    const old = await tabletBindResponse(env.deps, { ...request, token });
    expect(old.status).toBe(404);
    expect(await old.text()).toContain("Link inválido. Chame um garçom.");
    expect((await tabletBindResponse(env.deps, { ...request, token: await tokenOf(t.tableId) })).status).toBe(303);
  });

  it("mesa inativa e chave desligada ligam assim mesmo", async () => {
    const { env, m, t, token } = await linked();
    await ownerTestDb().execute(sql`update dining_tables set active = false where id = ${t.tableId}`);
    await ownerTestDb().execute(
      sql`update restaurants set accepting_qr_orders = false where id = ${m.restaurantId}`,
    );
    expect((await tabletBindResponse(env.deps, { ...request, token })).status).toBe(303);
  });
});
