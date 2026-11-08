/**
 * Acesso ao cardápio aberto pela leitura do QR code (spec 009, US3, FR-005).
 * O prazo é fixo desde a leitura e não renova com o uso (decisão do dono em 2026-11-08).
 */

export const MENU_ACCESS_MINUTES = 20;
/** Tolerância para quem tocou em "Confirmar" no último segundo (research R2). */
export const SUBMIT_GRACE_SECONDS = 15;
/** Aviso na tela quando faltar este tempo e houver produtos não enviados. */
export const WARN_SECONDS = 120;

export type MenuAccessTimes = { openedAt: Date; expiresAt: Date; endedAt: Date | null };

export const accessExpiresAt = (openedAt: Date): Date =>
  new Date(openedAt.getTime() + MENU_ACCESS_MINUTES * 60_000);

export const isAccessOpen = (a: MenuAccessTimes, now: Date): boolean =>
  a.endedAt === null && now.getTime() < a.expiresAt.getTime();

export const canSubmitWith = (a: MenuAccessTimes, now: Date): boolean =>
  a.endedAt === null && now.getTime() <= a.expiresAt.getTime() + SUBMIT_GRACE_SECONDS * 1000;

export function secondsLeft(a: MenuAccessTimes, now: Date): number {
  if (a.endedAt !== null) return 0;
  return Math.max(0, Math.floor((a.expiresAt.getTime() - now.getTime()) / 1000));
}

export function shouldWarn(a: MenuAccessTimes, now: Date, hasUnsent: boolean): boolean {
  const left = secondsLeft(a, now);
  return hasUnsent && left > 0 && left <= WARN_SECONDS;
}
