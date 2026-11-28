import { describe, expect, it } from "vitest";
import { AUDIT_PAGE_SIZE, readAuditFilter } from "./audit-filter";

/** Spec 019, US1-2 a US1-4: o filtro vem do endereço da página. */

const today = "2026-11-28";
const USER = "0192c1f0-1111-7000-8000-000000000001";

describe("filtro da auditoria (spec 019, US1)", () => {
  it("sem nada: hoje, todos, todos os tipos, página 1", () => {
    expect(readAuditFilter({}, today)).toEqual({
      ok: true,
      value: { from: today, to: today, userId: null, type: null, deniedOnly: false, page: 1 },
    });
  });

  it("lê período, pessoa, tipo, só negadas e página", () => {
    const r = readAuditFilter(
      { de: "2026-11-01", ate: "2026-11-28", pessoa: USER, tipo: "STOCK", negadas: "1", pagina: "3" },
      today,
    );
    expect(r).toEqual({
      ok: true,
      value: { from: "2026-11-01", to: "2026-11-28", userId: USER, type: "STOCK", deniedOnly: true, page: 3 },
    });
  });

  it("período de mais de 31 dias ou ao contrário é INVALID_PERIOD no campo de", () => {
    for (const q of [
      { de: "2026-10-28", ate: "2026-11-28" },
      { de: "2026-11-28", ate: "2026-11-27" },
      { de: "28/11/2026", ate: today },
    ])
      expect(readAuditFilter(q, today)).toEqual({
        ok: false,
        error: { code: "INVALID_PERIOD", field: "de" },
      });
    expect(readAuditFilter({ de: "2026-10-29", ate: "2026-11-28" }, today).ok).toBe(true);
  });

  it("só o início ou só o fim: o outro é o mesmo dia", () => {
    expect(readAuditFilter({ de: "2026-11-20" }, today)).toMatchObject({
      value: { from: "2026-11-20", to: "2026-11-20" },
    });
    expect(readAuditFilter({ ate: "2026-11-20" }, today)).toMatchObject({
      value: { from: "2026-11-20", to: "2026-11-20" },
    });
  });

  it("pessoa que não é id, tipo fora da lista, página inválida e negadas diferente de 1 são ignorados", () => {
    expect(
      readAuditFilter({ pessoa: "joão", tipo: "NADA", pagina: "0", negadas: "sim" }, today),
    ).toMatchObject({ value: { userId: null, type: null, page: 1, deniedOnly: false } });
    expect(readAuditFilter({ pagina: "2.5" }, today)).toMatchObject({ value: { page: 1 } });
    expect(readAuditFilter({ pagina: ["2", "3"] }, today)).toMatchObject({ value: { page: 2 } });
  });

  it("página de 50", () => {
    expect(AUDIT_PAGE_SIZE).toBe(50);
  });
});
