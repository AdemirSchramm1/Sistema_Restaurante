import type { ActionState } from "@/actions/_session";

/** Envio do carrinho do garçom (spec 015, R22, FR-021). */

export const OFFLINE_TEXT = "Sem conexão. O pedido não foi enviado.";
export const UNCERTAIN_TEXT =
  "Não deu para saber se o pedido chegou. Toque em Enviar de novo: ele não é lançado duas vezes.";
export const PREVIOUS_TAB_CLOSED_TEXT =
  "A conta anterior desta mesa foi fechada. Este pedido abriu uma conta nova.";
export const SESSION_EXPIRED_TEXT = "Sua sessão venceu. Entre de novo: o carrinho continua aqui.";

/**
 * O que fazer com a resposta do envio:
 * - `sent`: chegou; o carrinho esvazia.
 * - `refused`: o servidor respondeu que não; o carrinho continua e pode mudar.
 * - `uncertain`: a resposta não veio (rede caiu no meio). O carrinho fica travado até o garçom
 *   tocar em Enviar de novo e receber a resposta; o mesmo envio nunca vira dois pedidos.
 */
export type SendOutcome<T> =
  | { kind: "sent"; data: T }
  | { kind: "refused"; code: string; message: string; details: Record<string, unknown> }
  | { kind: "uncertain" };

export async function send<T>(call: () => Promise<ActionState<T>>): Promise<SendOutcome<T>> {
  try {
    const r = await call();
    if (!r) return { kind: "uncertain" };
    if (r.ok) return { kind: "sent", data: r.data };
    return { kind: "refused", code: r.error.code, message: r.error.message, details: r.error.details ?? {} };
  } catch {
    return { kind: "uncertain" };
  }
}

/** Sem rede antes de enviar: nada sai do aparelho. */
export const isOffline = (): boolean => typeof navigator !== "undefined" && navigator.onLine === false;
