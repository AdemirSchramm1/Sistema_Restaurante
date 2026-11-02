import { describe, it, expect } from "vitest";
import { parseMovementDate, parseMovementForm } from "./movement-input";

const ITEM = "0193a000-0000-7000-8000-000000000123";
const REASON = "0193a100-0000-7000-8000-000000000003";
const NOW = new Date("2026-11-02T15:00:00Z");

const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);
const field = (r: { ok: boolean; error?: { field?: string } }) => (r.ok ? undefined : r.error!.field);

describe("data do lançamento (fuso de São Paulo)", () => {
  it("hoje vira agora; outro dia vira meio-dia daquele dia", () => {
    expect(parseMovementDate("2026-11-02", NOW)).toEqual(NOW);
    expect(parseMovementDate("2026-10-30", NOW)?.toISOString()).toBe("2026-10-30T15:00:00.000Z");
    expect(parseMovementDate("", NOW)).toEqual(NOW);
    expect(parseMovementDate("30/10/2026", NOW)).toBeNull();
  });
});

describe("formulário de lançamento (spec 004)", () => {
  it("compra em embalagens com valor em reais", () => {
    const r = parseMovementForm(
      {
        type: "PURCHASE",
        itemId: ITEM,
        quantity: "3",
        unit: "PACKAGE",
        totalPaid: "1.240,50",
        occurredAt: "2026-11-02",
        notes: " Ceasa ",
        idempotencyKey: "k1",
      },
      NOW,
    );
    expect(r.ok).toBe(true);
    if (!r.ok || r.value.type !== "PURCHASE") return;
    expect([
      r.value.cmd.quantity.toString(),
      r.value.cmd.unit,
      r.value.cmd.totalPaid.toString(),
      r.value.cmd.notes,
    ]).toEqual(["3", "PACKAGE", "1240.5", "Ceasa"]);
    expect(r.value.cmd.idempotencyKey).toBe("k1");
  });

  it("perda pede motivo", () => {
    const ok = parseMovementForm(
      { type: "LOSS", itemId: ITEM, quantity: "500", unit: "g", reasonId: REASON, idempotencyKey: "k" },
      NOW,
    );
    expect(code(ok)).toBe("OK");
    const missing = parseMovementForm(
      { type: "LOSS", itemId: ITEM, quantity: "500", unit: "g", reasonId: "" },
      NOW,
    );
    expect(code(missing)).toBe("INVALID_REASON");
    expect(field(missing)).toBe("reasonId");
  });

  it("acerto lê quanto tem de verdade (zero vale)", () => {
    const r = parseMovementForm(
      { type: "ADJUSTMENT", itemId: ITEM, countedQuantity: "0", unit: "kg", reasonId: REASON },
      NOW,
    );
    expect(r.ok && r.value.type === "ADJUSTMENT" && r.value.cmd.countedQuantity.toString()).toBe("0");
  });

  it("aponta o campo com número inválido, item vazio, data inválida e tipo desconhecido", () => {
    expect(
      field(
        parseMovementForm(
          { type: "PURCHASE", itemId: ITEM, quantity: "abc", unit: "kg", totalPaid: "1" },
          NOW,
        ),
      ),
    ).toBe("quantity");
    expect(
      field(
        parseMovementForm({ type: "PURCHASE", itemId: ITEM, quantity: "1", unit: "kg", totalPaid: "x" }, NOW),
      ),
    ).toBe("totalPaid");
    expect(
      field(
        parseMovementForm({ type: "PURCHASE", itemId: "", quantity: "1", unit: "kg", totalPaid: "1" }, NOW),
      ),
    ).toBe("itemId");
    expect(
      field(
        parseMovementForm(
          { type: "PURCHASE", itemId: ITEM, quantity: "1", unit: "kg", totalPaid: "1", occurredAt: "ontem" },
          NOW,
        ),
      ),
    ).toBe("occurredAt");
    expect(code(parseMovementForm({ type: "SALE", itemId: ITEM }, NOW))).toBe("VALIDATION");
    expect(
      field(
        parseMovementForm(
          { type: "LOSS", itemId: ITEM, quantity: "1", unit: "caixa", reasonId: REASON },
          NOW,
        ),
      ),
    ).toBe("unit");
  });
});
