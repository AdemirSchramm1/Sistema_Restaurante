import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";
import { code, scan, tablet, tableWithQr, unwrap } from "./fixtures";
import { bindTablet, openMenuAccess, tabletStatus } from "../../../src/application/ordering/menu-access";
import { getMenu, listAccessOrders } from "../../../src/application/ordering/menu";
import { releaseTablet } from "../../../src/application/ordering/tablets";

/** Casos de borda do acesso ao cardápio pelo QR code e pelo tablet (specs 009 e 016). */
const noOrigin = { ip: null, userAgent: null };

describe("acesso ao cardápio: bordas", () => {
  it("token vazio: QR code NOT_FOUND e tablet INVALID", async () => {
    const env = testEnv();
    expect(
      code(await openMenuAccess(env.deps, { qrToken: "", previousCookie: null, origin: noOrigin })),
    ).toBe("NOT_FOUND");
    expect(await bindTablet(env.deps, { tabletToken: "", cookie: null, origin: noOrigin })).toEqual({
      kind: "INVALID",
    });
  });

  it("sem IP e sem navegador abre do mesmo jeito; ler o QR code no tablet não encerra o tablet", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t = await tableWithQr(env, m, "3");
    const tab = await tablet(env, m, t.tableId);
    // O cookie anterior é o do tablet (ou um desconhecido): nada é encerrado.
    for (const previousCookie of [tab, "desconhecido"])
      unwrap(await openMenuAccess(env.deps, { qrToken: t.token, previousCookie, origin: noOrigin }));
    expect(code(await getMenu(env.deps, { qr: null, tablet: tab }))).toBe("OK");
  });

  it("ligar sem IP; cookie do celular ou de tablet liberado não reaproveita: liga um acesso novo", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const t = await tableWithQr(env, m, "3");
    const phone = await scan(env, t.token);
    const first = await tablet(env, m, t.tableId);
    unwrap(await releaseTablet(env.deps, m, { tableId: t.tableId }));
    const link = (
      await ownerTestDb().execute<{ t: string }>(
        sql`select tablet_token as t from dining_tables where id = ${t.tableId}`,
      )
    ).rows[0]!.t;
    const again = await bindTablet(env.deps, { tabletToken: link, cookie: first, origin: noOrigin });
    expect(again.kind).toBe("BOUND");
    expect(again.kind === "BOUND" && again.cookie).not.toBe(first);
    unwrap(await releaseTablet(env.deps, m, { tableId: t.tableId }));
    const fromPhone = await bindTablet(env.deps, { tabletToken: link, cookie: phone, origin: noOrigin });
    expect(fromPhone.kind === "BOUND" && fromPhone.cookie).not.toBe(phone);
  });

  it("acesso que a busca acha mas o restaurante não tem: ACCESS_EXPIRED e sinal desconhecido", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const deps = {
      ...env.deps,
      global: {
        ...env.deps.global,
        menuAccessByTokenHash: async () => ({
          restaurantId: m.restaurantId,
          menuAccessId: crypto.randomUUID(),
          kind: "TABLET" as const,
        }),
      },
    };
    expect(code(await getMenu(deps, "x"))).toBe("ACCESS_EXPIRED");
    expect(code(await listAccessOrders(deps, "x"))).toBe("ACCESS_EXPIRED");
    expect(await tabletStatus(deps, "x")).toBeNull();
  });
});
