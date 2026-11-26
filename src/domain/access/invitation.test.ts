import { describe, expect, it } from "vitest";
import { INVITATION_DAYS, checkInvitationUsable, invitationExpiresAt, normalizeEmail } from "./invitation";

const now = new Date("2026-10-31T12:00:00Z");

describe("convite", () => {
  it("expira em 7 dias a partir do relógio", () => {
    expect(INVITATION_DAYS).toBe(7);
    expect(invitationExpiresAt(now).toISOString()).toBe("2026-11-07T12:00:00.000Z");
  });

  it("pendente e no prazo pode ser usado", () => {
    expect(checkInvitationUsable({ status: "PENDING", expiresAt: invitationExpiresAt(now) }, now).ok).toBe(
      true,
    );
  });

  it("aceito depois do prazo → INVITATION_EXPIRED", () => {
    const later = new Date("2026-11-07T12:00:01Z");
    expect(
      checkInvitationUsable({ status: "PENDING", expiresAt: invitationExpiresAt(now) }, later),
    ).toMatchObject({
      ok: false,
      error: { code: "INVITATION_EXPIRED" },
    });
  });

  it("revogado ou já aceito → INVITATION_INVALID", () => {
    for (const status of ["REVOKED", "ACCEPTED"] as const)
      expect(checkInvitationUsable({ status, expiresAt: invitationExpiresAt(now) }, now)).toMatchObject({
        ok: false,
        error: { code: "INVITATION_INVALID" },
      });
  });

  it("normaliza o e-mail e recusa e-mail inválido", () => {
    expect(normalizeEmail("  Ana@Exemplo.COM ")).toMatchObject({ ok: true, value: "ana@exemplo.com" });
    expect(normalizeEmail("ana")).toMatchObject({ ok: false, error: { field: "email" } });
  });
});

describe("limites do convite e do e-mail (spec 018, R4)", () => {
  const exp = new Date("2026-11-07T12:00:00Z");
  const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? "OK" : r.error!.code);

  it("convite marcado como vencido diz que venceu, não que é inválido", () => {
    expect(code(checkInvitationUsable({ status: "EXPIRED", expiresAt: exp }, now))).toBe("INVITATION_EXPIRED");
    expect(code(checkInvitationUsable({ status: "REVOKED", expiresAt: exp }, now))).toBe("INVITATION_INVALID");
  });

  it("vale até o instante exato do vencimento; um milissegundo depois, venceu", () => {
    expect(code(checkInvitationUsable({ status: "PENDING", expiresAt: exp }, exp))).toBe("OK");
    const later = new Date(exp.getTime() + 1);
    expect(code(checkInvitationUsable({ status: "PENDING", expiresAt: exp }, later))).toBe("INVITATION_EXPIRED");
  });

  it("e-mail: o texto inteiro precisa ter cara de e-mail, até 254 letras, no campo email", () => {
    const at = "@x.com";
    expect(normalizeEmail("a".repeat(254 - at.length) + at)).toEqual({
      ok: true,
      value: "a".repeat(254 - at.length) + at,
    });
    for (const bad of ["a".repeat(255 - at.length) + at, "a b@x.com", "a@b.c d"]) {
      const r = normalizeEmail(bad);
      expect(r.ok, bad).toBe(false);
      expect(r.ok ? null : [r.error.code, r.error.field]).toEqual(["VALIDATION", "email"]);
    }
  });
});
