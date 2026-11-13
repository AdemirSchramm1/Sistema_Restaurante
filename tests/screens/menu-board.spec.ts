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
import { LONG_DESCRIPTION, LONG_NAME } from "../builders/menu-data";

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

      test("tela do produto: foto em 4:3, nada cortado, tudo tocável", async ({ asStaff: page, seeded }) => {
        await page.goto(`/pedidos/cardapio/${seeded.products[LONG_NAME]}`);
        const main = page.locator("main");
        await expect(main.getByRole("heading", { level: 1, name: LONG_NAME })).toBeVisible();
        await expect(main.getByRole("form", { name: "Descrição e seção" })).toBeVisible();
        await expectNoSideScroll(page);
        await expectNoClippedText(main);
        await expectTapTargets(main);
        await expectPhotoRatio(main);
        await expectNoBrokenImage(main);
        expect(await seriousViolations(page)).toEqual([]);
        await expectReadableAt200(page, main);
      });

      test("tela do produto: prévia da foto nova e descrição acima do limite cabem na tela", async ({
        asStaff: page,
        seeded,
      }) => {
        await page.goto(`/pedidos/cardapio/${seeded.products["Água"]}`);
        const main = page.locator("main");
        const photo = main.getByRole("region", { name: "Foto" });
        await expect(photo.getByText("Sem foto")).toBeVisible();
        // A foto em pé entra na prévia já no recorte 4:3 do cartão.
        await photo.getByLabel("Escolher foto").setInputFiles("tests/screens/photos/em-pe.jpg");
        await expect(photo.getByRole("img", { name: "Prévia da foto nova" })).toBeVisible();
        await main
          .getByRole("textbox", { name: "Descrição" })
          .fill(`${LONG_DESCRIPTION} ${LONG_DESCRIPTION}`);
        await expect(main.getByText(/Passou \d+ caracteres do limite de 300/)).toBeVisible();
        await expectNoSideScroll(page);
        await expectNoClippedText(main);
        await expectTapTargets(main);
        await expectPhotoRatio(main);
        await expectNoBrokenImage(main);
        expect(await seriousViolations(page)).toEqual([]);
      });

      test("tela do produto: a confirmação de tirar a foto cabe na tela", async ({
        asStaff: page,
        seeded,
      }) => {
        await page.goto(`/pedidos/cardapio/${seeded.products[LONG_NAME]}`);
        const main = page.locator("main");
        await main.getByRole("button", { name: "Tirar foto do cardápio" }).click();
        await expect(main.getByRole("group", { name: /^Tirar a foto de/ })).toBeVisible();
        await expectNoSideScroll(page);
        await expectNoClippedText(main);
        await expectTapTargets(main);
        expect(await seriousViolations(page)).toEqual([]);
      });

      test("Ver como o cliente: botões de tamanho e moldura sem estourar a tela", async ({
        asStaff: page,
      }) => {
        await page.goto("/pedidos/cardapio/ver");
        const main = page.locator("main");
        const frame = page.frameLocator('iframe[title="Cardápio como o cliente vê"]');
        await expect(frame.getByRole("status")).toHaveText("Pré-visualização: pedidos não são enviados");
        await expect(frame.getByRole("heading", { level: 2, name: "Lanches" })).toBeVisible();
        if (screen.width >= 640) {
          await main.getByRole("button", { name: "Tablet deitado" }).click();
          await expect(main.getByRole("button", { name: "Tablet deitado" })).toHaveAttribute(
            "aria-pressed",
            "true",
          );
        } else await expect(main.getByRole("button", { name: "Tablet deitado" })).toBeHidden();
        await expectNoSideScroll(page);
        await expectNoClippedText(main);
        await expectTapTargets(main);
        expect(await seriousViolations(page)).toEqual([]);
        await expectReadableAt200(page, main);
      });

      test("cardápio em pré-visualização, em tela cheia: mesmas regras do cardápio do cliente", async ({
        asStaff: page,
      }) => {
        await page.goto("/pedidos/cardapio/ver/cliente");
        const main = page.locator("main");
        await expect(main.getByRole("status")).toHaveText("Pré-visualização: pedidos não são enviados");
        await expectNoSideScroll(page);
        await expectNoClippedText(main);
        await expectTapTargets(main);
        await expectPhotoRatio(main);
        await expectNoBrokenImage(main);
        expect(await seriousViolations(page)).toEqual([]);
        await expectReadableAt200(page, main);
      });
    });
  }
}
