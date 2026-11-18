import { devices, expect, test, type Page } from "@playwright/test";
import { login, seedMenu } from "../support/seed";

/**
 * Roteiro do quickstart da spec 016: o gerente cria o link do tablet da Mesa 12, o tablet liga, pede
 * sem prazo, volta sozinho ao começo e é liberado e trocado pela tela Mesas. O relógio do tablet é
 * falso (`page.clock`) para os 3 min, os 30 s e os 10 s; o servidor usa o relógio de verdade.
 */
const tabletDevice = devices["Galaxy Tab S4 landscape"];

async function tabletLink(page: Page) {
  await page.goto("/pedidos/mesas");
  const box = page.getByRole("region", { name: "Tablet da Mesa 12" });
  if (await box.getByRole("button", { name: "Criar link do tablet" }).isVisible())
    await box.getByRole("button", { name: "Criar link do tablet" }).click();
  const link = box.locator("code");
  await expect(link).toHaveText(/\/t\/[\w-]{43}$/);
  return { box, link: new URL((await link.textContent())!).pathname };
}

test("tablet da mesa: ligar, pedir sem prazo, voltar ao começo, liberar e trocar o link (spec 016)", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const s = seedMenu("board");
  await login(page, s.manager, s.password);

  // SC-003: do Criar link ao cardápio no tablet em menos de 1 minuto.
  const started = Date.now();
  const { box, link } = await tabletLink(page);
  await expect(box.getByText("Nenhum tablet ligado")).toBeVisible();
  await expect(box.getByRole("img", { name: "QR code do link do tablet da Mesa 12" })).toBeVisible();

  const tabletContext = await browser.newContext({ ...tabletDevice, locale: "pt-BR" });
  const tab = await tabletContext.newPage();
  await tab.clock.install();
  await tab.goto(link);
  await expect(tab).toHaveURL(/\/cardapio$/);
  const welcome = tab.getByRole("region", { name: "Boas-vindas" });
  await expect(welcome.getByRole("heading", { name: "Mesa 12" })).toBeVisible();
  await welcome.getByRole("button", { name: "Ver o cardápio" }).click();
  await expect(tab.getByRole("heading", { level: 1, name: "Mesa 12" })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(60_000);
  await expect(tab.getByText(/Faltam \d+ min/)).toHaveCount(0);

  // Outro aparelho com o mesmo link não liga.
  const otherContext = await browser.newContext({ ...tabletDevice, locale: "pt-BR" });
  const other = await otherContext.newPage();
  await other.goto(link);
  await expect(
    other.getByText("Este link já está ligado em outro tablet. Peça ao gerente para liberar."),
  ).toBeVisible();

  // A tela Mesas mostra o tablet ligado.
  await page.reload();
  await expect(box.getByText(/Tablet ligado desde \d\d\/\d\d \d\d:\d\d/)).toBeVisible();
  await expect(page.getByText("1 mesa com tablet ligado")).toBeVisible();

  // Pedido pelo tablet: "Pedido enviado" por 10 s e o carrinho limpo; a cozinha vê "Mesa 12 · tablet".
  const main = tab.locator("main");
  await main.getByRole("button", { name: "Pôr Suco de laranja no carrinho" }).click();
  await main.getByRole("button", { name: "Enviar pedido" }).click();
  await tab
    .getByRole("dialog", { name: "Confira o pedido" })
    .getByRole("button", { name: "Confirmar" })
    .click();
  await expect(tab.getByTestId("tablet-sent")).toBeVisible();
  await tab.clock.fastForward(11_000);
  await expect(tab.getByTestId("tablet-sent")).toHaveCount(0);
  await expect(main.getByTestId("cart-total")).toHaveText("R$ 0,00");
  await page.goto("/pedidos/cozinha");
  await expect(page.getByRole("article", { name: /Mesa 12 · tablet/ })).toBeVisible();

  // Parado 3 min com algo no carrinho: "Ainda está aí?"; 30 s depois, boas-vindas sem o carrinho.
  await main.getByRole("button", { name: "Pôr Água no carrinho" }).click();
  await tab.clock.fastForward("03:01");
  await expect(tab.getByRole("alertdialog", { name: "Ainda está aí?" })).toBeVisible();
  await tab.clock.fastForward(31_000);
  await expect(welcome).toBeVisible();
  await welcome.getByRole("button", { name: "Ver o cardápio" }).click();
  await expect(main.getByTestId("cart-total")).toHaveText("R$ 0,00");

  // SC-004: 12 horas depois (em passos de 10 min, com a checagem rodando), o pedido ainda entra.
  for (let i = 0; i < 72; i++) await tab.clock.fastForward("10:00");
  await welcome.getByRole("button", { name: "Ver o cardápio" }).click();
  await main.getByRole("button", { name: "Pôr Água no carrinho" }).click();
  await main.getByRole("button", { name: "Enviar pedido" }).click();
  await tab
    .getByRole("dialog", { name: "Confira o pedido" })
    .getByRole("button", { name: "Confirmar" })
    .click();
  await expect(tab.getByTestId("tablet-sent")).toBeVisible();

  // Liberar: o tablet mostra que foi desligado; o próximo aparelho liga.
  await page.goto("/pedidos/mesas");
  await box.getByRole("button", { name: "Liberar" }).click();
  await box.getByRole("button", { name: "Sim, liberar" }).click();
  await expect(box.getByText("Nenhum tablet ligado")).toBeVisible();
  await tab.clock.fastForward(11_000);
  // A checagem atualiza a página, que já abre com o aviso.
  await expect(tab.getByText("Este tablet foi desligado. Peça ao gerente.")).toBeVisible();
  await other.goto(link);
  await expect(other.getByRole("region", { name: "Boas-vindas" })).toBeVisible();

  // Trocar link: o antigo para de funcionar.
  await box.getByRole("button", { name: "Trocar link" }).click();
  await box.getByRole("button", { name: "Sim, trocar link" }).click();
  await expect(box.locator("code")).not.toHaveText(new RegExp(`${link}$`));
  const old = await (await browser.newContext()).newPage();
  await old.goto(link);
  await expect(old.getByText("Link inválido. Chame um garçom.")).toBeVisible();

  await tabletContext.close();
  await otherContext.close();
});
