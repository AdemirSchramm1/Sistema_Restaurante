import { describe, it, expect } from "vitest";
import { checkServiceRate, DEFAULT_SERVICE_RATE, serviceCharge } from "./service-charge";
import { d } from "../shared/decimal";

const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);

describe("taxa de serviço (spec 011, FR-002 e FR-014)", () => {
  it("é o subtotal vezes a porcentagem, em centavos", () => {
    expect(serviceCharge(d("68.00"), d("10"), false).toFixed(2)).toBe("6.80");
    expect(serviceCharge(d("77.00"), d("10"), false).toFixed(2)).toBe("7.70");
  });

  it("meio centavo arredonda para cima; menos que meio, para baixo", () => {
    expect(serviceCharge(d("33.35"), d("10"), false).toFixed(2)).toBe("3.34");
    expect(serviceCharge(d("33.34"), d("10"), false).toFixed(2)).toBe("3.33");
    expect(serviceCharge(d("10.05"), d("12.5"), false).toFixed(2)).toBe("1.26");
  });

  it("taxa desligada no restaurante ou tirada da conta: R$ 0,00", () => {
    expect(serviceCharge(d("68.00"), null, false).toFixed(2)).toBe("0.00");
    expect(serviceCharge(d("68.00"), d("10"), true).toFixed(2)).toBe("0.00");
  });

  it("restaurante começa com 10%", () => {
    expect(DEFAULT_SERVICE_RATE.toString()).toBe("10");
  });

  it("porcentagem de 0 a 20, com até 2 casas; vazia desliga a taxa", () => {
    for (const ok of ["0", "10", "12.5", "12.25", "20"]) expect(code(checkServiceRate(d(ok))), ok).toBe("OK");
    expect(code(checkServiceRate(null))).toBe("OK");
    for (const bad of ["20.01", "-1", "10.005", "100"])
      expect(code(checkServiceRate(d(bad))), bad).toBe("INVALID_RATE");
    const r = checkServiceRate(d("21"));
    if (!r.ok) expect(r.error.field).toBe("serviceChargeRate");
    expect(r.ok).toBe(false);
  });
});
