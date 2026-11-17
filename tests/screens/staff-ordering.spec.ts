import type { Page } from "@playwright/test";
import { expect, seriousViolations, test } from "./fixtures";
import { expectNoClippedText, expectNoSideScroll, expectTapTargets } from "./layout";
import { COLOR_MODES, screen } from "./matrix";

/**
 * Lançar pedido (spec 015): a grade de mesas, a mesa em Fotos e em Lista, o carrinho com o resumo
 * "Conferir" e Pedidos da mesa, no celular e no tablet do garçom e no computador do caixa. Só
 * asserções de layout: os pedidos e os horários mudam a cada execução.
 */
const SCREENS = ["celular-pequeno", "celular-android", "tablet-em-pe", "tablet-deitado", "computador"].map(
  screen,
);

async function checkLayout(page: Page) {
  const main = page.locator("main");
  await expectNoSideScroll(page);
  await expectNoClippedText(main);
  await expectTapTargets(main);
  expect(await seriousViolations(page)).toEqual([]);
}

/** Abre a Mesa 12 pela grade, com o carrinho deste teste vazio. */
async function openTable(page: Page) {
  await page.goto("/pedidos/lancar");
  await page.evaluate(() => localStorage.clear());
  await page
    .getByRole("list", { name: "Mesas" })
    .getByRole("link", { name: /Mesa 12/ })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Mesa 12" })).toBeVisible();
}

for (const size of SCREENS) {
  for (const mode of COLOR_MODES) {
    test.describe(`lançar pedido ${size.name} ${mode}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: mode });

      test("grade de mesas", async ({ asStaff: page }) => {
        await page.goto("/pedidos/lancar");
        await expect(page.getByRole("list", { name: "Mesas" })).toBeVisible();
        await checkLayout(page);
      });

      test("mesa em Fotos e em Lista, com a barra do carrinho", async ({ asStaff: page }) => {
        await openTable(page);
        await page.getByRole("button", { name: "Fotos" }).click();
        await page.getByRole("button", { name: "Adicionar Água" }).click();
        await expect(page.getByRole("button", { name: /^Carrinho ·/ })).toBeVisible();
        await checkLayout(page);
        await page.getByRole("button", { name: "Lista" }).click();
        await expect(page.getByLabel("No carrinho: Água")).toHaveText("1");
        await checkLayout(page);
      });

      test("carrinho e o resumo Conferir", async ({ asStaff: page }) => {
        await openTable(page);
        await page.getByRole("button", { name: "Lista" }).click();
        await page.getByRole("button", { name: "Mais um Água" }).click();
        await page.getByRole("button", { name: "Mais um Suco de laranja" }).click();
        await page.getByRole("button", { name: /^Carrinho ·/ }).click();
        await expect(page.getByRole("region", { name: "Carrinho" })).toBeVisible();
        await checkLayout(page);
        await page.getByRole("button", { name: "Enviar pedido" }).click();
        await expect(page.getByRole("dialog", { name: "Conferir: Mesa 12" })).toBeVisible();
        expect(await seriousViolations(page)).toEqual([]);
      });

      test("Pedidos da mesa", async ({ asStaff: page }) => {
        await openTable(page);
        await page.getByRole("tab", { name: "Pedidos da mesa" }).click();
        await expect(page.getByRole("tab", { name: "Pedidos da mesa" })).toHaveAttribute(
          "aria-selected",
          "true",
        );
        await checkLayout(page);
      });
    });
  }
}
