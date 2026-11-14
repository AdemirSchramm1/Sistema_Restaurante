import { describe, it, expect } from "vitest";
import { messageFor } from "./error-messages";

describe("mensagens com valores da conta da mesa (spec 011)", () => {
  it("tirar a taxa com o pago acima do novo total diz os valores e o que fazer", () => {
    expect(
      messageFor({ code: "PAYMENT_EXCEEDS_REMAINING", details: { total: "77.00", paid: "80.00" } }),
    ).toBe(
      "Já foram pagos R$ 80,00 e, sem a taxa, a conta fica em R$ 77,00. Tire um pagamento antes de tirar a taxa.",
    );
  });

  it("pagamento acima do que falta diz quanto falta (US2-3)", () => {
    expect(
      messageFor({ code: "PAYMENT_EXCEEDS_REMAINING", field: "amount", details: { remaining: "40.00" } }),
    ).toBe("O valor passa do que falta pagar (R$ 40,00).");
  });

  it("fechar com falta diz quanto; com pago a mais, quanto e o que fazer (US2-6)", () => {
    expect(messageFor({ code: "REMAINING_NOT_ZERO", details: { remaining: "12.00" } })).toBe(
      "Ainda falta pagar R$ 12,00.",
    );
    expect(messageFor({ code: "REMAINING_NOT_ZERO", details: { remaining: "-1.30" } })).toBe(
      "Foi pago R$ 1,30 a mais. Tire um pagamento e lance de novo com o valor certo.",
    );
  });

  it("fechar com pedido não entregue diz quantos", () => {
    expect(messageFor({ code: "PENDING_ORDERS", details: { pending: 1 } })).toBe(
      "1 pedido ainda não foi entregue. Feche a conta depois que ele chegar à mesa ou for cancelado.",
    );
    expect(messageFor({ code: "PENDING_ORDERS", details: { pending: 2 } })).toBe(
      "2 pedidos ainda não foram entregues. Feche a conta depois que eles chegarem à mesa ou forem cancelados.",
    );
  });

  it("sem detalhes, a mensagem geral", () => {
    expect(messageFor({ code: "REMAINING_NOT_ZERO" })).toBe("Ainda falta pagar.");
  });
});

describe("mensagens com detalhes do estoque e do cadastro", () => {
  it("nome repetido diz o código do item que já existe", () => {
    expect(messageFor({ code: "ITEM_DUPLICATE_DESCRIPTION", details: { existingCode: "01.02.0003" } })).toBe(
      "Já existe um item ativo com este nome neste grupo (01.02.0003).",
    );
  });

  it("estoque insuficiente diz quanto há, com vírgula", () => {
    expect(messageFor({ code: "INSUFFICIENT_STOCK", details: { available: "2.5", unit: "kg" } })).toBe(
      "Não há estoque suficiente: só há 2,5 kg.",
    );
  });

  it("preparo em uso lista onde", () => {
    expect(messageFor({ code: "RECIPE_IN_USE", details: { usedBy: ["Lasanha", "Pizza"] } })).toBe(
      "Este preparo está em uso em: Lasanha, Pizza. Tire dele primeiro.",
    );
  });

  it("CNPJ repetido diz de qual fornecedor", () => {
    expect(messageFor({ code: "CNPJ_IN_USE", details: { existingName: "Ceasa" } })).toBe(
      "Já existe um fornecedor com este CNPJ: Ceasa.",
    );
  });

  it("código sem mensagem própria cai na mensagem geral", () => {
    expect(messageFor({ code: "NOPE" as never })).toBe("Algo deu errado.");
  });
});

describe("mensagens da edição do cardápio (spec 013, US1 e US2)", () => {
  it("foto: tipo, tamanho, medida e falha de envio", () => {
    expect(messageFor({ code: "PHOTO_TYPE" })).toBe("Use uma foto JPG, PNG ou WebP.");
    expect(messageFor({ code: "PHOTO_TOO_BIG" })).toBe("A foto pode ter até 10 MB.");
    expect(messageFor({ code: "PHOTO_TOO_SMALL" })).toBe(
      "Essa foto é pequena e vai ficar borrada no cardápio. Use uma foto de pelo menos 600 px.",
    );
    expect(messageFor({ code: "PHOTO_STORAGE_FAILED" })).toBe(
      "Não foi possível enviar a foto. Tente de novo.",
    );
  });

  it("descrição acima do limite diz o limite", () => {
    expect(messageFor({ code: "INVALID_DESCRIPTION", field: "description", details: { max: 300 } })).toBe(
      "A descrição pode ter até 300 caracteres.",
    );
  });

  it("descrição do item continua com a mensagem do item", () => {
    expect(messageFor({ code: "INVALID_DESCRIPTION" })).toBe(
      "O nome do item precisa ter entre 3 e 200 letras.",
    );
  });

  it("seção: nome repetido diz qual seção já existe; nome inválido diz o limite", () => {
    expect(messageFor({ code: "NAME_IN_USE", field: "name", details: { section: "Lanches" } })).toBe(
      "Já existe a seção Lanches.",
    );
    expect(messageFor({ code: "INVALID_NAME", field: "name", details: { max: 40 } })).toBe(
      "Dê um nome à seção, com até 40 letras.",
    );
    expect(messageFor({ code: "NAME_IN_USE" })).toBe("Já existe um registro ativo com este nome.");
    expect(messageFor({ code: "INVALID_NAME" })).toBe("O nome precisa ter entre 3 e 120 letras.");
  });
});
