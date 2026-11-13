import { describe, expect, it } from "vitest";
import { cleanDescription, descriptionLength, MAX_DESCRIPTION } from "./description";

describe("descrição do produto (docs/produto/pedidos/06-editar-o-cardapio.md#descrição)", () => {
  it("tira os espaços do começo e do fim", () => {
    expect(cleanDescription("  Pão brioche e carne  \n")).toEqual({ ok: true, value: "Pão brioche e carne" });
  });

  it("mantém as quebras de linha do meio e uniformiza as do Windows", () => {
    expect(cleanDescription("Pão brioche\r\nCarne 150 g\n\nMolho")).toEqual({
      ok: true,
      value: "Pão brioche\nCarne 150 g\n\nMolho",
    });
  });

  it("vazia, só espaços, nula ou ausente vira sem descrição", () => {
    for (const text of ["", "   \n ", null, undefined])
      expect(cleanDescription(text)).toEqual({ ok: true, value: null });
  });

  it("aceita 300 caracteres e recusa 301 com INVALID_DESCRIPTION no campo", () => {
    expect(MAX_DESCRIPTION).toBe(300);
    expect(cleanDescription("a".repeat(300))).toEqual({ ok: true, value: "a".repeat(300) });
    expect(cleanDescription("a".repeat(301))).toEqual({
      ok: false,
      error: { code: "INVALID_DESCRIPTION", field: "description", details: { max: 300 } },
    });
  });

  it("conta depois de tirar os espaços das pontas", () => {
    expect(cleanDescription(`  ${"a".repeat(300)}  `).ok).toBe(true);
  });

  it("conta letra com acento e emoji como um caractere, como o banco", () => {
    expect(descriptionLength("pão")).toBe(3);
    expect(descriptionLength("🍔")).toBe(1);
    expect(descriptionLength("a\r\nb")).toBe(3);
    expect(cleanDescription("🍔".repeat(300)).ok).toBe(true);
    expect(cleanDescription("🍔".repeat(301)).ok).toBe(false);
  });

  it("marcação fica como texto, sem mudar nada", () => {
    const text = '<b>Novo!</b> <a href="https://x.test">veja</a> <script>alert(1)</script>';
    expect(cleanDescription(text)).toEqual({ ok: true, value: text });
  });
});
