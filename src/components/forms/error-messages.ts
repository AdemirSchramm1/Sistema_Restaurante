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
};

export function messageFor(error: DomainError): string {
  const base = ERROR_MESSAGES[error.code] ?? "Algo deu errado.";
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
