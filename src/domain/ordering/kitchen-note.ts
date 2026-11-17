import { err, ok, type Result } from "../shared/result";

/** Observação para a cozinha, só da equipe (spec 015, FR-018). */
export const KITCHEN_NOTE_MAX = 140;

/** Apara os espaços; vazio vira sem observação; mais de 140 letras é recusado. */
export function checkKitchenNote(note: string | null): Result<string | null> {
  const text = note?.trim() || null;
  if (text && [...text].length > KITCHEN_NOTE_MAX) return err("NOTE_TOO_LONG", "kitchenNote");
  return ok(text);
}
