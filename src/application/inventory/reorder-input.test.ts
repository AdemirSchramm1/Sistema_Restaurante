import { describe, it, expect } from "vitest";
import { parseReorderForm } from "./reorder-input";

const ITEM = "0193a000-0000-7000-8000-000000000123";
const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);
const field = (r: { ok: boolean; error?: { field?: string } }) => (r.ok ? undefined : r.error!.field);

describe("formulário do aviso de reposição (spec 006, US1)", () => {
  it("lê os números com vírgula e a versão", () => {
    const r = parseReorderForm({ id: ITEM, version: "3", reorderPoint: "10,5", parLevel: "1.200" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.id).toBe(ITEM);
    expect(r.value.version).toBe(3);
    expect(r.value.levels.reorderPoint?.toString()).toBe("10.5");
    expect(r.value.levels.parLevel?.toString()).toBe("1200");
  });

  it("campos em branco viram vazio (desliga o aviso)", () => {
    const r = parseReorderForm({ id: ITEM, version: "1", reorderPoint: " ", parLevel: "" });
    expect(r.ok && r.value.levels).toEqual({ reorderPoint: null, parLevel: null });
  });

  it("número inválido aponta o campo", () => {
    const r = parseReorderForm({ id: ITEM, version: "1", reorderPoint: "dez", parLevel: "" });
    expect(code(r)).toBe("INVALID_NUMBER");
    expect(field(r)).toBe("reorderPoint");
    expect(field(parseReorderForm({ id: ITEM, version: "1", reorderPoint: "1", parLevel: "x" }))).toBe(
      "parLevel",
    );
  });

  it("id ou versão inválidos", () => {
    expect(code(parseReorderForm({ id: "x", version: "1", reorderPoint: "1" }))).toBe("VALIDATION");
    expect(code(parseReorderForm({ id: ITEM, version: "a", reorderPoint: "1" }))).toBe("VALIDATION");
  });
});
