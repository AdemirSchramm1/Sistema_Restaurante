import { describe, it, expect } from "vitest";
import {
  CART_MAX_AGE_MS,
  cartKey,
  cartsOf,
  clearAllCarts,
  forgetOtherUsers,
  loadCart,
  removeCart,
  saveCart,
  type StoredCart,
} from "./cart-storage";

class MemoryStorage {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}
const broken = {
  get length(): number {
    throw new Error("bloqueado");
  },
  key: () => {
    throw new Error("bloqueado");
  },
  getItem: () => {
    throw new Error("bloqueado");
  },
  setItem: () => {
    throw new Error("bloqueado");
  },
  removeItem: () => {
    throw new Error("bloqueado");
  },
} as unknown as Storage;

const NOW = 1_800_000_000_000;
const cart = (over: Partial<StoredCart> = {}): StoredCart => ({
  lines: [
    {
      key: "x",
      productId: "x",
      name: "X-Burger",
      basePrice: "28.00",
      quantity: 2,
      addons: [],
      removals: [],
      kitchenNote: "mal passado",
    },
  ],
  clientRequestId: "req-1",
  tabIdSeen: null,
  savedAt: NOW,
  send: { state: "idle" },
  ...over,
});

describe("carrinho do garçom guardado no aparelho (spec 015, FR-012, FR-022, R10)", () => {
  it("chave por restaurante, usuário e mesa", () => {
    expect(cartKey("r1", "joao", "mesa-12")).toBe("garcom:v1:r1:joao:mesa-12");
  });

  it("guarda e lê de volta; apaga; mais de 12 horas é descartado", () => {
    const s = new MemoryStorage() as unknown as Storage;
    const key = cartKey("r1", "joao", "m12");
    saveCart(s, key, cart());
    expect(loadCart(s, key, NOW + 60_000)).toEqual(cart());
    expect(loadCart(s, key, NOW + CART_MAX_AGE_MS + 1)).toBeNull();
    expect(s.getItem(key)).toBeNull();
    saveCart(s, key, cart());
    removeCart(s, key);
    expect(loadCart(s, key, NOW)).toBeNull();
    expect(CART_MAX_AGE_MS).toBe(12 * 60 * 60 * 1000);
  });

  it("conteúdo estragado é descartado sem quebrar", () => {
    const s = new MemoryStorage() as unknown as Storage;
    s.setItem("garcom:v1:r1:joao:m12", "{nada");
    expect(loadCart(s, "garcom:v1:r1:joao:m12", NOW)).toBeNull();
    s.setItem("garcom:v1:r1:joao:m12", JSON.stringify({ lines: "x" }));
    expect(loadCart(s, "garcom:v1:r1:joao:m12", NOW)).toBeNull();
  });

  it("carrinhos do usuário por mesa, para a grade", () => {
    const s = new MemoryStorage() as unknown as Storage;
    saveCart(s, cartKey("r1", "joao", "m12"), cart());
    saveCart(s, cartKey("r1", "joao", "m4"), cart({ lines: [] }));
    saveCart(s, cartKey("r1", "maria", "m7"), cart());
    s.setItem("outra-coisa", "1");
    const mine = cartsOf(s, "r1", "joao", NOW);
    expect([...mine.keys()].sort()).toEqual(["m12", "m4"]);
  });

  it("abrir com outro usuário apaga os carrinhos dos outros; Sair apaga todos", () => {
    const s = new MemoryStorage() as unknown as Storage;
    saveCart(s, cartKey("r1", "joao", "m12"), cart());
    saveCart(s, cartKey("r1", "maria", "m7"), cart());
    saveCart(s, cartKey("r2", "joao", "m1"), cart());
    s.setItem("tema", "escuro");
    forgetOtherUsers(s, "r1", "joao");
    expect([...(s as unknown as MemoryStorage).data.keys()].sort()).toEqual([
      "garcom:v1:r1:joao:m12",
      "tema",
    ]);
    clearAllCarts(s);
    expect([...(s as unknown as MemoryStorage).data.keys()]).toEqual(["tema"]);
  });

  it("aparelho sem armazenamento (aba anônima, bloqueado) não quebra a tela", () => {
    expect(() => saveCart(broken, "k", cart())).not.toThrow();
    expect(loadCart(broken, "k", NOW)).toBeNull();
    expect(() => removeCart(broken, "k")).not.toThrow();
    expect(() => clearAllCarts(broken)).not.toThrow();
    expect(() => forgetOtherUsers(broken, "r1", "joao")).not.toThrow();
    expect(cartsOf(broken, "r1", "joao", NOW).size).toBe(0);
    expect(loadCart(null, "k", NOW)).toBeNull();
  });
});
