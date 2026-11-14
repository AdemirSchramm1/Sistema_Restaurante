import { describe, expect, it } from "vitest";
import { parseMove, parseSectionCreate, parseSectionRename, parseTarget } from "./section-input";

const id = "0193a000-0000-7000-8000-000000000010";
const show = (r: { ok: boolean; error?: { code: string; field?: string } }) =>
  r.ok ? "OK" : `${r.error!.code}:${r.error!.field}`;

describe("formulários da tela Cardápio (spec 013, US2 e US3)", () => {
  it("criar seção lê o nome como veio (a regra do nome é do domínio)", () => {
    expect(parseSectionCreate({ name: " Lanches " })).toEqual({ ok: true, value: { name: " Lanches " } });
    expect(parseSectionCreate({})).toEqual({ ok: true, value: { name: "" } });
    expect(parseSectionCreate({ name: 12 })).toEqual({ ok: true, value: { name: "" } });
  });

  it("renomear lê id, version e nome", () => {
    expect(parseSectionRename({ id, version: "3", name: "Bebidas" })).toEqual({
      ok: true,
      value: { id, version: 3, name: "Bebidas" },
    });
    expect(show(parseSectionRename({ id: "abc", version: "3", name: "x" }))).toBe("VALIDATION:id");
    expect(show(parseSectionRename({ id, version: "", name: "x" }))).toBe("VALIDATION:version");
    expect(show(parseSectionRename({ id, version: "1.5", name: "x" }))).toBe("VALIDATION:version");
    expect(show(parseSectionRename({ id, version: "0", name: "x" }))).toBe("VALIDATION:version");
    expect(show(parseSectionRename({ id, version: "abc", name: "x" }))).toBe("VALIDATION:version");
  });

  it("subir e descer leem id e direção; direção fora de up e down é recusada", () => {
    expect(parseMove({ id, direction: "up" })).toEqual({ ok: true, value: { id, direction: "up" } });
    expect(parseMove({ id, direction: "down" })).toEqual({ ok: true, value: { id, direction: "down" } });
    expect(show(parseMove({ id, direction: "left" }))).toBe("VALIDATION:direction");
    expect(show(parseMove({ id }))).toBe("VALIDATION:direction");
    expect(show(parseMove({ id: "x", direction: "up" }))).toBe("VALIDATION:id");
  });

  it("apagar lê só o id", () => {
    expect(parseTarget({ id })).toEqual({ ok: true, value: { id } });
    expect(show(parseTarget({ id: "../x" }))).toBe("VALIDATION:id");
    expect(show(parseTarget({}))).toBe("VALIDATION:id");
  });
});
