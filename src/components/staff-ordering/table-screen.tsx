"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ActionState } from "@/actions/_session";
import type {
  PlaceStaffOrderResult,
  StaffMenuProduct,
  StaffMenuView,
  TableOrdersView,
} from "@/application/ordering/staff-orders";
import { matchesSearch } from "@/domain/menu/search";
import { reorderLines, type ReorderSource } from "@/domain/ordering/reorder";
import { similarRecentOrders, similarText } from "@/domain/ordering/similar-orders";
import { MAX_LINE_QUANTITY } from "@/domain/ordering/order-lines";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AutoRefresh } from "@/components/ordering/auto-refresh";
import { DishOptions } from "@/components/ordering/dish-options";
import { brl } from "@/components/ordering/format";
import { KitchenNote, LineChanges } from "@/components/ordering/line-changes";
import { ProductPhoto } from "@/components/ordering/product-photo";
import {
  addToCart,
  applyPriceChanges,
  cartTotal,
  choiceKey,
  itemCount,
  lineChanges,
  lineTotal,
  quantityOf,
  removeUnavailable,
  setQuantity,
  toStaffOrderLines,
  type CartLine,
  type CartLineData,
  type PriceChanges,
  type Unavailable,
} from "@/components/ordering/cart-state";
import { cartKey, deviceStorage, loadCart, removeCart, saveCart, type SendLock } from "./cart-storage";
import { itemsText } from "./format";
import {
  isOffline,
  OFFLINE_TEXT,
  PREVIOUS_TAB_CLOSED_TEXT,
  send,
  SESSION_EXPIRED_TEXT,
  UNCERTAIN_TEXT,
} from "./send-state";
import { TableOrders } from "./table-orders";
import { useHydrated } from "./use-hydrated";

type FormAction = (prev: ActionState, form: FormData) => Promise<ActionState>;
export type PlaceFn = (input: unknown) => Promise<ActionState<PlaceStaffOrderResult>>;

type View = "menu" | "dish" | "cart" | "orders";
type Mode = "fotos" | "lista";
const MODE_KEY = "garcom:modo";

const newId = () => crypto.randomUUID();

function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "lista" ? "lista" : "fotos";
  } catch {
    return "fotos";
  }
}

/** Linha simples do produto (sem escolhas): o "+" da lista põe e o "−" tira dela. */
const plain = (p: StaffMenuProduct): CartLineData => ({
  productId: p.id,
  name: p.name,
  basePrice: p.price,
  quantity: 1,
  addons: [],
  removals: [],
  kitchenNote: null,
});

/**
 * A mesa no Lançar pedido (spec 015, US1, US3 a US6): cardápio em Fotos ou Lista com busca, tela
 * do prato com a observação, carrinho guardado no aparelho e travado quando o envio fica sem
 * resposta, resumo "Conferir: Mesa 12" com o aviso de pedido parecido, e Pedidos da mesa.
 */
type ScreenProps = {
  menu: StaffMenuView;
  orders: TableOrdersView;
  restaurantId: string;
  userId: string;
  timezone: string;
  serverNow: string;
  initialView?: "menu" | "orders";
  place: PlaceFn;
  deliver: FormAction;
  cancel: FormAction;
};

export function TableScreen(props: ScreenProps) {
  // O carrinho mora no aparelho: a tela monta depois de ler, no navegador.
  if (!useHydrated())
    return (
      <p role="status" className="text-muted-foreground">
        Abrindo a {`Mesa ${props.menu.table.name}`}…
      </p>
    );
  return <Screen {...props} />;
}

function Screen({
  menu,
  orders,
  restaurantId,
  userId,
  timezone,
  serverNow,
  initialView = "menu",
  place,
  deliver,
  cancel,
}: ScreenProps) {
  const table = menu.table;
  const key = cartKey(restaurantId, userId, table.id);
  // O carrinho desta mesa volta do aparelho (trocar de mesa, girar, sessão vencida não perdem nada).
  const [stored] = useState(() => loadCart(deviceStorage(), key, Date.now()));
  const [lines, setLines] = useState<CartLine[]>(stored?.lines ?? []);
  const [requestId, setRequestId] = useState<string>(() => stored?.clientRequestId ?? newId());
  const [tabIdSeen, setTabIdSeen] = useState<string | null>(
    stored ? stored.tabIdSeen : (menu.tab?.id ?? null),
  );
  const [lock, setLock] = useState<SendLock>(stored?.send ?? { state: "idle" });
  const [view, setView] = useState<View>(initialView);
  const [mode, setMode] = useState<Mode>(readMode);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<StaffMenuProduct | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [sent, setSent] = useState<(PlaceStaffOrderResult & { lines: number }) | null>(null);
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storage = deviceStorage();
    if (!lines.length && lock.state === "idle") removeCart(storage, key);
    else
      saveCart(storage, key, {
        lines,
        clientRequestId: requestId,
        tabIdSeen,
        savedAt: Date.now(),
        send: lock,
      });
  }, [key, lines, requestId, tabIdSeen, lock]);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  const locked = lock.state === "uncertain";
  const products = useMemo(() => menu.sections.flatMap((s) => s.products), [menu.sections]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const shown = q ? products.filter((p) => matchesSearch(p.name, q)) : null;
  const total = cartTotal(lines);
  const count = itemCount(lines);

  const change = (next: CartLine[]) => {
    if (locked) return;
    if (!lines.length && next.length) setTabIdSeen(menu.tab?.id ?? null);
    setLines(next);
    setSent(null);
  };
  const addPlain = (p: StaffMenuProduct) => change(addToCart(lines, plain(p)));
  const removePlain = (p: StaffMenuProduct) => {
    const k = choiceKey(plain(p));
    const line = lines.find((l) => l.key === k);
    if (line) change(setQuantity(lines, k, line.quantity - 1));
  };
  const chooseMode = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // Sem armazenamento: o modo vale só nesta tela.
    }
  };

  const again = (src: ReorderSource[]) => {
    const r = reorderLines(src, byId);
    change(r.lines.reduce<CartLine[]>((c, l) => addToCart(c, l), lines));
    setMessages(r.leftOut);
    setView("cart");
  };

  const startSend = () => {
    setMessages([]);
    if (isOffline()) {
      setMessages([OFFLINE_TEXT]);
      return;
    }
    const similar = similarRecentOrders({
      orders: orders.orders.map((o) => ({
        ...o,
        lines: o.lines.map((l) => ({
          recipeId: l.again.recipeId,
          productName: l.productName,
          quantity: l.quantity,
        })),
      })),
      cartRecipeIds: lines.map((l) => l.productId),
      userId,
      now: new Date(Math.max(Date.parse(serverNow), Date.now())),
    });
    setWarnings(similar.map(similarText));
    setConfirming(true);
  };

  const confirm = async () => {
    if (isOffline() && !locked) {
      setConfirming(false);
      setMessages([OFFLINE_TEXT]);
      return;
    }
    setSending(true);
    setMessages([]);
    // Trava antes de sair: se a resposta não voltar, o carrinho não muda até saber (R22).
    const pending: SendLock = { state: "uncertain", pendingSince: Date.now() };
    saveCart(deviceStorage(), key, {
      lines,
      clientRequestId: requestId,
      tabIdSeen,
      savedAt: Date.now(),
      send: pending,
    });
    const r = await send(() =>
      place({ tableId: table.id, clientRequestId: requestId, tabIdSeen, lines: toStaffOrderLines(lines) }),
    );
    setSending(false);
    setConfirming(false);
    if (r.kind === "uncertain") {
      setLock(pending);
      setMessages([UNCERTAIN_TEXT]);
      setView("cart");
      return;
    }
    setLock({ state: "idle" });
    if (r.kind === "sent") {
      setSent({ ...r.data, lines: count });
      setLines([]);
      setRequestId(newId());
      setTabIdSeen(null);
      setView("menu");
      return;
    }
    // O servidor respondeu "não": nada foi gravado; o carrinho pode mudar e o envio é outro.
    setRequestId(newId());
    const details = r.details as PriceChanges & Unavailable;
    if (r.code === "PRICE_CHANGED") {
      const next = applyPriceChanges(lines, details);
      setLines(next.lines);
      setMessages(next.messages.length ? next.messages : [r.message]);
    } else if (r.code === "PRODUCT_UNAVAILABLE" || r.code === "OPTION_UNAVAILABLE") {
      const next = removeUnavailable(lines, r.code, details);
      setLines(next.lines);
      setMessages(next.messages.length ? next.messages : [r.message]);
    } else if (r.code === "UNAUTHENTICATED") setMessages([SESSION_EXPIRED_TEXT]);
    else setMessages([r.message]);
    setView("cart");
  };

  const tabs = (
    <div role="tablist" aria-label="Mesa" className="grid grid-cols-2 gap-2">
      {(
        [
          ["menu", "Cardápio"],
          ["orders", "Pedidos da mesa"],
        ] as const
      ).map(([v, label]) => {
        const on = v === "orders" ? view === "orders" : view !== "orders";
        return (
          <Button
            key={v}
            type="button"
            role="tab"
            aria-selected={on}
            variant={on ? "default" : "outline"}
            size="lg"
            className="h-auto min-h-11 whitespace-normal"
            onClick={() => {
              setOpen(null);
              setView(v);
            }}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );

  const productRow = (p: StaffMenuProduct) => {
    const n = quantityOf(lines, p.id);
    const plainLine = lines.find((l) => l.key === choiceKey(plain(p)));
    return (
      <li key={p.id} className="flex min-h-14 items-center gap-2 border-b border-border py-1">
        <button
          type="button"
          disabled={p.soldOut}
          onClick={() => {
            setOpen(p);
            setView("dish");
          }}
          className="grid min-h-11 min-w-0 flex-1 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <span className="font-medium [overflow-wrap:anywhere]">{p.name}</span>
          <span className="text-sm text-muted-foreground">{brl(p.price)}</span>
        </button>
        {p.soldOut ? (
          <Badge tone="neutral">Esgotado hoje</Badge>
        ) : (
          <span className="flex items-center gap-1">
            {n > 0 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 min-w-11 text-lg"
                  aria-label={`Menos um ${p.name}`}
                  disabled={locked || !plainLine}
                  onClick={() => removePlain(p)}
                >
                  −
                </Button>
                <output aria-label={`No carrinho: ${p.name}`} className="w-6 text-center text-lg">
                  {n}
                </output>
              </>
            )}
            <Button
              type="button"
              className="h-11 min-w-11 text-lg"
              aria-label={`Mais um ${p.name}`}
              disabled={locked || (plainLine?.quantity ?? 0) >= MAX_LINE_QUANTITY}
              onClick={() => addPlain(p)}
            >
              +
            </Button>
          </span>
        )}
      </li>
    );
  };

  const productCard = (p: StaffMenuProduct) => (
    <li
      key={p.id}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs"
    >
      <button
        type="button"
        disabled={p.soldOut}
        aria-label={`Ver ${p.name}`}
        onClick={() => {
          setOpen(p);
          setView("dish");
        }}
        className="grid min-h-11 grid-cols-1 gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Esgotado: só a foto apaga; o texto continua legível (contraste AA). */}
        <span className={p.soldOut ? "opacity-50 grayscale" : undefined}>
          <ProductPhoto photo={p.photo} name={p.name} eager={false} />
        </span>
        <span className="font-medium [overflow-wrap:anywhere]">{p.name}</span>
      </button>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <span className={p.soldOut ? "text-muted-foreground" : "font-semibold text-primary"}>
          {brl(p.price)}
        </span>
        {p.soldOut ? (
          <Badge tone="neutral">Esgotado hoje</Badge>
        ) : (
          <Button
            type="button"
            className="h-11 min-w-11"
            aria-label={`Adicionar ${p.name}`}
            disabled={locked}
            onClick={() => addPlain(p)}
          >
            Adicionar{quantityOf(lines, p.id) ? ` (${quantityOf(lines, p.id)})` : ""}
          </Button>
        )}
      </div>
    </li>
  );

  const list = (items: StaffMenuProduct[], label: string) =>
    mode === "lista" ? (
      <ul aria-label={label} className="grid grid-cols-1">
        {items.map(productRow)}
      </ul>
    ) : (
      <ul aria-label={label} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(productCard)}
      </ul>
    );

  return (
    <div className="grid grid-cols-1 gap-4 pb-24">
      <AutoRefresh seconds={10} />
      <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <h1 className="font-display text-2xl font-semibold">Mesa {table.name}</h1>
        <Link href="/pedidos/lancar" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Trocar mesa
        </Link>
      </header>

      {sent && (
        <Alert tone="success">
          <p className="font-semibold">Pedido {sent.number} enviado para a cozinha</p>
          <p>
            Mesa {sent.tableName} · {brl(sent.total)}
          </p>
          {sent.previousTabClosed && <p>{PREVIOUS_TAB_CLOSED_TEXT}</p>}
        </Alert>
      )}
      {locked && view !== "cart" && (
        <Alert tone="warning" role="alert">
          <p>{UNCERTAIN_TEXT}</p>
          <Button type="button" size="lg" className="mt-2" onClick={() => setView("cart")}>
            Ver carrinho
          </Button>
        </Alert>
      )}

      {tabs}

      {view === "orders" && (
        <TableOrders
          view={orders}
          userId={userId}
          timezone={timezone}
          deliver={deliver}
          cancel={cancel}
          onAgain={again}
          locked={locked}
        />
      )}

      {view === "dish" && open && (
        <DishOptions
          product={open}
          staff
          onClose={() => setView("menu")}
          onAdd={(line) => {
            change(addToCart(lines, line));
            setOpen(null);
            setView("menu");
          }}
        />
      )}

      {view === "menu" && (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <Input
              type="search"
              size="lg"
              aria-label="Buscar no cardápio"
              placeholder="Buscar no cardápio"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Mostrar">
              {(
                [
                  ["fotos", "Fotos"],
                  ["lista", "Lista"],
                ] as const
              ).map(([m, label]) => (
                <Button
                  key={m}
                  type="button"
                  size="lg"
                  variant={mode === m ? "default" : "outline"}
                  aria-pressed={mode === m}
                  onClick={() => chooseMode(m)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          {shown ? (
            shown.length ? (
              list(shown, "Cardápio")
            ) : (
              <p className="text-sm text-muted-foreground">Nada com esse nome.</p>
            )
          ) : (
            menu.sections.map((s) => (
              <section key={s.id ?? "outros"} className="grid grid-cols-1 gap-2">
                {menu.showSectionTitles && <h2 className="font-display text-xl font-semibold">{s.name}</h2>}
                {list(s.products, s.name)}
              </section>
            ))
          )}
        </>
      )}

      {view === "cart" && (
        <section
          aria-label="Carrinho"
          className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4"
        >
          <h2 className="font-display text-xl font-semibold">Carrinho · Mesa {table.name}</h2>
          {messages.length > 0 && (
            <Alert tone="warning" role="alert">
              {messages.map((m) => (
                <p key={m}>{m}</p>
              ))}
            </Alert>
          )}
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada no carrinho ainda.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {lines.map((l) => (
                <li key={l.key} className="grid grid-cols-1 gap-1 border-b border-border pb-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{l.name}</span>
                    <span>{brl(lineTotal(l))}</span>
                  </div>
                  <LineChanges changes={lineChanges(l)} />
                  <KitchenNote note={l.kitchenNote} />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 min-w-11"
                      aria-label={`Menos um ${l.name}`}
                      disabled={locked}
                      onClick={() => change(setQuantity(lines, l.key, l.quantity - 1))}
                    >
                      −
                    </Button>
                    <output aria-label={`Quantidade de ${l.name}`} className="w-6 text-center">
                      {l.quantity}
                    </output>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 min-w-11"
                      aria-label={`Mais um ${l.name}`}
                      disabled={locked || l.quantity >= MAX_LINE_QUANTITY}
                      onClick={() => change(setQuantity(lines, l.key, l.quantity + 1))}
                    >
                      +
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="flex flex-wrap justify-between gap-x-3 text-lg font-semibold">
            <span>Total</span>
            <span data-testid="cart-total">{brl(total)}</span>
          </p>
          {locked ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" size="xl" disabled={sending} onClick={confirm}>
                Enviar de novo
              </Button>
              <Button type="button" size="xl" variant="outline" onClick={() => setView("orders")}>
                Ver Pedidos da mesa
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" size="xl" disabled={!lines.length} onClick={startSend}>
                Enviar pedido
              </Button>
              <Button
                type="button"
                size="xl"
                variant="ghost"
                disabled={!lines.length}
                onClick={() => {
                  change([]);
                  setMessages([]);
                }}
              >
                Limpar
              </Button>
            </div>
          )}
        </section>
      )}

      {view !== "cart" && (lines.length > 0 || locked) && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur">
          <Button
            type="button"
            size="xl"
            className="mx-auto flex h-auto min-h-12 w-full max-w-2xl justify-between whitespace-normal"
            onClick={() => setView("cart")}
          >
            <span>Carrinho · {itemsText(count)}</span>
            <span>{brl(total)}</span>
          </Button>
        </div>
      )}

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Conferir: Mesa ${table.name}`}
          className="fixed inset-0 z-50 grid place-items-end bg-overlay sm:place-items-center"
        >
          <div
            ref={confirmRef}
            tabIndex={-1}
            className="grid max-h-[90vh] w-full max-w-md grid-cols-1 gap-3 overflow-y-auto rounded-t-xl bg-background p-4 outline-none sm:rounded-xl"
          >
            <h2 className="font-display text-2xl font-semibold">Conferir: Mesa {table.name}</h2>
            <ul className="grid grid-cols-1 gap-2 text-sm">
              {lines.map((l) => (
                <li key={l.key}>
                  <div className="flex flex-wrap justify-between gap-x-2">
                    <span>
                      {l.quantity} × {l.name}
                    </span>
                    <span>{brl(lineTotal(l))}</span>
                  </div>
                  <LineChanges changes={lineChanges(l)} />
                  <KitchenNote note={l.kitchenNote} />
                </li>
              ))}
            </ul>
            <p className="flex flex-wrap justify-between gap-x-3 text-lg font-semibold">
              <span>Total</span>
              <span>{brl(total)}</span>
            </p>
            {warnings.length > 0 && (
              <Alert tone="warning" role="alert">
                {warnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
                <p className="font-semibold">Lançar mesmo assim?</p>
              </Alert>
            )}
            <Button type="button" size="xl" className="h-auto min-h-12" disabled={sending} onClick={confirm}>
              {warnings.length ? "Lançar mesmo assim" : "Confirmar"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              disabled={sending}
              onClick={() => setConfirming(false)}
            >
              Voltar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
