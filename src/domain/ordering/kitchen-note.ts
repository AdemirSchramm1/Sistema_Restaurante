import { ok, type Result } from "../shared/result";

export const KITCHEN_NOTE_MAX = 0;
export const checkKitchenNote = (_note: string | null): Result<string | null> => ok(null);
