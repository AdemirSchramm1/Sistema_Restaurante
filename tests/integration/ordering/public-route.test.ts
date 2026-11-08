import { describe, it, expect } from "vitest";
import { newRestaurant, ownerTestDb, testEnv } from "../harness";
import { tableWithQr } from "./fixtures";
import { qrScanResponse } from "../../../src/actions/_qr-scan";

const request = { cookie: null, ip: "203.0.113.7", userAgent: "Celular" };

describe("rota pública GET /m/{token} (spec 009, contracts/public-routes.md)", () => {
  it("abre o acesso, grava o cookie e manda para o cardápio", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const { token } = await tableWithQr(env, m, "5");
    const res = await qrScanResponse(env.deps, { ...request, token });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/cardapio");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^menu_access=[A-Za-z0-9_-]{43}; /);
    for (const part of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/cardapio", "Max-Age=1200"])
      expect(cookie).toContain(part);
    const n = await ownerTestDb().$client.query("select count(*)::int as n from menu_accesses where restaurant_id = $1", [
      m.restaurantId,
    ]);
    expect(n.rows[0].n).toBe(1);
  });

  it("token desconhecido: 404 com 'QR code inválido. Chame um garçom.'", async () => {
    const env = testEnv();
    const res = await qrScanResponse(env.deps, { ...request, token: "nao-existe" });
    expect(res.status).toBe(404);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toContain("QR code inválido. Chame um garçom.");
  });

  it("chave desligada: mostra a mensagem sem criar acesso", async () => {
    const env = testEnv();
    const m = await newRestaurant(env);
    const { token } = await tableWithQr(env, m, "5");
    await ownerTestDb().$client.query("update restaurants set accepting_qr_orders = false where id = $1", [
      m.restaurantId,
    ]);
    const res = await qrScanResponse(env.deps, { ...request, token });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await res.text()).toContain("O restaurante não está recebendo pedidos agora. Chame um garçom.");
  });
});
