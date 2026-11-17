import type { CartLine } from "@/components/ordering/cart-state";

/**
 * Carrinho do garçom guardado no aparelho (spec 015, R10, FR-012 e FR-022): um por restaurante,
 * usuário e mesa. Sobrevive à sessão vencida; some ao enviar, ao Limpar e ao Sair. Tudo aqui
 * aguenta armazenamento bloqueado (aba anônima, dados apagados): a tela funciona, só não lembra.
 */

const PREFIX = "garcom:v1:";
export const CART_MAX_AGE_MS = 12 * 60 * 60 * 1000;

/** `uncertain`: o envio saiu e a resposta não voltou; o carrinho fica travado (R22). */
export type SendLock = { state: "idle" } | { state: "uncertain"; pendingSince: number };

export type StoredCart = {
  lines: CartLine[];
  clientRequestId: string;
  /** Conta aberta quando a mesa foi aberta, para o aviso de conta fechada (R11). */
  tabIdSeen: string | null;
  savedAt: number;
  send: SendLock;
};

export const cartKey = (restaurantId: string, userId: string, tableId: string) =>
  `${PREFIX}${restaurantId}:${userId}:${tableId}`;

function keys(storage: Storage): string[] {
  const out: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k?.startsWith(PREFIX)) out.push(k);
  }
  return out;
}

/** Roda e engole o erro do armazenamento: o carrinho é conveniência, não pode quebrar a tela. */
function quietly<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

const isCart = (v: unknown): v is StoredCart =>
  typeof v === "object" &&
  v !== null &&
  Array.isArray((v as StoredCart).lines) &&
  typeof (v as StoredCart).savedAt === "number";

export function loadCart(storage: Storage | null, key: string, now: number): StoredCart | null {
  if (!storage) return null;
  return quietly(() => {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (!isCart(v) || now - v.savedAt > CART_MAX_AGE_MS) {
      storage.removeItem(key);
      return null;
    }
    return v;
  }, null);
}

export function saveCart(storage: Storage | null, key: string, cart: StoredCart): void {
  quietly(() => storage?.setItem(key, JSON.stringify(cart)), undefined);
}

export function removeCart(storage: Storage | null, key: string): void {
  quietly(() => storage?.removeItem(key), undefined);
}

/** Sair: apaga os carrinhos de todo mundo neste aparelho. */
export function clearAllCarts(storage: Storage | null): void {
  quietly(() => {
    if (storage) for (const k of keys(storage)) storage.removeItem(k);
  }, undefined);
}

/**
 * Ao abrir Lançar pedido: carrinhos de outro usuário ou restaurante são apagados, para ninguém
 * enviar o que outro garçom montou no mesmo aparelho.
 */
export function forgetOtherUsers(storage: Storage | null, restaurantId: string, userId: string): void {
  const mine = `${PREFIX}${restaurantId}:${userId}:`;
  quietly(() => {
    if (storage) for (const k of keys(storage)) if (!k.startsWith(mine)) storage.removeItem(k);
  }, undefined);
}

/** Carrinhos do usuário, por mesa (a grade mostra "Carrinho: 3 itens"). */
export function cartsOf(
  storage: Storage | null,
  restaurantId: string,
  userId: string,
  now: number,
): Map<string, StoredCart> {
  const mine = `${PREFIX}${restaurantId}:${userId}:`;
  return quietly(() => {
    const out = new Map<string, StoredCart>();
    if (!storage) return out;
    for (const k of keys(storage)) {
      if (!k.startsWith(mine)) continue;
      const c = loadCart(storage, k, now);
      if (c) out.set(k.slice(mine.length), c);
    }
    return out;
  }, new Map());
}

/** `localStorage`, ou `null` quando o navegador não deixa nem perguntar. */
export function deviceStorage(): Storage | null {
  return quietly(() => (typeof window === "undefined" ? null : window.localStorage), null);
}
