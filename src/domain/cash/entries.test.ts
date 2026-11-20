import { describe, it, expect } from "vitest";
import { d } from "../shared/decimal";
import {
  ENTRY_KIND_LABELS,
  WITHDRAWAL_REASONS,
  WITHDRAWAL_REASON_LABELS,
  checkSupply,
  checkSupplyRemoval,
  checkWithdrawal,
  isEntryKind,
  isWithdrawalReason,
} from "./entries";

const code = (r: { ok: boolean; error?: { code: string; field?: string } }) =>
  r.ok ? "OK" : `${r.error!.code}${r.error!.field ? `:${r.error!.field}` : ""}`;
const withdraw = (
  amount: string,
  reason: unknown = "SAFE",
  note: string | null = null,
  expected = "227.00",
) => checkWithdrawal({ amount: d(amount), reason, note }, d(expected));

describe("sangria (spec 014, FR-003)", () => {
  it("motivos da lista fechada, com os textos da tela", () => {
    expect([...WITHDRAWAL_REASONS]).toEqual(["SAFE", "SUPPLIER_PAYMENT", "DAILY_EXPENSE", "OTHER"]);
    expect(WITHDRAWAL_REASONS.map((r) => WITHDRAWAL_REASON_LABELS[r])).toEqual([
      "Cofre",
      "Pagamento a fornecedor",
      "Despesa do dia",
      "Outro",
    ]);
    expect([isWithdrawalReason("SAFE"), isWithdrawalReason("BANK")]).toEqual([true, false]);
    expect(ENTRY_KIND_LABELS).toEqual({ WITHDRAWAL: "Sangria", SUPPLY: "Reforço" });
    expect([isEntryKind("SUPPLY"), isEntryKind("OTHER")]).toEqual([true, false]);
  });

  it("pode tirar tudo o que a gaveta deve ter, e nem um centavo a mais", () => {
    const all = withdraw("227.00");
    expect(all.ok && [all.value.amount.toFixed(2), all.value.reason, all.value.note]).toEqual([
      "227.00",
      "SAFE",
      null,
    ]);
    const over = withdraw("227.01");
    expect(code(over)).toBe("WITHDRAWAL_EXCEEDS_EXPECTED:amount");
    expect(!over.ok && over.error.details).toEqual({ expected: "227.00" });
  });

  it("valor zero, negativo ou com 3 casas é recusado", () => {
    expect(code(withdraw("0"))).toBe("INVALID_AMOUNT:amount");
    expect(code(withdraw("-5"))).toBe("INVALID_AMOUNT:amount");
    expect(code(withdraw("1.005"))).toBe("INVALID_AMOUNT:amount");
  });

  it("sem motivo, ou com motivo fora da lista, é recusada", () => {
    expect(code(withdraw("10.00", null))).toBe("REASON_REQUIRED:reason");
    expect(code(withdraw("10.00", "BANK"))).toBe("REASON_REQUIRED:reason");
  });

  it("motivo Outro pede a observação; os demais não", () => {
    const missing = withdraw("10.00", "OTHER");
    expect(code(missing)).toBe("NOTE_REQUIRED:note");
    expect(!missing.ok && missing.error.details).toEqual({ reason: "other" });
    expect(code(withdraw("10.00", "OTHER", "  "))).toBe("NOTE_REQUIRED:note");
    const r = withdraw("10.00", "OTHER", " Gelo ");
    expect(r.ok && r.value.note).toBe("Gelo");
    expect(code(withdraw("10.00", "DAILY_EXPENSE"))).toBe("OK");
  });

  it("observação com mais de 140 letras é recusada", () => {
    expect(code(withdraw("10.00", "SAFE", "a".repeat(141)))).toBe("NOTE_TOO_LONG:note");
    expect(code(withdraw("10.00", "SAFE", "a".repeat(140)))).toBe("OK");
  });
});

describe("reforço (spec 014, FR-003)", () => {
  it("valor maior que zero com até 2 casas; observação opcional de até 140 letras", () => {
    const r = checkSupply({ amount: d("50.00"), note: " Troco do cofre " });
    expect(r.ok && [r.value.amount.toFixed(2), r.value.note]).toEqual(["50.00", "Troco do cofre"]);
    const bare = checkSupply({ amount: d("0.01"), note: null });
    expect(bare.ok && bare.value.note).toBeNull();
    expect(code(checkSupply({ amount: d("0"), note: null }))).toBe("INVALID_AMOUNT:amount");
    expect(code(checkSupply({ amount: d("1.001"), note: null }))).toBe("INVALID_AMOUNT:amount");
    expect(code(checkSupply({ amount: d("1"), note: "a".repeat(141) }))).toBe("NOTE_TOO_LONG:note");
  });

  it("tirar um reforço não pode deixar o esperado negativo", () => {
    expect(code(checkSupplyRemoval(d("50.00"), d("127.00")))).toBe("OK");
    expect(code(checkSupplyRemoval(d("50.00"), d("50.00")))).toBe("OK");
    expect(code(checkSupplyRemoval(d("50.00"), d("30.00")))).toBe("EXPECTED_WOULD_BE_NEGATIVE");
  });
});
