import { describe, expect, it } from "vitest";
import { parseMenuDetails } from "./details-input";

const id = "0193a000-0000-7000-8000-000000000010";
const section = "0193a000-0000-7000-8000-000000000020";
const show = (r: { ok: boolean; error?: { code: string; field?: string } }) =>
  r.ok ? "OK" : `${r.error!.code}:${r.error!.field}`;

describe("formulário de descrição e seção (spec 013, US1)", () => {
  it("lê id, version, descrição como veio e a seção", () => {
    expect(parseMenuDetails({ id, version: "2", description: " Pão\ncarne ", sectionId: section })).toEqual({
      ok: true,
      value: { id, version: 2, description: " Pão\ncarne ", sectionId: section },
    });
  });

  it("seção em branco é Outros; descrição ausente é vazia", () => {
    expect(parseMenuDetails({ id, version: "2", sectionId: "" })).toEqual({
      ok: true,
      value: { id, version: 2, description: "", sectionId: null },
    });
    expect(parseMenuDetails({ id, version: "2" })).toMatchObject({ value: { sectionId: null } });
  });

  it("aponta o campo com problema", () => {
    expect(show(parseMenuDetails({ id: "x", version: "2" }))).toBe("VALIDATION:id");
    expect(show(parseMenuDetails({ id, version: "zero" }))).toBe("VALIDATION:version");
    expect(show(parseMenuDetails({ id, version: "2", sectionId: "lanches" }))).toBe("VALIDATION:sectionId");
  });
});
