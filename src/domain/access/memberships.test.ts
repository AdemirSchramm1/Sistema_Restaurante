import { describe, expect, it } from "vitest";
import { assertKeepsManager, validateRoles } from "./memberships";

const m = (id: string, roles: ("MANAGER" | "CHEF")[], active = true) => ({ membershipId: id, roles, active });

describe("assertKeepsManager", () => {
  it("recusa tirar MANAGER do único gerente ativo", () => {
    const r = assertKeepsManager([m("a", ["MANAGER"]), m("b", ["CHEF"])], {
      membershipId: "a",
      roles: ["CHEF"],
      active: true,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "LAST_MANAGER" } });
  });

  it("recusa desativar o único gerente ativo", () => {
    const r = assertKeepsManager([m("a", ["MANAGER"])], {
      membershipId: "a",
      roles: ["MANAGER"],
      active: false,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "LAST_MANAGER" } });
  });

  it("gerente inativo não conta", () => {
    const r = assertKeepsManager([m("a", ["MANAGER"]), m("b", ["MANAGER"], false)], {
      membershipId: "a",
      roles: ["CHEF"],
      active: true,
    });
    expect(r.ok).toBe(false);
  });

  it("com dois gerentes ativos, tudo bem", () => {
    const r = assertKeepsManager([m("a", ["MANAGER"]), m("b", ["MANAGER"])], {
      membershipId: "a",
      roles: ["CHEF"],
      active: false,
    });
    expect(r.ok).toBe(true);
  });
});

describe("validateRoles", () => {
  it("exige ao menos um papel conhecido e sem repetição", () => {
    expect(validateRoles([]).ok).toBe(false);
    expect(validateRoles(["CHEF", "XYZ"]).ok).toBe(false);
    expect(validateRoles(["CHEF", "CHEF"])).toMatchObject({ ok: true, value: ["CHEF"] });
  });
});
