import { describe, expect, it } from "vitest";
import {
  IDLE_SECONDS,
  SENT_SECONDS,
  STILL_THERE_SECONDS,
  openTabletScreen,
  tabletScreen,
  type TabletScreen,
} from "./tablet-screen";

/** Máquina da tela do tablet (spec 016, US5; FR-006, R4). Tempos em ms desde o começo. */
const s = (t: number) => t * 1000;

describe("tela do tablet (spec 016, US5)", () => {
  it("tempos da spec", () => {
    expect([IDLE_SECONDS, STILL_THERE_SECONDS, SENT_SECONDS]).toEqual([180, 30, 10]);
  });

  it("abre nas boas-vindas; tocar em Ver o cardápio leva ao cardápio", () => {
    const w = openTabletScreen(0);
    expect(w.screen).toBe("WELCOME");
    expect(tabletScreen(w, { kind: "touch", at: s(5) }).state.screen).toBe("MENU");
  });

  it("parado: 179 s continua; 180 s com carrinho vazio volta às boas-vindas; com carrinho pergunta", () => {
    const menu = tabletScreen(openTabletScreen(0), { kind: "touch", at: 0 }).state;
    expect(tabletScreen(menu, { kind: "tick", at: s(179), cartEmpty: false }).state.screen).toBe("MENU");
    expect(tabletScreen(menu, { kind: "tick", at: s(180), cartEmpty: true })).toEqual({
      state: { screen: "WELCOME", lastTouch: 0, since: s(180) },
      clearCart: false,
    });
    expect(tabletScreen(menu, { kind: "tick", at: s(180), cartEmpty: false }).state.screen).toBe(
      "STILL_THERE",
    );
  });

  it("o tempo conta do último toque, não do último tick", () => {
    let st: TabletScreen = tabletScreen(openTabletScreen(0), { kind: "touch", at: 0 }).state;
    for (let t = 10; t <= 170; t += 10)
      st = tabletScreen(st, { kind: "tick", at: s(t), cartEmpty: false }).state;
    st = tabletScreen(st, { kind: "touch", at: s(100) }).state;
    expect(tabletScreen(st, { kind: "tick", at: s(279), cartEmpty: false }).state.screen).toBe("MENU");
    expect(tabletScreen(st, { kind: "tick", at: s(280), cartEmpty: false }).state.screen).toBe("STILL_THERE");
  });

  it("Ainda está aí?: tocar volta ao cardápio com o carrinho; 30 s sem toque limpa e volta", () => {
    const menu = tabletScreen(openTabletScreen(0), { kind: "touch", at: 0 }).state;
    const asking = tabletScreen(menu, { kind: "tick", at: s(180), cartEmpty: false }).state;
    expect(tabletScreen(asking, { kind: "touch", at: s(190) })).toEqual({
      state: { screen: "MENU", lastTouch: s(190), since: s(190) },
      clearCart: false,
    });
    expect(tabletScreen(asking, { kind: "tick", at: s(209), cartEmpty: false }).state.screen).toBe(
      "STILL_THERE",
    );
    expect(tabletScreen(asking, { kind: "tick", at: s(210), cartEmpty: false })).toMatchObject({
      state: { screen: "WELCOME" },
      clearCart: true,
    });
  });

  it("depois de enviar: 10 s ou um toque voltam ao cardápio com o carrinho limpo", () => {
    const menu = tabletScreen(openTabletScreen(0), { kind: "touch", at: 0 }).state;
    const sent = tabletScreen(menu, { kind: "sent", at: s(20) }).state;
    expect(sent.screen).toBe("SENT");
    expect(tabletScreen(sent, { kind: "tick", at: s(29), cartEmpty: true }).state.screen).toBe("SENT");
    expect(tabletScreen(sent, { kind: "tick", at: s(30), cartEmpty: true })).toMatchObject({
      state: { screen: "MENU" },
      clearCart: true,
    });
    expect(tabletScreen(sent, { kind: "touch", at: s(22) })).toMatchObject({
      state: { screen: "MENU", lastTouch: s(22) },
      clearCart: true,
    });
  });

  it("a conta mudou: em qualquer tela, boas-vindas com o carrinho limpo", () => {
    const menu = tabletScreen(openTabletScreen(0), { kind: "touch", at: 0 }).state;
    const states: TabletScreen[] = [
      openTabletScreen(0),
      menu,
      tabletScreen(menu, { kind: "tick", at: s(180), cartEmpty: false }).state,
      tabletScreen(menu, { kind: "sent", at: s(1) }).state,
    ];
    for (const st of states)
      expect(tabletScreen(st, { kind: "tabChanged", at: s(300) })).toMatchObject({
        state: { screen: "WELCOME" },
        clearCart: true,
      });
  });
});
