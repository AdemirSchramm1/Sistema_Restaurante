import { d, formatBrl } from "@/domain/shared/decimal";
import type { DomainError, ErrorCode } from "@/domain/shared/result";

/** Texto em pt-BR de cada código de erro (contracts/use-cases.md). */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Sua sessão expirou. Entre novamente.",
  FORBIDDEN: "Você não tem permissão para esta ação.",
  NOT_FOUND: "Registro não encontrado.",
  STALE_RECORD: "Outra pessoa alterou este registro. Revise os dados atuais antes de salvar.",
  VALIDATION: "Confira os dados informados.",
  INVALID_NUMBER: "Número inválido. Use vírgula para decimais (ex.: 1,5).",
  EMAIL_IN_USE: "Este e-mail já está cadastrado.",
  WEAK_PASSWORD: "A senha precisa ter pelo menos 8 caracteres.",
  ALREADY_MEMBER: "Esta pessoa já faz parte da equipe.",
  INVITATION_PENDING: "Já existe um convite pendente para este e-mail.",
  EMAIL_BELONGS_TO_OTHER_RESTAURANT: "Este e-mail já pertence a outro restaurante.",
  INVITATION_INVALID: "Convite inválido ou revogado.",
  INVITATION_EXPIRED: "Este convite expirou. Peça um novo ao gerente.",
  LAST_MANAGER: "O restaurante precisa ter pelo menos um gerente ativo.",
  NAME_IN_USE: "Já existe um registro ativo com este nome.",
  GROUP_CODES_EXHAUSTED: "Não há mais códigos de 2 dígitos disponíveis.",
  SYSTEM_RECORD: "Este registro é padrão do sistema e não pode ser apagado ou inativado.",
  SUBGROUP_HAS_ACTIVE_ITEMS: "Mova ou inative os itens deste subgrupo antes.",
  SUBGROUP_INACTIVE: "O subgrupo escolhido está inativo.",
  SUBGROUP_SEQUENCE_EXHAUSTED: "Este subgrupo chegou a 9.999 itens. Crie outro subgrupo.",
  ITEM_DUPLICATE_DESCRIPTION: "Já existe um item ativo com este nome neste grupo.",
  ITEM_UNIT_LOCKED:
    "A medida não pode mudar depois que o item já teve entrada ou saída. Inative o item e crie outro.",
  UNIT_DIMENSION_MISMATCH: "Essas medidas não se convertem (ex.: quilo e unidade).",
  UNKNOWN_UNIT: "Escolha uma medida da lista.",
  INVALID_FACTOR: "A quantidade em cada embalagem precisa ser maior que zero.",
  INVALID_DESCRIPTION: "O nome do item precisa ter entre 3 e 200 letras.",
  PURCHASE_FACTOR_REQUIRED: "Diga quanto vem em cada embalagem (ex.: 20) ou deixe a embalagem em branco.",
  PURCHASE_LABEL_REQUIRED: "Diga o nome da embalagem (ex.: Caixa) ou deixe a quantidade em branco.",
  INVALID_NAME: "O nome precisa ter entre 3 e 120 letras.",
  INVALID_QUANTITY: "A quantidade precisa ser maior que zero, com até 4 casas depois da vírgula.",
  INVALID_YIELD: "Diga quanto o preparo rende (quantidade maior que zero e a medida).",
  RECIPE_EMPTY: "Adicione pelo menos um item.",
  RECIPE_DUPLICATE_NAME: "Já existe um produto ativo com este nome.",
  DUPLICATE_RECIPE_COMPONENT: "Este item já está no produto; some as quantidades numa linha só.",
  COMPONENT_INACTIVE: "Este item está inativo e não pode entrar em produto novo.",
  NOT_A_SUB_RECIPE: "Só preparos podem ser usados dentro de outro produto.",
  RECIPE_CYCLE: "Este preparo acabaria usando a si mesmo.",
  RECIPE_IN_USE: "Este preparo está em uso em outros produtos.",
  ITEM_INACTIVE: "Este item está inativo. Reative o item para lançar.",
  INVALID_AMOUNT: "Valor inválido. Use até 2 casas depois da vírgula (ex.: 240,50).",
  INVALID_REASON: "Escolha um motivo da lista.",
  INSUFFICIENT_STOCK: "Não há estoque suficiente para essa saída.",
  FUTURE_DATE: "A data não pode ser no futuro.",
  NO_CHANGE: "O saldo já é esse. Não há o que acertar.",
  SELF_APPROVAL: "Quem pediu o acerto não pode aprová-lo. Peça a outro gerente.",
  REQUEST_NOT_PENDING: "Este pedido de acerto já foi decidido.",
  ALREADY_REVERSED: "Este lançamento já foi estornado.",
  CANNOT_REVERSE_REVERSAL: "Estorno não se estorna. Lance de novo o que for certo.",
  INVALID_CNPJ: "CNPJ inválido. Confira os números (ex.: 11.222.333/0001-81).",
  CNPJ_IN_USE: "Já existe um fornecedor com este CNPJ.",
  INVALID_EMAIL: "E-mail inválido (ex.: vendas@fornecedor.com.br).",
  PRICE_ONLY_FOR_DISH: "Só produto vendido ao cliente tem preço de venda.",
  INVALID_PRICE: "Preço inválido. Precisa ser maior que zero (ex.: 90,00).",
  SUPPLIER_ITEM_DUPLICATE: "Este item já está na lista deste fornecedor.",
  SUPPLIER_BLOCKED: "Este fornecedor está bloqueado. Desbloqueie ou escolha outro.",
  INVALID_REORDER_LEVELS:
    '"Comprar até" precisa ser maior que "Avisar quando chegar em" (e só vale com ele preenchido).',
  INVALID_TABLE_NAME: "O nome da mesa precisa ter de 1 a 30 letras (ex.: 12 ou Varanda 3).",
  TABLE_NAME_IN_USE: "Já existe uma mesa com esse nome.",
  INVALID_RANGE: "Use números de 1 a 999, o primeiro menor que o último, até 200 mesas de uma vez.",
  ACCESS_EXPIRED: "Seu tempo acabou. Escaneie o QR code da mesa de novo para continuar.",
  TABLE_INACTIVE: "Esta mesa não está recebendo pedidos. Chame um garçom.",
  ORDERING_PAUSED: "O restaurante não está recebendo pedidos agora. Chame um garçom.",
  ACCESS_ORDER_LIMIT: "Chame um garçom para continuar pedindo.",
  EMPTY_ORDER: "Adicione pelo menos um produto ao pedido.",
  TOO_MANY_LINES: "O pedido pode ter até 30 linhas. Envie o resto num novo pedido.",
  PRODUCT_UNAVAILABLE: "Algum produto do pedido não está mais disponível.",
  PRICE_CHANGED: "O preço de algum produto mudou. Confira e confirme de novo.",
  INVALID_ORDER_TRANSITION: "Este pedido já mudou de situação. A tela foi atualizada.",
  CANCEL_NOTE_REQUIRED: 'Diga o motivo quando escolher "Outro".',
  NOTE_TOO_LONG: "Use até 140 letras.",
  INVALID_PERIOD: "Escolha um período de até 31 dias, com o início antes do fim.",
  NOT_A_DISH: "Só produto vendido ao cliente tem essa opção.",
  INVALID_ADDON_TIMES: "Quantidade de adicional fora do limite deste prato.",
  OPTION_UNAVAILABLE: "Uma das opções escolhidas não está mais disponível para este prato.",
  ADDON_INACTIVE: "Este adicional está inativo.",
  INVALID_MAX_TIMES: "O máximo de vezes precisa ser de 1 a 5.",
  NOT_IN_PRODUCT: "Só dá para tirar o que está no produto.",
  INVALID_LABEL: "O texto do botão precisa ter até 40 letras.",
  DUPLICATE_OPTION: "Esta opção já está na lista.",
  TOO_MANY_OPTIONS: "Use até 10 adicionais e 10 itens para tirar por produto.",
  INVALID_RATE: "A taxa de serviço precisa ser de 0% a 20%, com até 2 casas (ex.: 10 ou 12,5).",
  INVALID_PEOPLE: "Divida por 2 a 20 pessoas.",
  PAYMENT_EXCEEDS_REMAINING: "O valor passa do que falta pagar.",
  RECEIVED_TOO_LOW: "O valor recebido em dinheiro é menor que o valor do pagamento.",
  REMAINING_NOT_ZERO: "Ainda falta pagar.",
  PENDING_ORDERS: "A mesa tem pedidos que ainda não foram entregues.",
  TAB_CLOSED: "Esta conta já foi fechada.",
  TAB_NOT_CLOSED: "Esta conta já está aberta.",
  TABLE_TAB_CLOSED: "Esta conta foi fechada. Escaneie o QR code da mesa para pedir de novo.",
  ALREADY_REMOVED: "Este pagamento já foi tirado.",
  NO_SERVICE_CHARGE: "Esta conta não tem taxa de serviço.",
  REASON_REQUIRED: "Diga o motivo.",
  TABLE_HAS_OPEN_TAB: "A mesa já tem outra conta aberta. Feche-a antes.",
  INGREDIENTS_USED_REQUIRED: "Diga se os ingredientes já foram usados.",
  REVERSE_VIA_ORDER: "Esta saída veio de um pedido. Para desfazer, cancele o pedido na cozinha.",
  PHOTO_TYPE: "Use uma foto JPG, PNG ou WebP.",
  PHOTO_TOO_BIG: "A foto pode ter até 10 MB.",
  PHOTO_TOO_SMALL: "Essa foto é pequena e vai ficar borrada no cardápio. Use uma foto de pelo menos 600 px.",
  PHOTO_STORAGE_FAILED: "Não foi possível enviar a foto. Tente de novo.",
  PHOTO_PREPARE_FAILED: "Não foi possível preparar a foto neste aparelho. Use uma foto menor que 4 MB.",
  CASH_SESSION_REQUIRED: "Abra o caixa antes de receber.",
  CASH_SESSION_ALREADY_OPEN: "O caixa já está aberto.",
  CASH_SESSION_ALREADY_CLOSED: "O caixa já foi fechado.",
  CASH_SESSION_CLOSED: "Este turno já foi fechado e não muda mais.",
  OPENING_NOTE_REQUIRED: "Diga por que o troco é outro.",
  WITHDRAWAL_EXCEEDS_EXPECTED: "A sangria não pode passar do dinheiro que a gaveta deve ter.",
  EXPECTED_WOULD_BE_NEGATIVE: "Sem esse reforço a gaveta ficaria negativa. Tire uma sangria antes.",
  DENOMINATIONS_MISMATCH: "A soma das cédulas e moedas não bate com o valor contado. Confira a contagem.",
  COUNT_REQUIRED: "Conte o dinheiro da gaveta antes de fechar o caixa.",
  COUNT_OUTDATED: "Entrou dinheiro no turno depois da contagem. Conte de novo.",
  KEPT_ABOVE_COUNTED: "O que fica na gaveta não pode passar do que foi contado.",
  NOTE_REQUIRED: "Escreva uma observação.",
  STAFF_TABLE_INACTIVE: "Esta mesa foi inativada. Fale com o gerente.",
  KITCHEN_STARTED: "A cozinha já começou. Peça ao chef ou ao gerente para cancelar.",
  REQUEST_REUSED: "Este envio já foi usado para outro pedido. Confira em Pedidos da mesa.",
};

/** Caixa do dia (spec 014): o mesmo código com o detalhe de qual ação pediu o caixa aberto. */
const CASH_REQUIRED: Record<string, string> = {
  remove: "Abra o caixa antes de tirar um pagamento.",
  entry: "Abra o caixa antes de lançar sangria ou reforço.",
  close: "Não há caixa aberto para fechar.",
};
const NOTE_REQUIRED: Record<string, string> = {
  difference: "Com sobra ou falta, escreva uma observação.",
  other: 'No motivo "Outro", diga na observação para que foi a sangria.',
};

/** "por Ana às 11:02" (ou só "às 11:02"), no fuso do restaurante que veio nos detalhes. */
function byAt(name: unknown, at: unknown, timeZone: unknown): string {
  const time = new Date(String(at)).toLocaleTimeString("pt-BR", {
    timeZone: String(timeZone),
    hour: "2-digit",
    minute: "2-digit",
  });
  return name ? `por ${String(name)} às ${time}` : `às ${time}`;
}

/** "R$ 1.234,50" a partir da string decimal dos detalhes do erro. */
const money = (v: unknown) => formatBrl(d(String(v)));

export function messageFor(error: DomainError): string {
  const base = ERROR_MESSAGES[error.code] ?? "Algo deu errado.";
  const details = error.details;
  // Garçom (spec 015): a mesa vem no detalhe; a observação da cozinha tem o seu texto.
  if (error.code === "STAFF_TABLE_INACTIVE" && details?.tableName)
    return `A Mesa ${String(details.tableName)} foi inativada. Fale com o gerente.`;
  if (error.code === "NOTE_TOO_LONG" && error.field?.endsWith("kitchenNote"))
    return "A observação passa de 140 letras.";
  if (error.code === "CASH_SESSION_REQUIRED") return CASH_REQUIRED[String(details?.action)] ?? base;
  if (error.code === "NOTE_REQUIRED") return NOTE_REQUIRED[String(details?.reason)] ?? base;
  if (error.code === "CASH_SESSION_ALREADY_OPEN" && details?.openedAt)
    return `O caixa já foi aberto ${byAt(details.openedByName, details.openedAt, details.timezone)}.`;
  if (error.code === "CASH_SESSION_ALREADY_CLOSED" && details?.closedAt)
    return `O caixa já foi fechado ${byAt(details.closedByName, details.closedAt, details.timezone)}.`;
  if (error.code === "OPENING_NOTE_REQUIRED" && details?.previousKept !== undefined)
    return `Ficaram ${money(details.previousKept)} na gaveta no último fechamento. Diga por que o troco é outro.`;
  if (error.code === "WITHDRAWAL_EXCEEDS_EXPECTED" && details?.expected !== undefined)
    return `A gaveta deve ter ${money(details.expected)}. A sangria não pode passar disso.`;
  if (error.code === "ALREADY_REMOVED" && details?.entry) return "Este lançamento já foi tirado.";
  // Cardápio (spec 013): o mesmo código já existia para outros cadastros; o detalhe diz qual é.
  if (error.code === "INVALID_DESCRIPTION" && error.details?.max !== undefined)
    return `A descrição pode ter até ${String(error.details.max)} caracteres.`;
  if (error.code === "NAME_IN_USE" && error.details?.section !== undefined)
    return `Já existe a seção ${String(error.details.section)}.`;
  if (error.code === "INVALID_NAME" && error.details?.max !== undefined)
    return `Dê um nome à seção, com até ${String(error.details.max)} letras.`;
  if (error.code === "PAYMENT_EXCEEDS_REMAINING" && error.details?.paid !== undefined)
    return `Já foram pagos ${money(error.details.paid)} e, sem a taxa, a conta fica em ${money(error.details.total)}. Tire um pagamento antes de tirar a taxa.`;
  if (error.code === "PAYMENT_EXCEEDS_REMAINING" && error.details?.remaining !== undefined)
    return `O valor passa do que falta pagar (${money(error.details.remaining)}).`;
  if (error.code === "REMAINING_NOT_ZERO" && error.details?.remaining !== undefined) {
    const remaining = d(String(error.details.remaining));
    return remaining.isNegative()
      ? `Foi pago ${money(remaining.abs())} a mais. Tire um pagamento e lance de novo com o valor certo.`
      : `Ainda falta pagar ${money(remaining)}.`;
  }
  if (error.code === "PENDING_ORDERS" && typeof error.details?.pending === "number")
    return error.details.pending === 1
      ? "1 pedido ainda não foi entregue. Feche a conta depois que ele chegar à mesa ou for cancelado."
      : `${error.details.pending} pedidos ainda não foram entregues. Feche a conta depois que eles chegarem à mesa ou forem cancelados.`;
  if (error.code === "ITEM_DUPLICATE_DESCRIPTION" && error.details?.existingCode)
    return `Já existe um item ativo com este nome neste grupo (${String(error.details.existingCode)}).`;
  if (error.code === "INSUFFICIENT_STOCK" && error.details?.available !== undefined)
    return `Não há estoque suficiente: só há ${String(error.details.available).replace(".", ",")} ${String(error.details.unit)}.`;
  if (error.code === "RECIPE_IN_USE" && Array.isArray(error.details?.usedBy))
    return `Este preparo está em uso em: ${(error.details.usedBy as string[]).join(", ")}. Tire dele primeiro.`;
  if (error.code === "CNPJ_IN_USE" && error.details?.existingName)
    return `Já existe um fornecedor com este CNPJ: ${String(error.details.existingName)}.`;
  return base;
}
