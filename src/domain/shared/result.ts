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
  | "PURCHASE_LABEL_REQUIRED";

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
