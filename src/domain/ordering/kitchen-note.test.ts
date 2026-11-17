import { describe, expect, it } from "vitest";
import { KITCHEN_NOTE_MAX, checkKitchenNote } from "./kitchen-note";

describe("observação para a cozinha (spec 015, FR-018)", () => {
  it("até 140 letras, aparando os espaços", () => {
    expect(KITCHEN_NOTE_MAX).toBe(140);
    const r = checkKitchenNote("  mal passado ");
    expect(r).toEqual({ ok: true, value: "mal passado" });
    expect(checkKitchenNote("a".repeat(140)).ok).toBe(true);
  });

  it("vazio ou nulo vira sem observação", () => {
    expect(checkKitchenNote("")).toEqual({ ok: true, value: null });
    expect(checkKitchenNote("   ")).toEqual({ ok: true, value: null });
    expect(checkKitchenNote(null)).toEqual({ ok: true, value: null });
  });

  it("141 letras é recusado; acento conta uma letra", () => {
    const r = checkKitchenNote("a".repeat(141));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toEqual({ code: "NOTE_TOO_LONG", field: "kitchenNote" });
    expect(checkKitchenNote("ç".repeat(140)).ok).toBe(true);
  });
});
