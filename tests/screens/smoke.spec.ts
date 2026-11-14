import { expect, test } from "@playwright/test";
import { expectNoSideScroll } from "./layout";
import { MATRIX } from "./matrix";

/**
 * Prova de fumaça das ferramentas de tela (spec 013, T010): a tela de entrar, que já existia, em
 * toda a matriz, com uma imagem de referência.
 */
for (const screen of MATRIX) {
  test.describe(screen.name, () => {
    test.use({ viewport: { width: screen.width, height: screen.height } });

    test("a tela de entrar não rola para o lado", async ({ page }) => {
      await page.goto("/entrar");
      await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
      await expectNoSideScroll(page);
    });
  });
}

test.describe("imagem de referência", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a tela de entrar no celular é a da referência", async ({ page }) => {
    await page.goto("/entrar");
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await expect(page).toHaveScreenshot("entrar-celular-iphone.png");
  });
});
