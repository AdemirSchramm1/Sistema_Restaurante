import { err, ok, type Result } from "../shared/result";

/**
 * Semana da revisão das exceções (spec 019, US3): segunda a domingo, em dias locais "AAAA-MM-DD"
 * (o dia local sai do fuso do restaurante antes de chegar aqui).
 */

const DAY_MS = 86_400_000;
export const REVIEW_NOTE_MAX = 140;

const ms = (day: string) => Date.parse(`${day}T00:00:00Z`);
const day = (t: number) => new Date(t).toISOString().slice(0, 10);
const plus = (d: string, days: number) => day(ms(d) + days * DAY_MS);
const short = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Segunda-feira da semana do dia. */
export function weekStartOf(d: string): string {
  // getUTCDay: domingo 0 … sábado 6; a semana começa na segunda.
  const sinceMonday = (new Date(ms(d)).getUTCDay() + 6) % 7;
  return plus(d, -sinceMonday);
}

export const weekEndOf = (start: string): string => plus(start, 6);

/** "16/11 a 22/11". */
export const weekText = (start: string): string => `${short(start)} a ${short(weekEndOf(start))}`;

/** Semana pela segunda (dia que existe: "2026-02-30" não volta igual de `weekStartOf`). */
export function checkWeek(start: string): Result<string> {
  return Number.isNaN(ms(start)) || weekStartOf(start) !== start ? err("INVALID_WEEK") : ok(start);
}

/** Só depois do domingo da semana ela pode ser revisada. */
export function checkWeekToReview(start: string, today: string): Result<string> {
  const week = checkWeek(start);
  if (!week.ok) return week;
  return today <= weekEndOf(start) ? err("WEEK_NOT_CLOSED") : week;
}

/** Observação da revisão: opcional, até 140 letras. */
export function checkReviewNote(note: string): Result<string | null> {
  const clean = note.trim();
  if ([...clean].length > REVIEW_NOTE_MAX) return err("NOTE_TOO_LONG", "note");
  return ok(clean || null);
}
