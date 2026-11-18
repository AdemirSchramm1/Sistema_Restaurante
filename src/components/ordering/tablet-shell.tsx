"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Maximize } from "lucide-react";
import type { AccessOrderView, MenuView } from "@/application/ordering/menu";
import type { TabletStatusView } from "@/application/ordering/menu-access";
import {
  STILL_THERE_SECONDS,
  openTabletScreen,
  tabletScreen,
  type TabletScreen,
  type TabletScreenEvent,
} from "@/domain/ordering/tablet-screen";
import { messageFor } from "@/components/forms/error-messages";
import { Button } from "@/components/ui/button";
import type { SubmitFn } from "./cart";
import { MenuApp } from "./menu-app";
import { StillThere } from "./still-there";
import { TabletWelcome } from "./tablet-welcome";

/** Checagem do restaurante (R5): a cada 10 s no cardápio e a cada 60 s nas boas-vindas. */
const POLL_MENU_MS = 10_000;
const POLL_WELCOME_MS = 60_000;
/** Falhas seguidas até mostrar "Sem conexão" (US5-6). */
const FAILURES_TO_OFFLINE = 2;
/** Esgotados e preços: a página inteira se atualiza a cada 5 min quando ninguém está pedindo (R5). */
const FULL_REFRESH_MS = 5 * 60_000;
const OFFLINE_TEXT = "Sem conexão com o restaurante. Chame um garçom.";

/** Mensagem que cobre o cardápio quando o tablet não pode pedir. */
const STATE_MESSAGE: Partial<Record<TabletStatusView["state"] | "UNKNOWN", string>> = {
  TABLE_INACTIVE: messageFor({ code: "TABLE_INACTIVE" }),
  ORDERING_PAUSED: messageFor({ code: "ORDERING_PAUSED" }),
  RELEASED: messageFor({ code: "TABLET_RELEASED" }),
  LINK_ROTATED: messageFor({ code: "TABLET_LINK_INVALID" }),
  UNKNOWN: messageFor({ code: "TABLET_LINK_INVALID" }),
};

const noSubscribe = () => () => {};

type WakeLockSentinelLike = { release(): Promise<void> | void };
const release = (lock: WakeLockSentinelLike) => {
  try {
    void Promise.resolve(lock.release()).catch(() => {});
  } catch {
    // Já solto pelo navegador.
  }
};

/**
 * Tablet fixo na mesa (spec 016, US5): boas-vindas, cardápio, "Ainda está aí?" e "Pedido enviado",
 * pela máquina pura de `tablet-screen.ts`. Checa o restaurante pelo `/api/cardapio/tablet`: `stamp`
 * novo atualiza a página; a conta fechada volta às boas-vindas sem nada do cliente anterior. O
 * carrinho fica só na memória da página (nada no `localStorage`, US5-7).
 */
export function TabletShell({
  menu,
  orders,
  submit,
}: {
  menu: MenuView;
  orders: AccessOrderView[];
  submit: SubmitFn;
}) {
  const router = useRouter();
  // O `router` pode mudar de identidade a cada render; a checagem não deve reiniciar por isso.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);
  const [screen, setScreen] = useState<TabletScreen>(() => openTabletScreen(Date.now()));
  const current = useRef(screen);
  /** Trocar a geração remonta o cardápio: carrinho, busca e prato aberto voltam ao começo. */
  const [generation, setGeneration] = useState(0);
  const cartItems = useRef(0);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const canFullscreen = useSyncExternalStore(
    noSubscribe,
    () => Boolean(document.fullscreenEnabled),
    () => false,
  );

  const dispatch = useCallback((ev: TabletScreenEvent) => {
    const r = tabletScreen(current.current, ev);
    if (r.clearCart) {
      cartItems.current = 0;
      setGeneration((g) => g + 1);
    }
    if (r.state !== current.current) {
      current.current = r.state;
      setScreen(r.state);
    }
  }, []);

  // Relógio da máquina: o tempo conta do último toque.
  useEffect(() => {
    const timer = setInterval(() => {
      const at = Date.now();
      setNow(at);
      dispatch({ kind: "tick", at, cartEmpty: cartItems.current === 0 });
    }, 1000);
    const touch = () => dispatch({ kind: "touch", at: Date.now() });
    window.addEventListener("pointerdown", touch, { capture: true });
    window.addEventListener("keydown", touch, { capture: true });
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", touch, { capture: true });
      window.removeEventListener("keydown", touch, { capture: true });
    };
  }, [dispatch]);

  // Checagem do restaurante.
  const seen = useRef<{ stamp?: string; tabId?: string | null; failures: number; refreshedAt?: number }>({
    failures: 0,
  });
  const check = useCallback(async () => {
    let body: (Partial<TabletStatusView> & { state: TabletStatusView["state"] | "UNKNOWN" }) | null = null;
    try {
      const res = await fetch("/api/cardapio/tablet", { cache: "no-store" });
      if (res.ok || res.status === 401) body = await res.json();
    } catch {
      body = null;
    }
    const s = seen.current;
    if (!body) {
      s.failures += 1;
      if (s.failures >= FAILURES_TO_OFFLINE) setOffline(true);
      return;
    }
    s.failures = 0;
    setOffline(false);
    setBlocked(STATE_MESSAGE[body.state] ?? null);
    const at = Date.now();
    s.refreshedAt ??= at;
    const idle =
      current.current.screen === "WELCOME" || (current.current.screen === "MENU" && cartItems.current === 0);
    const changed = body.stamp !== undefined && s.stamp !== undefined && body.stamp !== s.stamp;
    if (changed || (idle && at - s.refreshedAt >= FULL_REFRESH_MS)) {
      routerRef.current.refresh();
      s.refreshedAt = at;
    }
    if (body.stamp !== undefined) s.stamp = body.stamp;
    if (body.tabId !== undefined) {
      // A conta que estava aberta fechou (ou virou outra): nada do cliente anterior fica na tela.
      // Abrir a primeira conta (o pedido deste tablet) não limpa nada.
      if (s.tabId && body.tabId !== s.tabId) dispatch({ kind: "tabChanged", at: Date.now() });
      s.tabId = body.tabId;
    }
  }, [dispatch]);

  const atWelcome = screen.screen === "WELCOME";
  useEffect(() => {
    const first = setTimeout(() => void check(), 0);
    const timer = setInterval(() => void check(), atWelcome ? POLL_WELCOME_MS : POLL_MENU_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [atWelcome, check]);

  useEffect(() => {
    const down = () => setOffline(true);
    const up = () => void check();
    window.addEventListener("offline", down);
    window.addEventListener("online", up);
    return () => {
      window.removeEventListener("offline", down);
      window.removeEventListener("online", up);
    };
  }, [check]);

  // Tela sempre acesa enquanto o cardápio está aberto (US5-5), onde o navegador permite.
  useEffect(() => {
    if (atWelcome) return;
    let lock: WakeLockSentinelLike | null = null;
    let stopped = false;
    const request = async () => {
      const api = (
        navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> } }
      ).wakeLock;
      if (!api) return;
      try {
        const got = await api.request("screen");
        if (stopped) release(got);
        else lock = got;
      } catch {
        // Bateria fraca ou aba escondida: tenta de novo quando a aba voltar.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (lock) release(lock);
    };
  }, [atWelcome]);

  const onCartChange = useCallback((items: number) => {
    cartItems.current = items;
  }, []);
  const onSent = useCallback(() => dispatch({ kind: "sent", at: Date.now() }), [dispatch]);
  const start = () => dispatch({ kind: "touch", at: Date.now() });

  const covered = atWelcome || screen.screen === "STILL_THERE" || blocked !== null || offline;
  const stillLeft = Math.max(0, STILL_THERE_SECONDS - Math.floor((now - screen.since) / 1000));

  return (
    <>
      <div inert={covered} className="grid grid-cols-1 gap-3">
        {canFullscreen && (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                try {
                  void Promise.resolve(document.documentElement.requestFullscreen?.()).catch(() => {});
                } catch {
                  // O navegador recusou: segue sem tela cheia.
                }
              }}
            >
              <Maximize aria-hidden="true" />
              Tela cheia
            </Button>
          </div>
        )}
        <MenuApp
          key={generation}
          menu={menu}
          orders={orders}
          submit={submit}
          onSent={onSent}
          onCartChange={onCartChange}
        />
      </div>

      {screen.screen === "SENT" && (
        <div className="fixed inset-x-0 top-4 z-50 grid place-items-center px-4">
          <p
            role="status"
            data-testid="tablet-sent"
            className="rounded-full bg-success-soft px-6 py-3 text-lg font-semibold text-success-soft-foreground shadow-lg"
          >
            Pedido enviado para a cozinha
          </p>
        </div>
      )}

      {atWelcome && (
        <TabletWelcome
          restaurantName={menu.restaurantName}
          tableName={menu.tableName}
          appearance={menu.appearance}
          onStart={start}
        />
      )}

      {screen.screen === "STILL_THERE" && !blocked && !offline && (
        <StillThere secondsLeft={stillLeft} onContinue={start} />
      )}

      {(blocked || offline) && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-background/95 p-6 text-center">
          <p role="alert" className="max-w-md text-2xl font-semibold">
            {offline ? OFFLINE_TEXT : blocked}
          </p>
        </div>
      )}
    </>
  );
}
