import { describe, it, expect } from "vitest";
import { can, assertCan, ACTIONS, type Role } from "./permissions";

describe("matriz de permissões (spec 001, FR-003)", () => {
  it("gerente pode tudo", () => {
    for (const action of ACTIONS) expect(can(["MANAGER"], action), action).toBe(true);
  });

  it("chef consulta e escreve itens e produtos (spec 003, FR-006)", () => {
    const allowed = ACTIONS.filter((a) => can(["CHEF"], a));
    expect(allowed.sort()).toEqual(["catalog.read", "item.write", "recipe.write"]);
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
    const r = assertCan(["CHEF"], "group.manage");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
    expect(assertCan(["MANAGER"], "group.manage").ok).toBe(true);
  });

  it("não existe mais permissão de locais (spec 002, US3)", () => {
    expect(ACTIONS).not.toContain("location.manage" as never);
    expect(ACTIONS).not.toContain("item_location.manage" as never);
  });
});
