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
  LOCATION_IN_USE: "Retire os itens deste local antes de inativá-lo.",
  LOCATION_INACTIVE: "O local escolhido está inativo.",
  MULTIPLE_DEFAULTS: "Escolha só um local principal para o item.",
  ITEM_DUPLICATE_DESCRIPTION: "Já existe um item ativo com este nome neste grupo.",
  ITEM_UNIT_LOCKED:
    "A medida não pode mudar depois que o item já teve entrada ou saída. Inative o item e crie outro.",
  UNIT_DIMENSION_MISMATCH: "Essas medidas não se convertem (ex.: quilo e unidade).",
  UNKNOWN_UNIT: "Escolha uma medida da lista.",
  INVALID_FACTOR: "A quantidade em cada embalagem precisa ser maior que zero.",
  INVALID_DESCRIPTION: "O nome do item precisa ter entre 3 e 200 letras.",
  PURCHASE_FACTOR_REQUIRED: "Diga quanto vem em cada embalagem (ex.: 20) ou deixe a embalagem em branco.",
  PURCHASE_LABEL_REQUIRED: "Diga o nome da embalagem (ex.: Caixa) ou deixe a quantidade em branco.",
};

export function messageFor(error: DomainError): string {
  const base = ERROR_MESSAGES[error.code] ?? "Algo deu errado.";
  if (error.code === "ITEM_DUPLICATE_DESCRIPTION" && error.details?.existingCode)
    return `Já existe um item ativo com este nome neste grupo (${String(error.details.existingCode)}).`;
  return base;
}
