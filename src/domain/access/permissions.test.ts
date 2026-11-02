import { describe, it, expect } from "vitest";
import { can, assertCan, ACTIONS, type Role } from "./permissions";

describe("matriz de permissões (spec 001, FR-003)", () => {
  it("gerente pode tudo", () => {
    for (const action of ACTIONS) expect(can(["MANAGER"], action), action).toBe(true);
  });

  it("chef consulta, escreve itens e produtos, lança perda e pede acerto (specs 003 e 004)", () => {
    const allowed = ACTIONS.filter((a) => can(["CHEF"], a));
    expect(allowed.sort()).toEqual([
      "adjustment.request",
      "catalog.read",
      "item.write",
      "movement.loss",
      "recipe.write",
    ]);
  });

  it("lançamentos por papel (spec 004, FR-006)", () => {
    const allowed = (role: Role) => ACTIONS.filter((a) => can([role], a)).sort();
    expect(allowed("STOCKKEEPER")).toEqual([
      "adjustment.request",
      "catalog.read",
      "movement.loss",
      "movement.purchase",
    ]);
    expect(allowed("BUYER")).toEqual([
      "adjustment.request",
      "catalog.read",
      "movement.purchase",
      "supplier.write",
    ]);
    expect(allowed("ADMINISTRATIVE")).toEqual(["catalog.read"]);
    expect(can(["MANAGER"], "adjustment.approve")).toBe(true);
    expect(can(["MANAGER"], "movement.reverse")).toBe(true);
    for (const r of ["CHEF", "STOCKKEEPER", "BUYER", "ADMINISTRATIVE"] as Role[]) {
      expect(can([r], "adjustment.approve"), r).toBe(false);
      expect(can([r], "movement.reverse"), r).toBe(false);
    }
  });

  it("fornecedores: só gerente e comprador cadastram (spec 007, FR-006)", () => {
    expect(can(["MANAGER"], "supplier.write")).toBe(true);
    expect(can(["BUYER"], "supplier.write")).toBe(true);
    for (const r of ["CHEF", "STOCKKEEPER", "ADMINISTRATIVE"] as Role[])
      expect(can([r], "supplier.write"), r).toBe(false);
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
