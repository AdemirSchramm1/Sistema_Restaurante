import { err, ok, type Result } from "../shared/result";

export const MAX_ITEM_SEQ = 9999;

/** Código imutável GG.SS.NNNN (FR-018). */
export function formatItemCode(groupCode: string, subgroupCode: string, seq: number): Result<string> {
  if (!Number.isInteger(seq) || seq < 1 || seq > MAX_ITEM_SEQ) return err("SUBGROUP_SEQUENCE_EXHAUSTED");
  return ok(`${groupCode}.${subgroupCode}.${String(seq).padStart(4, "0")}`);
}

/** Código de 2 dígitos de grupo ou subgrupo a partir do contador (FR-009). */
export function nextTwoDigitCode(counter: number): Result<string> {
  if (!Number.isInteger(counter) || counter < 1 || counter > 99) return err("GROUP_CODES_EXHAUSTED");
  return ok(String(counter).padStart(2, "0"));
}
