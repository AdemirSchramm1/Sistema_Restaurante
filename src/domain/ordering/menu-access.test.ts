import { describe, it, expect } from "vitest";
import {
  MENU_ACCESS_MINUTES,
  SUBMIT_GRACE_SECONDS,
  accessExpiresAt,
  canSubmitWith,
  isAccessOpen,
  secondsLeft,
  shouldWarn,
} from "./menu-access";

const opened = new Date("2026-11-08T20:00:00Z");
const at = (mmss: string) => {
  const [m, s] = mmss.split(":").map(Number);
  return new Date(opened.getTime() + (m! * 60 + s!) * 1000);
};
const access = (over: { endedAt?: Date | null } = {}) => ({
  openedAt: opened,
  expiresAt: accessExpiresAt(opened),
  endedAt: over.endedAt ?? null,
});

describe("acesso ao cardápio: 20 minutos desde a leitura do QR code (spec 009, US3, FR-005)", () => {
  it("fecha 20 minutos depois da leitura", () => {
    expect(MENU_ACCESS_MINUTES).toBe(20);
    expect(accessExpiresAt(opened).toISOString()).toBe("2026-11-08T20:20:00.000Z");
  });

  it("aberto aos 19:59, fechado aos 20:00 e depois", () => {
    expect(isAccessOpen(access(), at("19:59"))).toBe(true);
    expect(isAccessOpen(access(), at("20:00"))).toBe(false);
    expect(isAccessOpen(access(), at("20:01"))).toBe(false);
  });

  it("usar o cardápio não aumenta o tempo: o prazo só depende da leitura", () => {
    expect(secondsLeft(access(), at("19:00"))).toBe(60);
  });

  it("acesso encerrado por uma nova leitura no mesmo celular fica fechado", () => {
    expect(isAccessOpen(access({ endedAt: at("05:00") }), at("06:00"))).toBe(false);
    expect(canSubmitWith(access({ endedAt: at("05:00") }), at("06:00"))).toBe(false);
  });

  it("envio confirmado no último segundo vale com 15 s de tolerância, e só isso (US3-7)", () => {
    expect(SUBMIT_GRACE_SECONDS).toBe(15);
    expect(canSubmitWith(access(), at("19:59"))).toBe(true);
    expect(canSubmitWith(access(), at("20:15"))).toBe(true);
    expect(canSubmitWith(access(), new Date(at("20:15").getTime() + 1))).toBe(false);
  });

  it("tempo restante nunca é negativo e vem do relógio do servidor", () => {
    expect(secondsLeft(access(), at("00:00"))).toBe(1200);
    expect(secondsLeft(access(), at("25:00"))).toBe(0);
  });

  it("avisa faltando 2 minutos só se houver produtos não enviados (US3-4)", () => {
    expect(shouldWarn(access(), at("18:00"), true)).toBe(true);
    expect(shouldWarn(access(), at("17:59"), true)).toBe(false);
    expect(shouldWarn(access(), at("18:30"), false)).toBe(false);
    expect(shouldWarn(access(), at("20:00"), true)).toBe(false);
  });
});
