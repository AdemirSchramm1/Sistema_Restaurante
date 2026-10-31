import { describe, it, expect } from "vitest";
import { can, assertCan, ACTIONS, type Role } from "./permissions";

describe("matriz de permissões (spec 001, FR-003)", () => {
  it("gerente pode tudo", () => {
    for (const action of ACTIONS) expect(can(["MANAGER"], action), action).toBe(true);
  });

  it("chef só consulta e escreve itens", () => {
    const allowed = ACTIONS.filter((a) => can(["CHEF"], a));
    expect(allowed.sort()).toEqual(["catalog.read", "item.write"]);
  });

  it.each<Role>(["STOCKKEEPER", "BUYER", "ADMINISTRATIVE"])("%s só consulta", (role) => {
    expect(ACTIONS.filter((a) => can([role], a))).toEqual(["catalog.read"]);
  });

  it("usuário com vários papéis soma as permissões", () => {
    expect(can(["STOCKKEEPER", "CHEF"], "item.write")).toBe(true);
  });

  it("sem papel não pode nada", () => {
    expect(ACTIONS.some((a) => can([], a))).toBe(false);
  });

  it("assertCan devolve FORBIDDEN quando não pode", () => {
    const r = assertCan(["CHEF"], "location.manage");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
    expect(assertCan(["MANAGER"], "location.manage").ok).toBe(true);
  });
});
