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

      test("cardápio: seções, cartões nas colunas do layout, nada cortado, tudo tocável", async ({
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

      test("carrinho sempre à vista: ao lado na tela larga, barra no pé na estreita (spec 016, US3)", async ({
        asCustomer: page,
      }) => {
        const main = page.locator("main");
        await main.getByRole("button", { name: "Pôr Suco de laranja no carrinho" }).click();
        const send = main.getByRole("button", { name: "Enviar pedido" });
        const bar = page.getByTestId("cart-bar");
        if (screen.layout === "grid3side" || screen.layout === "grid4side") {
          // SC-002: total e Enviar pedido dentro da janela, sem rolar; nenhuma barra no pé.
          await expect(send).toBeInViewport({ ratio: 1 });
          await expect(main.getByTestId("cart-total")).toBeInViewport({ ratio: 1 });
          await expect(bar).toBeHidden();
          await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
          await expect(send).toBeInViewport({ ratio: 1 });
        } else {
          await expect(send).toBeHidden();
          await expect(bar.getByRole("button", { name: "Ver pedido · 1 item · R$ 9,00" })).toBeInViewport();
          // A barra não cobre o último cartão: a página reserva a altura dela.
          await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
          const last = main.locator("li[data-place]").last();
          const [barBox, lastBox] = [(await bar.boundingBox())!, (await last.boundingBox())!];
          expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(barBox.y + 1);
          await bar.getByRole("button").click();
          await expect(send).toBeInViewport({ ratio: 1 });
          await expect(page.getByRole("dialog", { name: "Seu pedido" })).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(send).toBeHidden();
        }
        await expectNoSideScroll(page);
      });

      if (screen.layout === "list" && screen.height >= 800)
        test("SC-001: pelo menos 4 pratos inteiros na tela depois do topo (spec 016)", async ({
          asCustomer: page,
        }) => {
          const main = page.locator("main");
          const first = main.getByRole("heading", { level: 2, name: "Entradas" });
          await expect(first).toBeVisible();
          // Rola até o topo sair da tela: a primeira seção fica logo abaixo da barra de seções.
          await first.evaluate((el) => el.scrollIntoView({ block: "start" }));
          const height = page.viewportSize()!.height;
          const whole = await main.locator("li[data-place]").evaluateAll(
            (cards, h) =>
              cards.filter((c) => {
                const r = c.getBoundingClientRect();
                return r.top >= 0 && r.bottom <= h;
              }).length,
            height,
          );
          expect(whole).toBeGreaterThanOrEqual(4);
        });

      test("cardápio: é o da imagem de referência", async ({ asCustomer: page, seeded }) => {
        const main = page.locator("main");
        await expect(main.getByRole("heading", { level: 2, name: "Entradas" })).toBeVisible();
        await expectNoBrokenImage(main);
        // O nome do restaurante muda a cada preparo dos dados e o tempo do acesso corre.
        await expect(page).toHaveScreenshot(`cardapio-cliente-${screen.name}-${mode}.png`, {
          mask: [main.getByText(seeded.restaurant), main.getByText(/Faltam \d+ min/)],
        });
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
        await main.getByRole("button", { name: "Pôr Suco de laranja no carrinho" }).click();
        await main.getByRole("button", { name: "Pôr Água no carrinho" }).click();
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
        await main.getByRole("button", { name: "Pôr X-Burger no carrinho", exact: true }).click();
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
        await main.getByRole("button", { name: "Pôr Água no carrinho" }).click();
        await main.getByLabel("Buscar no cardápio").fill("");
        await expect(main.getByTestId("cart-total")).toHaveText("R$ 5,00");
        await expectNoSideScroll(page);
        await expectTapTargets(main);

        // Na tela estreita o carrinho abre pela barra do pé (spec 016, US3-2).
        if (screen.layout === "list" || screen.layout === "grid3")
          await page.getByRole("button", { name: /^Ver pedido/ }).click();
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
