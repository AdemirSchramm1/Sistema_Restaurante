import { describe, it, expect } from "vitest";
import { HEARTBEAT_SECONDS, LOST_AFTER_MINUTES, tabletSignal } from "./tablet-signal";

const now = new Date("2026-11-17T20:30:00Z");
const ago = (s: number) => new Date(now.getTime() - s * 1000);

describe("sinal de vida do tablet (spec 016, US4-8, R5)", () => {
  it("nunca visto, visto há poucos minutos e sem sinal acima de 10 min", () => {
    expect(tabletSignal(null, now)).toEqual({ kind: "NEVER" });
    expect(tabletSignal(ago(0), now)).toEqual({ kind: "SEEN", minutes: 0 });
    expect(tabletSignal(ago(119), now)).toEqual({ kind: "SEEN", minutes: 1 });
    expect(tabletSignal(ago(120), now)).toEqual({ kind: "SEEN", minutes: 2 });
    expect(tabletSignal(ago(10 * 60), now)).toEqual({ kind: "SEEN", minutes: 10 });
    expect(tabletSignal(ago(10 * 60 + 1), now)).toEqual({ kind: "LOST", minutes: 10 });
    expect(tabletSignal(ago(25 * 60), now)).toEqual({ kind: "LOST", minutes: 25 });
  });

  it("relógio do aparelho adiantado não dá minuto negativo", () => {
    expect(tabletSignal(new Date(now.getTime() + 5000), now)).toEqual({ kind: "SEEN", minutes: 0 });
  });

  it("o tablet dá sinal a cada minuto; sem sinal depois de 10", () => {
    expect(HEARTBEAT_SECONDS).toBe(60);
    expect(LOST_AFTER_MINUTES).toBe(10);
  });
});
