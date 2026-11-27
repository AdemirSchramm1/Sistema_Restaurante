import type { Page } from "@playwright/test";
import { expect, seriousViolations, test } from "./fixtures";
import { expectNoClippedText, expectNoSideScroll, expectTapTargets } from "./layout";
import { COLOR_MODES, screen } from "./matrix";

/**
 * Telas da operação (spec 018, US4 e R5): Cozinha no tablet e no computador; Garçom nos celulares e
 * no tablet; Conta da mesa (com pagamento, divisão e taxa) e Lançamentos no celular, no tablet e no
 * computador. Só asserções de layout, como no caixa: os horários mudam a cada execução.
 */
const KITCHEN = ["tablet-em-pe", "tablet-deitado", "computador"].map(screen);
const WAITER = ["celular-pequeno", "celular-android", "celular-iphone", "tablet-em-pe"].map(screen);
const DESK = ["celular-android", "tablet-em-pe", "tablet-deitado", "computador"].map(screen);

async function checkLayout(page: Page) {
  const main = page.locator("main");
  await expectNoSideScroll(page);
  await expectNoClippedText(main);
  await expectTapTargets(main);
  expect(await seriousViolations(page)).toEqual([]);
}

/** Abre o caixa do restaurante de teste, se ainda não estiver aberto: pagamento pede caixa aberto. */
async function ensureCashOpen(page: Page) {
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
}

/** Lança uma Água na Mesa 12 pela tela da equipe: abre a conta e põe o pedido na cozinha. */
async function sendOrder(page: Page) {
  await page.goto("/pedidos/lancar");
  await page.evaluate(() => localStorage.clear());
  await page
    .getByRole("list", { name: "Mesas" })
    .getByRole("link", { name: /Mesa 12/ })
    .click();
  await page.getByRole("button", { name: "Lista" }).click();
  await page.getByRole("button", { name: "Mais um Água" }).click();
  await page.getByRole("button", { name: /^Carrinho ·/ }).click();
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  const confirm = page.getByRole("dialog", { name: "Conferir: Mesa 12" });
  await confirm.getByRole("button", { name: /^(Confirmar|Lançar mesmo assim)$/ }).click();
  await expect(page.getByText(/^Pedido \d+ enviado para a cozinha$/)).toBeVisible();
}

for (const mode of COLOR_MODES) {
  for (const size of KITCHEN) {
    test.describe(`cozinha ${size.name} ${mode}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: mode });

      test("quadro com pedido recebido e o cancelamento aberto", async ({ asStaff: page }) => {
        await sendOrder(page);
        await page.goto("/pedidos/cozinha");
        const received = page.getByRole("region", { name: "Recebidos" });
        await expect(received.getByRole("article").first()).toBeVisible();
        await checkLayout(page);
        await received
          .getByRole("button", { name: /^Cancelar pedido/ })
          .first()
          .click();
        await expect(page.getByLabel("Motivo")).toBeVisible();
        await checkLayout(page);
      });
    });
  }

  for (const size of WAITER) {
    test.describe(`garçom ${size.name} ${mode}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: mode });

      test("prontos para levar com um pedido pronto", async ({ asStaff: page }) => {
        await sendOrder(page);
        await page.goto("/pedidos/cozinha");
        await page
          .getByRole("form", { name: /^Começar preparo do pedido/ })
          .first()
          .getByRole("button", { name: "Começar preparo" })
          .click();
        await page
          .getByRole("form", { name: /^Pronto: pedido/ })
          .first()
          .getByRole("button")
          .click();
        await page.goto("/pedidos/garcom");
        await expect(page.getByRole("button", { name: "Entregue" }).first()).toBeVisible();
        await checkLayout(page);
      });
    });
  }

  for (const size of DESK) {
    test.describe(`conta e lançamentos ${size.name} ${mode}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, colorScheme: mode });

      test("Conta da mesa com pagamento, divisão e taxa", async ({ asStaff: page }) => {
        await sendOrder(page);
        await page.goto("/caixa");
        await page
          .getByRole("link", { name: /Mesa 12/ })
          .first()
          .click();
        await expect(page.getByRole("heading", { level: 1, name: /^Mesa 12 · conta aberta/ })).toBeVisible();
        const pay = page.getByRole("form", { name: "Lançar pagamento" });
        await pay.getByLabel("Pix").check();
        await pay.getByLabel("Valor (R$)").fill("1,00");
        await pay.getByRole("button", { name: "Lançar pagamento" }).click();
        await expect(
          page.getByRole("button", { name: /^Tirar pagamento de R\$ 1,00/ }).first(),
        ).toBeVisible();
        await page.getByLabel("Dividir por quantas pessoas?").fill("3");
        await expect(page.getByRole("button", { name: "Pagar parte 1 de 3" })).toBeVisible();
        await expect(
          page.getByRole("region", { name: "Total da conta" }).getByText(/^Serviço/),
        ).toBeVisible();
        await checkLayout(page);
      });

      test("Lançamentos com o formulário de compra", async ({ asStaff: page }) => {
        await page.goto("/estoque/lancamentos");
        await expect(page.getByRole("heading", { level: 1, name: "Lançamentos" })).toBeVisible();
        await checkLayout(page);
        await page.getByLabel("Tipo de lançamento").selectOption({ label: "Entrada (compra)" });
        await expect(page.getByLabel("Valor total pago (R$)")).toBeVisible();
        await checkLayout(page);
      });
    });
  }
}
