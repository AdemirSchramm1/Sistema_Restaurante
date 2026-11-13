import { expect, test, type Page } from "@playwright/test";
import { login, seedMenu } from "../support/seed";

/** Roteiro do quickstart da spec 013: gerente e chef editam o cardápio. */
const sectionTitles = (page: Page) =>
  page.locator("main").getByRole("heading", { level: 2 }).allTextContents();

test("chef organiza o cardápio em seções; estoquista não entra (spec 013, US2)", async ({
  page,
  browser,
}) => {
  const s = seedMenu("plain");
  await login(page, s.chef, s.password);
  await page.getByRole("link", { name: "Cardápio", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Cardápio" })).toBeVisible();
  expect(await sectionTitles(page)).toEqual(["Outros"]);

  const create = page.getByRole("form", { name: "Nova seção" });
  for (const name of ["Entradas", "Lanches", "Bebidas"]) {
    await create.getByLabel("Nome da seção nova").fill(name);
    await create.getByRole("button", { name: "Criar seção" }).click();
    await expect(page.getByRole("region", { name })).toBeVisible();
  }
  expect(await sectionTitles(page)).toEqual(["Entradas", "Lanches", "Bebidas", "Outros"]);

  await create.getByLabel("Nome da seção nova").fill("lanches");
  await create.getByRole("button", { name: "Criar seção" }).click();
  await expect(create.getByRole("alert")).toHaveText("Já existe a seção Lanches.");
  await expect(create.getByLabel("Nome da seção nova")).toHaveValue("lanches");

  const entradas = page.getByRole("region", { name: "Entradas" });
  await entradas.getByText("Renomear ou apagar").click();
  await entradas.getByLabel("Nome da seção Entradas").fill("Petiscos");
  await entradas.getByRole("button", { name: "Salvar nome" }).click();
  await expect(page.getByRole("region", { name: "Petiscos" })).toBeVisible();

  await page.getByRole("button", { name: "Subir Bebidas" }).click();
  await expect.poll(() => sectionTitles(page)).toEqual(["Petiscos", "Bebidas", "Lanches", "Outros"]);
  await expect(page.getByRole("button", { name: "Subir Petiscos" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Descer Lanches" })).toBeDisabled();

  // O quadro "Renomear ou apagar" continua aberto depois de salvar o nome.
  const petiscos = page.getByRole("region", { name: "Petiscos" });
  await petiscos.getByRole("button", { name: "Apagar Petiscos" }).click();
  await expect(petiscos.getByText("Petiscos não tem produtos")).toBeVisible();
  await petiscos.getByRole("button", { name: "Apagar seção" }).click();
  await expect.poll(() => sectionTitles(page)).toEqual(["Bebidas", "Lanches", "Outros"]);

  const other = await browser.newContext();
  const stock = await other.newPage();
  await login(stock, s.stockkeeper, s.password);
  await expect(stock.getByRole("link", { name: "Cardápio", exact: true })).toHaveCount(0);
  await stock.goto("/pedidos/cardapio");
  await expect(stock.getByRole("heading", { name: "Sem acesso" })).toBeVisible();
  await other.close();
});

test("chef escolhe a ordem dos produtos da seção (spec 013, US3)", async ({ page }) => {
  const s = seedMenu("board");
  await login(page, s.chef, s.password);
  await page.goto("/pedidos/cardapio");
  const lanches = page.getByRole("region", { name: "Lanches" });
  const names = () => lanches.getByRole("listitem").getByRole("link").allTextContents();
  expect((await names()).slice(0, 3)).toEqual([
    "X-Burger",
    "X-Burger duplo com bacon crocante, cheddar, cebola caramelizada e molho",
    "X-Salada",
  ]);
  await expect(lanches.getByRole("button", { name: "Subir X-Burger", exact: true })).toBeDisabled();
  await expect(lanches.getByRole("button", { name: "Descer X-Bacon" })).toBeDisabled();

  await lanches.getByRole("button", { name: "Subir X-Salada" }).click();
  await expect.poll(async () => (await names())[1]).toBe("X-Salada");

  // Só com o teclado: foco no botão e Enter.
  await lanches.getByRole("button", { name: "Subir X-Salada" }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await names())[0]).toBe("X-Salada");
  await expect(lanches.getByRole("button", { name: "Subir X-Salada" })).toBeDisabled();

  await page.reload();
  expect((await names())[0]).toBe("X-Salada");
});

test("chef põe foto, descrição e seção no produto (spec 013, US1)", async ({ page }) => {
  const s = seedMenu("board");
  await login(page, s.chef, s.password);
  await page.goto("/pedidos/cardapio");
  await page.getByRole("link", { name: "Água", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Água" })).toBeVisible();

  const photo = page.getByRole("region", { name: "Foto" });
  await expect(photo.getByText("Sem foto")).toBeVisible();

  // Arquivos que não servem: a mensagem aparece e nada é enviado.
  const pick = photo.getByLabel("Escolher foto");
  await pick.setInputFiles("tests/screens/photos/documento.pdf");
  await expect(photo.getByRole("alert")).toHaveText("Use uma foto JPG, PNG ou WebP.");
  await pick.setInputFiles("tests/screens/photos/pequena.jpg");
  await expect(photo.getByRole("alert")).toHaveText(
    "Essa foto é pequena e vai ficar borrada no cardápio. Use uma foto de pelo menos 600 px.",
  );
  await pick.setInputFiles({
    name: "enorme.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(photo.getByRole("alert")).toHaveText("A foto pode ter até 10 MB.");
  await expect(photo.getByText("Sem foto")).toBeVisible();

  // Foto de verdade: prévia no recorte do cartão, depois Salvar foto.
  await pick.setInputFiles("tests/screens/photos/camera.jpg");
  const preview = photo.getByRole("img", { name: "Prévia da foto nova" });
  await expect(preview).toBeVisible();
  const box = (await preview.boundingBox())!;
  expect(Math.abs(box.width / box.height - 4 / 3)).toBeLessThan(0.01);
  await photo.getByRole("button", { name: "Salvar foto" }).click();
  await expect(photo.getByRole("status")).toHaveText("Foto salva");
  const saved = photo.getByRole("img", { name: "Foto de Água" });
  await expect(saved).toBeVisible();
  await expect.poll(() => saved.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // Descrição e seção.
  const details = page.getByRole("form", { name: "Descrição e seção" });
  await details.getByLabel("Seção").selectOption({ label: "Lanches" });
  await details.getByLabel("Descrição").fill("  Sem gás, 500 ml.\nBem gelada.  ");
  await details.getByRole("button", { name: "Salvar descrição e seção" }).click();
  await expect(details.getByRole("status")).toHaveText("Salvo");

  // Mudar de novo logo depois da foto e da primeira gravação não acusa edição de outra pessoa.
  await details.getByLabel("Descrição").fill("Sem gás, 500 ml.");
  await details.getByRole("button", { name: "Salvar descrição e seção" }).click();
  await expect(details.getByRole("status")).toHaveText("Salvo");
  await expect(details.getByRole("alert")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("form", { name: "Descrição e seção" }).getByLabel("Descrição")).toHaveValue(
    "Sem gás, 500 ml.",
  );
  await page.getByRole("link", { name: "Voltar para o Cardápio" }).click();
  const lanches = page.getByRole("region", { name: "Lanches" });
  await expect(lanches.getByRole("listitem").last().getByRole("link")).toHaveText("Água");
  await expect(lanches.getByRole("listitem").last().locator("img[data-photo]")).toBeVisible();

  // Tirar a foto pede confirmação.
  await lanches.getByRole("link", { name: "Água", exact: true }).click();
  const again = page.getByRole("region", { name: "Foto" });
  await again.getByRole("button", { name: "Tirar foto do cardápio" }).click();
  await expect(again.getByRole("group", { name: "Tirar a foto de Água do cardápio?" })).toBeVisible();
  await again.getByRole("button", { name: "Tirar a foto", exact: true }).click();
  await expect(again.getByText("Sem foto")).toBeVisible();
  await expect(again.getByRole("status")).toHaveText("Foto tirada do cardápio");
});

test("chef cria produto pela tela Cardápio e muda o preço com um carrinho aberto (spec 013, US4)", async ({
  page,
  browser,
}) => {
  const s = seedMenu("board");
  await login(page, s.chef, s.password);
  await page.goto("/pedidos/cardapio");
  await page.getByRole("link", { name: "Novo produto" }).click();
  const form = page.getByRole("form", { name: "Produto novo" });
  await form.getByLabel("Nome do produto").fill("Limonada suíça");
  await form.getByLabel("Item ou preparo da linha 1").selectOption({ index: 1 });
  await form.getByLabel("Quanto vai (linha 1)").fill("1");
  await form.getByLabel("Preço (R$)").fill("9,00");
  await form.getByLabel("Seção").selectOption({ label: "Bebidas" });
  await form.getByRole("textbox", { name: "Descrição" }).fill("Feito na hora.");
  await form.getByLabel("Escolher foto").setInputFiles("tests/screens/photos/deitada.jpg");
  await expect(form.getByRole("img", { name: "Prévia da foto" })).toBeVisible();
  await form.getByRole("button", { name: "Criar produto" }).click();

  // Volta para a tela Cardápio com o produto no fim de Bebidas, com foto e preço.
  await expect(page).toHaveURL(/\/pedidos\/cardapio$/);
  const last = page.getByRole("region", { name: "Bebidas" }).getByRole("listitem").last();
  await expect(last.getByRole("link")).toHaveText("Limonada suíça");
  await expect(last).toContainText("R$ 9,00");
  await expect(last.locator("img[data-photo]")).toBeVisible();
  await expect(last.getByText("Sem foto")).toHaveCount(0);

  // Nome repetido: o erro aparece no campo e nada é criado.
  await page.getByRole("link", { name: "Novo produto" }).click();
  await form.getByLabel("Nome do produto").fill("limonada suíça");
  await form.getByLabel("Item ou preparo da linha 1").selectOption({ index: 1 });
  await form.getByLabel("Quanto vai (linha 1)").fill("1");
  await form.getByRole("button", { name: "Criar produto" }).click();
  await expect(form.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/pedidos\/cardapio\/novo$/);

  // Cliente monta o pedido; o chef muda o preço pela tela Cardápio; o envio pede nova confirmação.
  const phone = await browser.newContext();
  const cell = await phone.newPage();
  await cell.goto(s.qrPath);
  await cell.getByRole("button", { name: "Adicionar Limonada suíça" }).click();
  await expect(cell.getByTestId("cart-total")).toHaveText("R$ 9,00");

  await page.goto("/pedidos/cardapio");
  await page.getByRole("link", { name: "Limonada suíça", exact: true }).click();
  const price = page.getByRole("form", { name: "Preço" });
  await price.getByLabel("Preço (R$)").fill("10,00");
  await price.getByRole("button", { name: "Salvar preço" }).click();
  await expect(price.getByRole("status")).toHaveText("Salvo");
  // Logo depois do preço, a descrição salva sem acusar edição de outra pessoa.
  const details = page.getByRole("form", { name: "Descrição e seção" });
  await details.getByRole("button", { name: "Salvar descrição e seção" }).click();
  await expect(details.getByRole("status")).toHaveText("Salvo");

  await cell.getByRole("button", { name: "Enviar pedido" }).click();
  const confirm = cell.getByRole("dialog", { name: "Confira o pedido" });
  await confirm.getByRole("button", { name: "Confirmar" }).click();
  await expect(confirm.getByRole("alert")).toContainText("O preço de Limonada suíça mudou para R$ 10,00.");
  await confirm.getByRole("button", { name: "Confirmar" }).click();
  await expect(cell.getByRole("status").filter({ hasText: "Pedido enviado para a cozinha" })).toContainText(
    "R$ 10,00",
  );
  await phone.close();
});

test("produto criado sem a foto chegar avisa e deixa tentar de novo (spec 013, US4)", async ({ page }) => {
  const s = seedMenu("plain");
  await login(page, s.chef, s.password);
  await page.goto("/pedidos/cardapio/novo");
  const form = page.getByRole("form", { name: "Produto novo" });
  await form.getByLabel("Nome do produto").fill("Pudim");
  await form.getByLabel("Item ou preparo da linha 1").selectOption({ index: 1 });
  await form.getByLabel("Quanto vai (linha 1)").fill("1");
  await form.getByLabel("Escolher foto").setInputFiles("tests/screens/photos/deitada.jpg");
  // A rede cai só no envio da foto.
  await page.route("**/api/cardapio/foto", (route) => route.abort());
  await form.getByRole("button", { name: "Criar produto" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Pudim" })).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toHaveText(
    "Produto salvo, mas a foto não foi enviada. Tente de novo.",
  );
  await page.unroute("**/api/cardapio/foto");
  const photo = page.getByRole("region", { name: "Foto" });
  await photo.getByLabel("Escolher foto").setInputFiles("tests/screens/photos/deitada.jpg");
  await photo.getByRole("button", { name: "Salvar foto" }).click();
  await expect(photo.getByRole("status")).toHaveText("Foto salva");
});
