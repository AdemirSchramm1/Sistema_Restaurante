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
