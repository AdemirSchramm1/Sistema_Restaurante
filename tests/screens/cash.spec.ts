import type { Page } from "@playwright/test";
import { expect, seriousViolations, test } from "./fixtures";
import { expectNoClippedText, expectNoSideScroll, expectTapTargets } from "./layout";
import { COLOR_MODES, screen } from "./matrix";

/**
 * Telas do caixa do dia (spec 014, T073): Caixa, Fechar caixa (contagem), Turnos e Vendas em tablet
 * e computador; Vendas também no celular do gerente. Só asserções de layout: sem imagem de
 * referência, porque os horários do turno mudam a cada execução.
 */
const CASH_SCREENS = ["tablet-em-pe", "tablet-deitado", "computador"].map(screen);
const SALES_SCREENS = [...CASH_SCREENS, screen("celular-android")];

/** Abre o caixa do restaurante de teste, se ainda não estiver aberto (os testes dividem o turno). */
async function ensureOpen(page: Page) {
  await page.goto("/caixa");
  const bar = page.getByRole("region", { name: "Situação do caixa" });
  await expect(bar.getByText(/^Caixa (aberto|fechado)/)).toBeVisible();
  if (await bar.getByText("Caixa fechado").isVisible()) {
    await bar.getByRole("button", { name: "Abrir caixa" }).click();
    await bar.getByLabel("Troco inicial (R$)").fill("150,00");
    const reason = bar.getByLabel("Por que o troco é outro?");
    if (await reason.isVisible()) await reason.fill("Teste de tela");
    await bar
      .getByRole("form", { name: "Abrir o caixa" })
      .getByRole("button", { name: "Abrir caixa" })
      .click();
  }
  await expect(bar.getByText(/^Caixa aberto desde/)).toBeVisible();
  return bar;
}

async function checkLayout(page: Page) {
  const main = page.locator("main");
  await expectNoSideScroll(page);
  await expectNoClippedText(main);
  await expectTapTargets(main);
  expect(await seriousViolations(page)).toEqual([]);
}

for (const size of CASH_SCREENS) {
  for (const mode of COLOR_MODES) {
    test.describe(`caixa ${size.name} ${mode}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: mode });

      test("Caixa com o turno aberto e o formulário de sangria", async ({ asStaff: page }) => {
        const bar = await ensureOpen(page);
        await checkLayout(page);
        await bar.getByRole("button", { name: "Sangria" }).click();
        await expect(bar.getByRole("form", { name: "Registrar sangria" })).toBeVisible();
        await checkLayout(page);
      });

      test("Fechar caixa: a contagem com a calculadora", async ({ asStaff: page }) => {
        await ensureOpen(page);
        await page.goto("/caixa/fechar?recontar=1");
        await expect(page.getByLabel("Quantas de R$ 200", { exact: true })).toBeVisible();
        await checkLayout(page);
      });

      test("Turnos e o relatório do turno aberto", async ({ asStaff: page }) => {
        await ensureOpen(page);
        await page.goto("/caixa/turnos");
        await expect(page.getByRole("heading", { level: 1, name: "Turnos do caixa" })).toBeVisible();
        await checkLayout(page);
        await page.getByRole("table").getByRole("link").first().click();
        await expect(page.getByRole("table", { name: "Recebido por forma de pagamento" })).toBeVisible();
        await checkLayout(page);
      });
    });
  }
}

for (const size of SALES_SCREENS) {
  test.describe(`vendas ${size.name}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, colorScheme: "light" });

    test("Vendas do dia: nada cortado, nada fora da tela, tudo tocável", async ({ asStaff: page }) => {
      await page.goto("/vendas");
      await expect(page.getByRole("heading", { level: 1, name: "Vendas" })).toBeVisible();
      await checkLayout(page);
    });
  });
}
