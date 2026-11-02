export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "STALE_RECORD"
  | "VALIDATION"
  | "INVALID_NUMBER"
  | "EMAIL_IN_USE"
  | "WEAK_PASSWORD"
  | "ALREADY_MEMBER"
  | "INVITATION_PENDING"
  | "EMAIL_BELONGS_TO_OTHER_RESTAURANT"
  | "INVITATION_INVALID"
  | "INVITATION_EXPIRED"
  | "LAST_MANAGER"
  | "NAME_IN_USE"
  | "GROUP_CODES_EXHAUSTED"
  | "SYSTEM_RECORD"
  | "SUBGROUP_HAS_ACTIVE_ITEMS"
  | "SUBGROUP_INACTIVE"
  | "SUBGROUP_SEQUENCE_EXHAUSTED"
  | "ITEM_DUPLICATE_DESCRIPTION"
  | "ITEM_UNIT_LOCKED"
  | "UNIT_DIMENSION_MISMATCH"
  | "UNKNOWN_UNIT"
  | "INVALID_FACTOR"
  | "INVALID_DESCRIPTION"
  | "PURCHASE_FACTOR_REQUIRED"
  | "PURCHASE_LABEL_REQUIRED"
  | "INVALID_NAME"
  | "INVALID_QUANTITY"
  | "INVALID_YIELD"
  | "RECIPE_EMPTY"
  | "RECIPE_DUPLICATE_NAME"
  | "DUPLICATE_RECIPE_COMPONENT"
  | "COMPONENT_INACTIVE"
  | "NOT_A_SUB_RECIPE"
  | "RECIPE_CYCLE"
  | "RECIPE_IN_USE"
  | "ITEM_INACTIVE"
  | "INVALID_AMOUNT"
  | "INVALID_REASON"
  | "INSUFFICIENT_STOCK"
  | "FUTURE_DATE"
  | "NO_CHANGE"
  | "SELF_APPROVAL"
  | "REQUEST_NOT_PENDING"
  | "ALREADY_REVERSED"
  | "CANNOT_REVERSE_REVERSAL"
  | "INVALID_CNPJ"
  | "CNPJ_IN_USE"
  | "INVALID_EMAIL"
  | "INVALID_PRICE"
  | "SUPPLIER_ITEM_DUPLICATE"
  | "SUPPLIER_BLOCKED";

export type DomainError = {
  code: ErrorCode;
  field?: string;
  details?: Record<string, unknown>;
};

export type Result<T, E = DomainError> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = (code: ErrorCode, field?: string, details?: Record<string, unknown>): Result<never> => ({
  ok: false,
  error: { code, ...(field ? { field } : {}), ...(details ? { details } : {}) },
});
