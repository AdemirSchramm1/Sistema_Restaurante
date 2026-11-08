import { expect, type Locator, type Page } from "@playwright/test";
import pg from "pg";

/** Passos de cadastro usados pelos testes de pedidos (specs 009 e 010). */

export async function newItem(page: Page, name: string, unit: "kg" | "un") {
  await page.goto("/estoque/itens/novo");
  await page.getByLabel("Nome do item").fill(name);
  await page.getByLabel("Grupo", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Medida").selectOption(unit);
  await page.getByRole("button", { name: "Cadastrar item" }).click();
  await page.getByText(/Item cadastrado com o código/).waitFor();
}

/** Produto vendido com preço; devolve o endereço da página do produto. */
export async function newDish(
  page: Page,
  name: string,
  lines: { component: string; quantity: string; unit: string }[],
  price: string,
) {
  await page.goto("/estoque/produtos/novo");
  await page.getByLabel("Nome do produto").fill(name);
  for (const [i, l] of lines.entries()) {
    const n = i + 1;
    if (n > 1) await page.getByRole("button", { name: "Adicionar item ou preparo" }).click();
    await page.getByLabel(`Item ou preparo da linha ${n}`).selectOption({ label: l.component });
    await page.getByLabel(`Quanto vai (linha ${n})`).fill(l.quantity);
    await page.getByLabel(`Medida (linha ${n})`).selectOption(l.unit);
  }
  await page.getByRole("button", { name: "Cadastrar produto" }).click();
  await expect(page.getByText("Produto cadastrado.")).toBeVisible();
  await page.getByLabel("Vendo por (R$)").fill(price);
  await page.getByRole("button", { name: "Salvar preço" }).click();
  await expect(page.getByText("Preço salvo.")).toBeVisible();
  return new URL(page.url()).pathname;
}

/** Adicional novo; devolve o endereço da página dele. */
export async function newAddon(
  page: Page,
  a: { name: string; component: string; quantity: string; unit: string; price: string },
) {
  await page.goto("/pedidos/adicionais/novo");
  await page.getByLabel("Nome do botão").fill(a.name);
  await page.getByLabel("O que vai").selectOption({ label: a.component });
  await page.getByLabel("Quantidade").fill(a.quantity);
  await page.getByLabel("Medida").selectOption(a.unit);
  await page.getByLabel("Preço (R$)").fill(a.price);
  await page.getByRole("button", { name: "Criar adicional" }).click();
  await expect(page.getByText("Adicional cadastrado.")).toBeVisible();
  return new URL(page.url()).pathname;
}

/** Quadro "Adicionar e tirar" do produto. */
export async function customize(
  page: Page,
  productPath: string,
  c: { addons: { label: string; name: string; maxTimes: number }[]; removals: string[] },
) {
  await page.goto(productPath);
  const panel = page.getByRole("form", { name: "Quadro adicionar e tirar" });
  for (const a of c.addons) {
    await panel.getByLabel("Ligar adicional").selectOption({ label: a.label });
    await panel.getByRole("button", { name: "Ligar", exact: true }).click();
    await panel.getByLabel(`Até quantas vezes: ${a.name}`).selectOption(String(a.maxTimes));
  }
  for (const r of c.removals) {
    await panel.getByLabel("Deixar tirar").selectOption({ label: r });
    await panel.getByRole("button", { name: "Deixar tirar" }).click();
  }
  await panel.getByRole("button", { name: "Salvar quadro" }).click();
  await expect(panel.getByText("Quadro salvo.")).toBeVisible();
}

export async function createTables(page: Page, from: number, to: number) {
  await page.goto("/pedidos/mesas");
  const range = page.getByRole("form", { name: "Criar várias mesas" });
  await range.getByLabel("Da mesa").fill(String(from));
  await range.getByLabel("até a mesa").fill(String(to));
  await range.getByRole("button", { name: "Criar várias mesas" }).click();
  await expect(range.getByRole("status")).toContainText(`${to - from + 1} mesa`);
}

/** Cartão da mesa na tela de Mesas. */
export const tableCard = (page: Page, name: string): Locator =>
  page.getByRole("listitem").filter({ has: page.getByRole("img", { name: `QR code da Mesa ${name}`, exact: true }) });

/** Caminho do link do QR code da mesa (o mesmo que a câmera do celular abre). */
export async function qrPath(page: Page, name: string) {
  await page.goto("/pedidos/mesas");
  const href = await page.getByRole("link", { name: `Abrir o cardápio da Mesa ${name}`, exact: true }).getAttribute("href");
  expect(href).toMatch(/\/m\/[\w-]+$/);
  return new URL(href!).pathname;
}

/**
 * O servidor conta os 20 minutos com o próprio relógio; para não esperar, o teste recua no banco o
 * início dos acessos abertos da mesa (só com DATABASE_MIGRATION_URL, como na CI).
 */
export async function expireMenuAccesses(restaurantName: string, tableName: string) {
  const url = process.env.DATABASE_MIGRATION_URL;
  if (!url) return false;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(
      `update menu_accesses a
          set opened_at = a.opened_at - interval '21 minutes', expires_at = a.expires_at - interval '21 minutes'
         from dining_tables t, restaurants r
        where t.id = a.table_id and r.id = t.restaurant_id and r.name = $1 and t.name = $2 and a.ended_at is null`,
      [restaurantName, tableName],
    );
  } finally {
    await client.end();
  }
  return true;
}
