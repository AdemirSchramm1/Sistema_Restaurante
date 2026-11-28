import { describe, expect, it } from "vitest";
import { changeLines, entryLabel, operationLabel, recordHref, recordName, whoDid } from "./entry-labels";

const e = (action: "CREATE" | "UPDATE" | "DEACTIVATE" | "REACTIVATE" | "DENIED", changes = {}) => ({
  action,
  changes,
});

describe("rótulos de um registro da trilha (spec 019, FR-004: um tradutor só)", () => {
  it("ação em português", () => {
    expect(
      (["CREATE", "UPDATE", "DEACTIVATE", "REACTIVATE", "DENIED"] as const).map((a) => entryLabel(e(a))),
    ).toEqual(["Criou", "Alterou", "Inativou", "Reativou", "Tentou sem permissão"]);
  });

  it("mudanças do cardápio dizem o que foi feito", () => {
    expect(entryLabel(e("UPDATE", { event: "menu.details" }))).toBe("Alterou no cardápio");
    expect(entryLabel(e("UPDATE", { event: "menu.section.delete" }))).toBe("Apagou a seção");
    expect(entryLabel(e("UPDATE", { event: "menu.photo.set", photo: [null, "a/b"] }))).toBe(
      "Pôs foto no cardápio",
    );
    expect(entryLabel(e("UPDATE", { event: "menu.photo.set", photo: ["a/b", "c/d"] }))).toBe(
      "Trocou a foto do cardápio",
    );
    expect(entryLabel(e("UPDATE", { event: "outro" }))).toBe("Alterou");
    expect(entryLabel(e("UPDATE", { event: 3 }))).toBe("Alterou");
  });

  it("o que mudou: só antes → depois, sem caminho de arquivo, e só na alteração", () => {
    const changes = { name: ["A", "B"], photo: ["a/b", "c/d"], event: "menu.details", roles: ["x"] };
    expect(changeLines(e("UPDATE", changes))).toEqual(["Nome: A → B"]);
    expect(changeLines(e("CREATE", { name: [null, "A"] }))).toEqual([]);
    expect(changeLines({ action: "UPDATE", changes: null })).toEqual([]);
  });

  it("nome do registro quando está nas mudanças", () => {
    expect(recordName({ name: [null, "Tomate"] })).toBe("Tomate");
    expect(recordName({ name: ["Tomate", null] })).toBe("Tomate");
    expect(recordName({ description: ["Tomate", "Tomate italiano"] })).toBe("Tomate italiano");
    expect(recordName({ name: [null, 3] })).toBeNull();
    expect(recordName({ name: "solto" })).toBeNull();
    expect(recordName({ action: "x" })).toBeNull();
    expect(recordName(null)).toBeNull();
  });

  it("quem fez: o nome, ou Sistema, ou o cliente pelo QR code", () => {
    expect(whoDid({ userName: "Ana", origin: { channel: "web" } })).toBe("Ana");
    expect(whoDid({ userName: null, origin: { channel: "web" } })).toBe("Cliente pelo QR code");
    expect(whoDid({ userName: null, origin: { channel: "system" } })).toBe("Sistema");
    expect(whoDid({ userName: null, origin: { channel: "test" } })).toBe("Sistema");
  });

  it("tipo de operação da entidade, ou a entidade como veio", () => {
    expect(operationLabel("adjustment_request")).toBe("Lançamentos de estoque");
    expect(operationLabel("coisa_nova")).toBe("coisa_nova");
  });

  it("link para o registro que tem tela", () => {
    const id = "0193a1b2-0000-7000-8000-000000000001";
    expect(recordHref("item", id)).toBe(`/estoque/itens/${id}`);
    expect(recordHref("recipe", id)).toBe(`/estoque/produtos/${id}`);
    expect(recordHref("supplier", id)).toBe(`/estoque/fornecedores/${id}`);
    expect(recordHref("addon", id)).toBe(`/pedidos/adicionais/${id}`);
    expect(recordHref("order", id)).toBe(`/pedidos/${id}`);
    expect(recordHref("table_tab", id)).toBe(`/caixa/${id}`);
    expect(recordHref("cash_session", id)).toBe(`/caixa/turnos/${id}`);
    expect(recordHref("membership", id)).toBeNull();
    expect(recordHref("item", null)).toBeNull();
  });
});
