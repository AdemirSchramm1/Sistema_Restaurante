/**
 * Tela do tablet fixo na mesa (spec 016, US5; FR-006, R4): boas-vindas, cardápio, "Ainda está aí?"
 * e "Pedido enviado". Função pura: o componente manda toques, o relógio e os avisos do servidor.
 */

/** Sem toque no cardápio por este tempo: volta às boas-vindas ou pergunta se ainda está aí. */
export const IDLE_SECONDS = 180;
/** Sem resposta ao "Ainda está aí?" por este tempo: limpa o carrinho e volta às boas-vindas. */
export const STILL_THERE_SECONDS = 30;
/** "Pedido enviado para a cozinha" fica na tela por este tempo. */
export const SENT_SECONDS = 10;

export type TabletScreenName = "WELCOME" | "MENU" | "STILL_THERE" | "SENT";
/** `lastTouch`: último toque (ms); `since`: quando entrou nesta tela (ms). */
export type TabletScreen = { screen: TabletScreenName; lastTouch: number; since: number };
export type TabletScreenEvent =
  | { kind: "touch"; at: number }
  | { kind: "tick"; at: number; cartEmpty: boolean }
  | { kind: "sent"; at: number }
  /** A conta da mesa fechou ou abriu outra (R5): nada do cliente anterior fica na tela. */
  | { kind: "tabChanged"; at: number };

export const openTabletScreen = (at: number): TabletScreen => ({
  screen: "WELCOME",
  lastTouch: at,
  since: at,
});

const go = (screen: TabletScreenName, prev: TabletScreen, at: number, clearCart = false) => ({
  state: { screen, lastTouch: prev.lastTouch, since: at },
  clearCart,
});
const stay = (state: TabletScreen) => ({ state, clearCart: false });

export function tabletScreen(
  st: TabletScreen,
  ev: TabletScreenEvent,
): { state: TabletScreen; clearCart: boolean } {
  const at = ev.at;
  if (ev.kind === "tabChanged") return go("WELCOME", st, at, true);
  if (ev.kind === "sent") return go("SENT", st, at);
  if (ev.kind === "touch") {
    // No cardápio só renova o tempo; das outras telas volta ao cardápio (depois de enviar, limpo).
    return go("MENU", { ...st, lastTouch: at }, at, st.screen === "SENT");
  }
  const elapsed = (from: number) => at - from;
  switch (st.screen) {
    case "MENU":
      if (elapsed(st.lastTouch) < IDLE_SECONDS * 1000) return stay(st);
      return go(ev.cartEmpty ? "WELCOME" : "STILL_THERE", st, at);
    case "STILL_THERE":
      return elapsed(st.since) < STILL_THERE_SECONDS * 1000 ? stay(st) : go("WELCOME", st, at, true);
    case "SENT":
      return elapsed(st.since) < SENT_SECONDS * 1000
        ? stay(st)
        : go("MENU", { ...st, lastTouch: at }, at, true);
    case "WELCOME":
      return stay(st);
  }
}
