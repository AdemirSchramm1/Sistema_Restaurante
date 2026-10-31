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
  | "TEMPERATURE_RANGE_REQUIRED"
  | "TEMPERATURE_RANGE_INVALID"
  | "RESPONSIBLE_NOT_MEMBER"
  | "LOCATION_IN_USE"
  | "LOCATION_INACTIVE"
  | "LOCATION_INCOMPATIBLE"
  | "MULTIPLE_DEFAULTS"
  | "ITEM_DUPLICATE_DESCRIPTION"
  | "ITEM_UNIT_LOCKED"
  | "MISSING_ITEM_CONVERSION"
  | "UNIT_DIMENSION_MISMATCH"
  | "UNKNOWN_UNIT"
  | "INVALID_FACTOR"
  | "INVALID_CORRECTION_FACTOR"
  | "INVALID_YIELD_FACTOR"
  | "INVALID_EAN"
  | "INVALID_ALLERGEN"
  | "INVALID_NCM"
  | "INVALID_CEST"
  | "INVALID_ORIGIN"
  | "INVALID_DESCRIPTION"
  | "INVALID_RANGE"
  | "INVALID_DAYS";

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
