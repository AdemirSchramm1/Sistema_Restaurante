import { expect, seriousViolations, test } from "./fixtures";
import {
  expectColumns,
  expectLazyPhotos,
  expectNoBrokenImage,
  expectNoClippedText,
  expectNoSideScroll,
  expectPhotoRatio,
  expectReadableAt200,
  expectStickyAfterScroll,
  expectSurvivesRotation,
  expectTapTargets,
} from "./layout";
import { COLOR_MODES, CUSTOMER_SCREENS } from "./matrix";
import { LONG_NAME } from "../builders/menu-data";

/**
 * Cardápio do cliente em cada tela da matriz e nos dois modos de cor (spec 013, US6 e
 * contracts/screens.md). Os dados são os do cenário "board": 3 seções, produtos com e sem foto,
 * nome de 70 caracteres, descrição de 300 e um produto com adicionais e retiradas.
 */
for (const screen of CUSTOMER_SCREENS) {
  for (const mode of COLOR_MODES) {
    test.describe(`${screen.name} ${mode}`, () => {
      test.use({ viewport: { width: screen.width, height: screen.height }, colorScheme: mode });

      test("cardápio: seções, cartões nas colunas da matriz, nada cortado, tudo tocável", async ({
        asCustomer: page,
      }) => {
        const main = page.locator("main");
        await expect(main.getByRole("heading", { level: 2, name: "Lanches" })).toBeVisible();
        // Só o que o cliente pode pedir: sem preço, inativo e esgotado hoje não aparecem.
        for (const hidden of ["Café", "Sorvete", "Brownie"])
          await expect(main.getByRole("heading", { level: 3, name: hidden })).toHaveCount(0);
        await expect(main.getByRole("heading", { level: 3, name: LONG_NAME })).toBeVisible();

        await expectNoSideScroll(page);
        await expectNoClippedText(main);
        await expectTapTargets(main);
        await expectPhotoRatio(main);
        await expectNoBrokenImage(main);
        await expectColumns(
          main.getByRole("list", { name: "Lanches" }).getByRole("listitem"),
          screen.columns,
        );
        expect(await seriousViolations(page)).toEqual([]);
        await expectReadableAt200(page, main);
      });

      test("cardápio: a barra de seções fica no topo e leva à seção", async ({ asCustomer: page }) => {
        const bar = page.getByRole("navigation", { name: "Seções do cardápio" });
        await expect(bar).toBeVisible();
        await expectStickyAfterScroll(page, bar.locator("ul"));
        await bar.getByRole("link", { name: "Bebidas" }).click();
        const title = page.getByRole("heading", { level: 2, name: "Bebidas" });
        await expect(title).toBeInViewport();
        // O título não fica escondido atrás da barra.
        const [barBox, titleBox] = [(await bar.boundingBox())!, (await title.boundingBox())!];
        expect(titleBox.y).toBeGreaterThanOrEqual(barBox.y + barBox.height - 1);
        await expect(bar.getByRole("link", { name: "Bebidas" })).toHaveAttribute("aria-current", "true");
      });

      test("cardápio: fotos só carregam perto da tela e girar o aparelho mantém o carrinho", async ({
        asCustomer: page,
      }) => {
        const main = page.locator("main");
        await expectLazyPhotos(page, main.locator("img[data-photo]"));
        await page.evaluate(() => scrollTo(0, 0));
        await main.getByRole("button", { name: "Adicionar Suco de laranja" }).click();
        await main.getByRole("button", { name: "Adicionar Água" }).click();
        const total = main.getByTestId("cart-total");
        await expect(total).toHaveText("R$ 14,00");
        await expectSurvivesRotation(
          page,
          async () => (await total.textContent()) ?? "",
          main.getByRole("heading", { level: 2, name: "Bebidas" }),
        );
        await expectNoSideScroll(page);
      });

      test("tela do prato: foto maior, descrição inteira, adicionais e retiradas", async ({
        asCustomer: page,
      }) => {
        const main = page.locator("main");
        await main.getByRole("button", { name: "Adicionar X-Burger", exact: true }).click();
        const dish = main.getByRole("region", { name: "X-Burger", exact: true });
        await expect(dish.getByRole("img", { name: "X-Burger" })).toBeVisible();
        await expect(dish.getByText("Acompanha molho da casa.")).toBeVisible();
        await dish.getByRole("button", { name: "Mais Fatia de queijo" }).click();
        await dish.getByRole("button", { name: "Sem cebola" }).click();
        await expect(dish.getByTestId("dish-total")).toHaveText("R$ 31,00");

        await expectNoSideScroll(page);
        await expectNoClippedText(main);
        await expectTapTargets(main);
        await expectPhotoRatio(main);
        await expectNoBrokenImage(main);
        expect(await seriousViolations(page)).toEqual([]);
        await expectReadableAt200(page, main);

        await dish.getByRole("button", { name: "Adicionar ao pedido" }).click();
        await expect(main.getByTestId("cart-total")).toHaveText("R$ 31,00");
      });

      test("tela do prato de um produto sem foto e com descrição de 300 caracteres", async ({
        asCustomer: page,
      }) => {
        const main = page.locator("main");
        await main.getByRole("button", { name: "Ver X-Salada" }).click();
        const dish = main.getByRole("region", { name: "X-Salada" });
        await expect(dish.getByTestId("dish-description")).toBeVisible();
        await expect(dish.getByRole("img")).toHaveCount(0);
        await expectNoSideScroll(page);
        await expectNoClippedText(main);
        await expectTapTargets(main);
        await expectReadableAt200(page, main);
      });

      test("busca, carrinho, envio, Meus pedidos e tempo do acesso continuam funcionando", async ({
        asCustomer: page,
      }) => {
        const main = page.locator("main");
        await expect(main.getByText(/Faltam \d+ min/)).toBeVisible();
        await main.getByLabel("Buscar no cardápio").fill("agua");
        await expect(main.getByRole("heading", { level: 3 })).toHaveText(["Água"]);
        await expect(page.getByRole("navigation", { name: "Seções do cardápio" })).toHaveCount(0);
        await main.getByRole("button", { name: "Adicionar Água" }).click();
        await main.getByLabel("Buscar no cardápio").fill("");
        await expect(main.getByTestId("cart-total")).toHaveText("R$ 5,00");
        await expectNoSideScroll(page);
        await expectTapTargets(main);

        await main.getByRole("button", { name: "Enviar pedido" }).click();
        const confirm = page.getByRole("dialog", { name: "Confira o pedido" });
        await expect(confirm).toBeVisible();
        await expectNoSideScroll(page);
        await expectNoClippedText(confirm);
        await expectTapTargets(confirm);
        expect(await seriousViolations(page)).toEqual([]);
        await confirm.getByRole("button", { name: "Confirmar" }).click();
        const mine = main.getByRole("region", { name: "Meus pedidos" });
        // "Meus pedidos" chega na atualização automática da tela.
        await expect(mine).toContainText("R$ 5,00", { timeout: 15_000 });
        await expectNoSideScroll(page);
        await expectNoClippedText(main);
        expect(await seriousViolations(page)).toEqual([]);
      });
    });
  }
}
