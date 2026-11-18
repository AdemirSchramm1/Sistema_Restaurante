import type { Locator, Page } from "@playwright/test";
import { expect, seriousViolations, test } from "./fixtures";
import { expectNoClippedText, expectNoSideScroll, expectTapTargets } from "./layout";
import { COLOR_MODES, screen, STAFF_SCREENS } from "./matrix";

/**
 * Tablet da mesa (spec 016, US4 e US5; SC-006): boas-vindas, cardápio com o carrinho, "Ainda está
 * aí?" e "Sem conexão" nos tamanhos de tablet e no computador; o quadro **Tablet da mesa** da equipe
 * e o quadro **Aparência** nos tamanhos da equipe. As boas-vindas têm imagem de referência; o resto,
 * só regras de layout.
 */
const TABLET_SCREENS = ["tablet-em-pe", "tablet-grande-em-pe", "tablet-deitado", "computador"].map(screen);

async function checkLayout(page: Page, where: Locator) {
  await expectNoSideScroll(page);
  await expectNoClippedText(where);
  await expectTapTargets(where);
  expect(await seriousViolations(page)).toEqual([]);
}

for (const size of TABLET_SCREENS) {
  for (const mode of COLOR_MODES) {
    test.describe(`tablet ${size.name} ${mode}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: mode });

      test("boas-vindas: capa, logo, Mesa 12 e Ver o cardápio", async ({ asTablet: page, seeded }) => {
        const welcome = page.getByRole("region", { name: "Boas-vindas" });
        await expect(welcome.getByRole("heading", { level: 1, name: "Mesa 12" })).toBeVisible();
        await expect(welcome.getByRole("button", { name: "Ver o cardápio" })).toBeInViewport({ ratio: 1 });
        await checkLayout(page, welcome);
        await expect(page).toHaveScreenshot(`tablet-boas-vindas-${size.name}-${mode}.png`, {
          mask: [welcome.getByText(seeded.restaurant)],
        });
      });

      test("cardápio do tablet: sem prazo, carrinho à vista e Pedidos enviados", async ({
        asTablet: page,
      }) => {
        await page.getByRole("button", { name: "Ver o cardápio" }).click();
        const main = page.locator("main");
        await expect(main.getByRole("heading", { level: 1, name: "Mesa 12" })).toBeVisible();
        await expect(main.getByText(/Faltam \d+ min/)).toHaveCount(0);
        await main.getByRole("button", { name: "Pôr Suco de laranja no carrinho" }).click();
        if (size.layout === "grid3side" || size.layout === "grid4side")
          await expect(main.getByRole("button", { name: "Enviar pedido" })).toBeInViewport({ ratio: 1 });
        else await expect(page.getByRole("button", { name: /^Ver pedido/ })).toBeInViewport();
        await checkLayout(page, main);
      });

      test("Ainda está aí? depois de 3 minutos parado com algo no carrinho", async ({ asTablet: page }) => {
        await page.getByRole("button", { name: "Ver o cardápio" }).click();
        await page.locator("main").getByRole("button", { name: "Pôr Água no carrinho" }).click();
        await page.clock.fastForward("03:01");
        const dialog = page.getByRole("alertdialog", { name: "Ainda está aí?" });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole("button", { name: "Continuar" })).toBeFocused();
        await checkLayout(page, dialog);
      });

      test("Sem conexão com o restaurante, por cima do cardápio", async ({ asTablet: page }) => {
        await page.getByRole("button", { name: "Ver o cardápio" }).click();
        await page.context().setOffline(true);
        await page.evaluate(() => window.dispatchEvent(new Event("offline")));
        const alert = page.getByRole("alert").filter({ hasText: "Sem conexão com o restaurante" });
        await expect(alert).toBeVisible();
        await expectNoSideScroll(page);
        await expectNoClippedText(alert);
        await page.context().setOffline(false);
      });
    });
  }
}

for (const size of STAFF_SCREENS) {
  for (const mode of COLOR_MODES) {
    test.describe(`Tablet da mesa ${size.name} ${mode}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: mode });

      test("quadro Tablet da mesa na tela Mesas, com a ajuda aberta", async ({ asStaff: page }) => {
        await page.goto("/pedidos/mesas");
        const box = page.getByRole("region", { name: "Tablet da Mesa 12" });
        await expect(box.locator("code")).toHaveText(/\/t\//);
        await box.getByText("Como travar o tablet").click();
        await checkLayout(page, box);
      });

      test("quadro Aparência na tela Cardápio, com logo e capa (US1)", async ({ asStaff: page }) => {
        await page.goto("/pedidos/cardapio");
        const box = page.getByRole("region", { name: "Aparência" });
        await expect(box.getByRole("img").first()).toBeVisible();
        await checkLayout(page, box);
      });
    });
  }
}
