// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ReviewBanner } from "./review-banner";

afterEach(cleanup);

describe("aviso de revisão pendente (spec 019, US3-1 e US3-4)", () => {
  it("uma linha por semana, a mais antiga primeiro, com link para a revisão", () => {
    render(<ReviewBanner weeks={["2026-11-09", "2026-11-16"]} />);
    const lines = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(lines).toEqual([
      "Há exceções da operação pequena para revisar (semana de 09/11 a 15/11). Revisar",
      "Há exceções da operação pequena para revisar (semana de 16/11 a 22/11). Revisar",
    ]);
    expect(screen.getAllByRole("link", { name: /Revisar/ }).map((a) => a.getAttribute("href"))).toEqual([
      "/equipe/auditoria/revisao?semana=2026-11-09",
      "/equipe/auditoria/revisao?semana=2026-11-16",
    ]);
  });

  it("sem semana pendente, nada aparece", () => {
    const { container } = render(<ReviewBanner weeks={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
