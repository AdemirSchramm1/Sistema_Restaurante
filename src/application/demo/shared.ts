import type { Clock } from "../ports";
import type { Result } from "@/domain/shared/result";

/** Relógio que o povoamento move para lançar cada passo do histórico na hora certa. */
export type SeedClock = Clock & { set(at: Date): void };

/** O resultado esperado de um caso de uso; recusa no povoamento é defeito, então para tudo. */
export function must<T>(r: Result<T>, what: string): T {
  if (!r.ok) throw new Error(`Povoamento: ${what} recusado (${JSON.stringify(r.error)})`);
  return r.value;
}

/** "2026-11-25" + "11:30" → instante em Brasília (sem horário de verão desde 2019). */
export const localTime = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00-03:00`);
