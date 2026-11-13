import { expect, seriousViolations, test } from "./fixtures";
import {
  expectNoBrokenImage,
  expectNoClippedText,
  expectNoSideScroll,
  expectPhotoRatio,
  expectReadableAt200,
  expectTapTargets,
} from "./layout";
import { COLOR_MODES, STAFF_SCREENS } from "./matrix";

/**
 * Tela Cardápio da equipe em cada tamanho da matriz e nos dois modos de cor (spec 013, US2 e
 * contracts/screens.md). O conteúdo conferido é o `main`; o casco da tela já vem da spec 012.
 */
for (const screen of STAFF_SCREENS) {
  for (const mode of COLOR_MODES) {
    test.describe(`${screen.name} ${mode}`, () => {
      test.use({ viewport: { width: screen.width, height: screen.height }, colorScheme: mode });

      test("tela Cardápio: nada cortado, nada fora da tela, tudo tocável", async ({ asStaff: page }) => {
        await page.goto("/pedidos/cardapio");
        const main = page.locator("main");
        await expect(main.getByRole("heading", { level: 2, name: "Lanches" })).toBeVisible();
        await expectNoSideScroll(page);
        await expectNoClippedText(main);
        await expectTapTargets(main);
        await expectPhotoRatio(main);
        await expectNoBrokenImage(main);
        expect(await seriousViolations(page)).toEqual([]);
        await expectReadableAt200(page, main);
      });

      test("tela Cardápio: editar a seção abre sem estourar a tela", async ({ asStaff: page }) => {
        await page.goto("/pedidos/cardapio");
        const main = page.locator("main");
        const lanches = main.getByRole("region", { name: "Lanches" });
        await lanches.getByText("Renomear ou apagar").click();
        await lanches.getByRole("button", { name: "Apagar Lanches" }).click();
        await expect(lanches.getByText("Os 4 produtos de Lanches vão para Outros")).toBeVisible();
        await expectNoSideScroll(page);
        await expectNoClippedText(main);
        await expectTapTargets(main);
      });
    });
  }
}
