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
  TEMPERATURE_RANGE_REQUIRED: "Locais refrigerados e congelados precisam de faixa de temperatura.",
  TEMPERATURE_RANGE_INVALID: "A temperatura mínima não pode ser maior que a máxima.",
  RESPONSIBLE_NOT_MEMBER: "O responsável precisa ser um membro ativo da equipe.",
  LOCATION_IN_USE: "Retire os itens deste local antes de inativá-lo.",
  LOCATION_INACTIVE: "O local escolhido está inativo.",
  LOCATION_INCOMPATIBLE:
    "Produtos de limpeza só podem ficar em local de químicos, e alimentos não podem ficar nele.",
  MULTIPLE_DEFAULTS: "Escolha só um local padrão para o item.",
  ITEM_DUPLICATE_DESCRIPTION: "Já existe um item ativo com esta descrição neste subgrupo.",
  ITEM_UNIT_LOCKED:
    "A unidade de estoque não pode mudar depois da primeira movimentação. Inative o item e crie outro.",
  MISSING_ITEM_CONVERSION: "Informe a conversão entre a unidade de estoque e a de receita para este item.",
  UNIT_DIMENSION_MISMATCH: "Não há conversão entre essas unidades para este item.",
  UNKNOWN_UNIT: "Unidade desconhecida.",
  INVALID_FACTOR: "O fator precisa ser maior que zero.",
  INVALID_CORRECTION_FACTOR: "O fator de correção precisa ser 1 ou maior.",
  INVALID_YIELD_FACTOR: "O rendimento precisa ser maior que 0 e no máximo 1.",
  INVALID_EAN: "Código de barras (EAN/GTIN) inválido.",
  INVALID_ALLERGEN: "Alérgeno fora da lista da Anvisa (RDC 727/2022).",
  INVALID_NCM: "O NCM precisa ter 8 dígitos.",
  INVALID_CEST: "O CEST precisa ter 7 dígitos.",
  INVALID_ORIGIN: "A origem precisa ser um dígito de 0 a 8.",
  INVALID_DESCRIPTION: "A descrição precisa ter entre 3 e 200 caracteres.",
  INVALID_RANGE: "O valor mínimo não pode ser maior que o máximo.",
  INVALID_DAYS: "Informe um número inteiro de dias, zero ou maior.",
};

export function messageFor(error: DomainError): string {
  const base = ERROR_MESSAGES[error.code] ?? "Algo deu errado.";
  if (error.code === "ITEM_DUPLICATE_DESCRIPTION" && error.details?.existingCode)
    return `Já existe um item ativo com esta descrição neste subgrupo (${String(error.details.existingCode)}).`;
  return base;
}
