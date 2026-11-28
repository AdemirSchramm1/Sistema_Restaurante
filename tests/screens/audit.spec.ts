import type { Page } from "@playwright/test";
import { expect, seriousViolations, test } from "./fixtures";
import { expectNoClippedText, expectNoSideScroll, expectTapTargets } from "./layout";
import { COLOR_MODES, screen } from "./matrix";

/**
 * Telas do gerente da spec 019 (FR-010): Auditoria, Operação pequena e Revisão da semana, nos
 * tamanhos da equipe, claro e escuro. Só asserções de layout: as horas mudam a cada execução.
 */
const SIZES = ["celular-android", "tablet-em-pe", "computador"].map(screen);

async function checkLayout(page: Page) {
  const main = page.locator("main");
  await expectNoSideScroll(page);
  await expectNoClippedText(main);
  await expectTapTargets(main);
  expect(await seriousViolations(page)).toEqual([]);
}

for (const mode of COLOR_MODES) {
  for (const size of SIZES) {
    test.describe(`auditoria ${size.name} ${mode}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: mode });

      test("Auditoria com os registros de hoje e os filtros", async ({ asStaff: page }) => {
        await page.goto("/equipe/auditoria");
        await expect(page.getByRole("heading", { level: 1, name: "Auditoria" })).toBeVisible();
        await expect(page.getByRole("search").getByLabel("Tipo de operação")).toBeVisible();
        await checkLayout(page);
        // Período inválido: o problema aparece no campo.
        await page.goto("/equipe/auditoria?de=2026-11-30&ate=2026-11-01");
        await expect(
          page.getByText("Escolha um período de até 31 dias, com o início antes do fim."),
        ).toBeVisible();
        await checkLayout(page);
      });

      test("Operação pequena com a confirmação aberta", async ({ asStaff: page }) => {
        await page.goto("/equipe/operacao-pequena");
        await expect(page.getByRole("heading", { level: 1, name: "Operação pequena" })).toBeVisible();
        await checkLayout(page);
        await page.getByRole("button", { name: /^(Ligar|Desligar) o modo$/ }).click();
        await expect(page.getByRole("button", { name: "Confirmar" })).toBeVisible();
        await checkLayout(page);
      });

      test("Revisão da semana", async ({ asStaff: page }) => {
        await page.goto("/equipe/auditoria/revisao");
        await expect(page.getByRole("heading", { level: 1, name: "Revisão da semana" })).toBeVisible();
        await expect(page.getByRole("heading", { level: 2, name: /^Semana de / })).toBeVisible();
        await checkLayout(page);
      });
    });
  }
}
