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

describe("mensagens do caixa do dia (spec 014)", () => {
  it("sem caixa aberto: receber, tirar pagamento e lançar na gaveta dizem o que fazer", () => {
    expect(messageFor({ code: "CASH_SESSION_REQUIRED" })).toBe("Abra o caixa antes de receber.");
    expect(messageFor({ code: "CASH_SESSION_REQUIRED", details: { action: "remove" } })).toBe(
      "Abra o caixa antes de tirar um pagamento.",
    );
    expect(messageFor({ code: "CASH_SESSION_REQUIRED", details: { action: "entry" } })).toBe(
      "Abra o caixa antes de lançar sangria ou reforço.",
    );
    expect(messageFor({ code: "CASH_SESSION_REQUIRED", details: { action: "close" } })).toBe(
      "Não há caixa aberto para fechar.",
    );
  });

  it("caixa já aberto ou já fechado diz por quem e a que horas, no fuso do restaurante", () => {
    const details = {
      openedByName: "Ana",
      openedAt: "2026-11-17T14:02:00.000Z",
      timezone: "America/Sao_Paulo",
    };
    expect(messageFor({ code: "CASH_SESSION_ALREADY_OPEN", details })).toBe(
      "O caixa já foi aberto por Ana às 11:02.",
    );
    expect(messageFor({ code: "CASH_SESSION_ALREADY_OPEN" })).toBe("O caixa já está aberto.");
    expect(
      messageFor({
        code: "CASH_SESSION_ALREADY_CLOSED",
        details: { closedByName: "Ana", closedAt: "2026-11-18T02:10:00.000Z", timezone: "America/Sao_Paulo" },
      }),
    ).toBe("O caixa já foi fechado por Ana às 23:10.");
    expect(messageFor({ code: "CASH_SESSION_ALREADY_CLOSED" })).toBe("O caixa já foi fechado.");
    expect(
      messageFor({
        code: "CASH_SESSION_ALREADY_CLOSED",
        details: { closedByName: null, closedAt: "2026-11-18T02:10:00.000Z", timezone: "America/Manaus" },
      }),
    ).toBe("O caixa já foi fechado às 22:10.");
  });

  it("turno fechado não muda", () => {
    expect(messageFor({ code: "CASH_SESSION_CLOSED" })).toBe("Este turno já foi fechado e não muda mais.");
  });

  it("troco diferente do que ficou na gaveta diz quanto ficou", () => {
    expect(
      messageFor({ code: "OPENING_NOTE_REQUIRED", field: "note", details: { previousKept: "150.00" } }),
    ).toBe("Ficaram R$ 150,00 na gaveta no último fechamento. Diga por que o troco é outro.");
    expect(messageFor({ code: "OPENING_NOTE_REQUIRED" })).toBe("Diga por que o troco é outro.");
  });

  it("sangria acima do esperado diz quanto a gaveta deve ter", () => {
    expect(messageFor({ code: "WITHDRAWAL_EXCEEDS_EXPECTED", details: { expected: "127.00" } })).toBe(
      "A gaveta deve ter R$ 127,00. A sangria não pode passar disso.",
    );
    expect(messageFor({ code: "WITHDRAWAL_EXCEEDS_EXPECTED" })).toBe(
      "A sangria não pode passar do dinheiro que a gaveta deve ter.",
    );
  });

  it("tirar reforço, contagem e fechamento", () => {
    expect(messageFor({ code: "EXPECTED_WOULD_BE_NEGATIVE" })).toBe(
      "Sem esse reforço a gaveta ficaria negativa. Tire uma sangria antes.",
    );
    expect(messageFor({ code: "DENOMINATIONS_MISMATCH" })).toBe(
      "A soma das cédulas e moedas não bate com o valor contado. Confira a contagem.",
    );
    expect(messageFor({ code: "COUNT_REQUIRED" })).toBe(
      "Conte o dinheiro da gaveta antes de fechar o caixa.",
    );
    expect(messageFor({ code: "COUNT_OUTDATED" })).toBe(
      "Entrou dinheiro no turno depois da contagem. Conte de novo.",
    );
    expect(messageFor({ code: "KEPT_ABOVE_COUNTED" })).toBe(
      "O que fica na gaveta não pode passar do que foi contado.",
    );
  });

  it("observação obrigatória diz por quê", () => {
    expect(messageFor({ code: "NOTE_REQUIRED", details: { reason: "difference" } })).toBe(
      "Com sobra ou falta, escreva uma observação.",
    );
    expect(messageFor({ code: "NOTE_REQUIRED", details: { reason: "other" } })).toBe(
      'No motivo "Outro", diga na observação para que foi a sangria.',
    );
    expect(messageFor({ code: "NOTE_REQUIRED" })).toBe("Escreva uma observação.");
  });

  it("lançamento da gaveta já tirado tem o seu texto; o do pagamento continua", () => {
    expect(messageFor({ code: "ALREADY_REMOVED", details: { entry: true } })).toBe(
      "Este lançamento já foi tirado.",
    );
    expect(messageFor({ code: "ALREADY_REMOVED" })).toBe("Este pagamento já foi tirado.");
  });
});

describe("garçom lança o pedido (spec 015, contracts/use-cases.md)", () => {
  it("textos novos", () => {
    expect(messageFor({ code: "STAFF_TABLE_INACTIVE", details: { tableName: "12" } })).toBe(
      "A Mesa 12 foi inativada. Fale com o gerente.",
    );
    expect(messageFor({ code: "STAFF_TABLE_INACTIVE" })).toBe("Esta mesa foi inativada. Fale com o gerente.");
    expect(messageFor({ code: "KITCHEN_STARTED" })).toBe(
      "A cozinha já começou. Peça ao chef ou ao gerente para cancelar.",
    );
    expect(messageFor({ code: "REQUEST_REUSED" })).toBe(
      "Este envio já foi usado para outro pedido. Confira em Pedidos da mesa.",
    );
    expect(messageFor({ code: "NOTE_TOO_LONG", field: "lines.0.kitchenNote" })).toBe(
      "A observação passa de 140 letras.",
    );
    expect(messageFor({ code: "NOTE_TOO_LONG" })).toBe("Use até 140 letras.");
  });

  it("a mensagem da mesa inativa do cliente continua mandando chamar o garçom", () => {
    expect(messageFor({ code: "TABLE_INACTIVE" })).toBe(
      "Esta mesa não está recebendo pedidos. Chame um garçom.",
    );
  });
});

describe("mensagens do tablet e da aparência (spec 016, contracts/use-cases.md)", () => {
  it("link do tablet: inválido, já ligado em outro aparelho, desligado pelo gerente", () => {
    expect(messageFor({ code: "TABLET_LINK_INVALID" })).toBe("Link inválido. Chame um garçom.");
    expect(messageFor({ code: "TABLET_LINK_IN_USE" })).toBe(
      "Este link já está ligado em outro tablet. Peça ao gerente para liberar.",
    );
    expect(messageFor({ code: "TABLET_RELEASED" })).toBe("Este tablet foi desligado. Peça ao gerente.");
  });

  it("foto pequena diz o mínimo do logo e da capa; a do prato continua igual", () => {
    expect(messageFor({ code: "PHOTO_TOO_SMALL", details: { kind: "LOGO" } })).toBe(
      "O logo precisa ter pelo menos 200 px no lado menor.",
    );
    expect(messageFor({ code: "PHOTO_TOO_SMALL", details: { kind: "COVER" } })).toBe(
      "A foto de capa precisa ter pelo menos 1200 px de largura.",
    );
    expect(messageFor({ code: "PHOTO_TOO_SMALL" })).toBe(
      "Essa foto é pequena e vai ficar borrada no cardápio. Use uma foto de pelo menos 600 px.",
    );
  });
});
