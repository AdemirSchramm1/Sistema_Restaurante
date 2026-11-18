import { MAX_ORDERS_PER_ACCESS } from "./order-lines";

/**
 * Acesso ao cardápio aberto pela leitura do QR code (spec 009, US3, FR-005) ou pelo tablet fixo na
 * mesa (spec 016, FR-005). No QR code o prazo é fixo desde a leitura e não renova com o uso
 * (decisão do dono em 2026-11-08); o tablet não tem prazo: vale até o gerente liberar ou trocar o link.
 */

export type MenuAccessKind = "QR" | "TABLET";

export const MENU_ACCESS_MINUTES = 20;
/** Tolerância para quem tocou em "Confirmar" no último segundo (research R2). */
export const SUBMIT_GRACE_SECONDS = 15;
/** Aviso na tela quando faltar este tempo e houver produtos não enviados. */
export const WARN_SECONDS = 120;

/** `expiresAt` nulo só no tablet. */
export type MenuAccessTimes = {
  kind: MenuAccessKind;
  openedAt: Date;
  expiresAt: Date | null;
  endedAt: Date | null;
};

/**
 * Por que o acesso acabou antes do prazo: QR code lido de novo no celular, conta fechada (011),
 * tablet liberado pelo gerente ou link do tablet trocado (016).
 */
export type MenuAccessEndReason = "RESCAN" | "TAB_CLOSED" | "RELEASED" | "LINK_ROTATED";

export const accessExpiresAt = (openedAt: Date): Date =>
  new Date(openedAt.getTime() + MENU_ACCESS_MINUTES * 60_000);

export const isAccessOpen = (a: MenuAccessTimes, now: Date): boolean =>
  a.endedAt === null && (a.expiresAt === null || now.getTime() < a.expiresAt.getTime());

export const canSubmitWith = (a: MenuAccessTimes, now: Date): boolean =>
  a.endedAt === null &&
  (a.expiresAt === null || now.getTime() <= a.expiresAt.getTime() + SUBMIT_GRACE_SECONDS * 1000);

/** Segundos até o prazo; `null` no tablet, que não tem prazo. */
export function secondsLeft(a: MenuAccessTimes, now: Date): number | null {
  if (a.expiresAt === null) return null;
  if (a.endedAt !== null) return 0;
  return Math.max(0, Math.floor((a.expiresAt.getTime() - now.getTime()) / 1000));
}

export function shouldWarn(a: MenuAccessTimes, now: Date, hasUnsent: boolean): boolean {
  const left = secondsLeft(a, now);
  return hasUnsent && left !== null && left > 0 && left <= WARN_SECONDS;
}

/** Pedidos por acesso: 10 no celular do QR code, sem limite no tablet da mesa. */
export const ordersLimit = (kind: MenuAccessKind): number | null =>
  kind === "QR" ? MAX_ORDERS_PER_ACCESS : null;
