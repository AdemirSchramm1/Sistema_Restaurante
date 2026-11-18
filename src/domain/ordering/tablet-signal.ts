/** Sinal de vida do tablet fixo na mesa (spec 016, R5, US4-8). */

/** O tablet grava o sinal no máximo uma vez a cada tantos segundos. */
export const HEARTBEAT_SECONDS = 60;
/** Acima disso a tela Mesas mostra "Sem sinal há N min" em destaque. */
export const LOST_AFTER_MINUTES = 10;

export type TabletSignal = { kind: "NEVER" } | { kind: "SEEN" | "LOST"; minutes: number };

export function tabletSignal(lastSeenAt: Date | null, now: Date): TabletSignal {
  if (!lastSeenAt) return { kind: "NEVER" };
  const seconds = Math.max(0, (now.getTime() - lastSeenAt.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);
  return { kind: seconds > LOST_AFTER_MINUTES * 60 ? "LOST" : "SEEN", minutes };
}
