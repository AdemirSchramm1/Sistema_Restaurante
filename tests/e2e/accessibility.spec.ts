import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./helpers";

/** Falhas graves de acessibilidade (WCAG 2.1 A e AA) numa página. */
async function seriousViolations(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.help} → ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
    );
}

test("páginas públicas sem falhas graves de acessibilidade", async ({ page }) => {
  for (const path of ["/entrar", "/criar-conta", "/recuperar-senha"]) {
    await page.goto(path);
    expect(await seriousViolations(page), path).toEqual([]);
  }
});

test("telas do estoque e da equipe sem falhas graves de acessibilidade", async ({ page }) => {
  await signUp(page, "Restaurante Acessível");
  expect(await seriousViolations(page), "/estoque/locais (primeiro acesso)").toEqual([]);
  await page.getByRole("button", { name: "Criar locais marcados" }).click();
  await page.getByRole("heading", { name: "Câmara de carnes" }).waitFor();

  await page.goto("/estoque/itens/novo");
  expect(await seriousViolations(page), "/estoque/itens/novo").toEqual([]);
  await page.getByLabel("Descrição").fill("Arroz agulhinha, fardo 30 kg");
  await page.getByLabel("Grupo e subgrupo").selectOption({ index: 1 });
  await page.getByLabel("Unidade de compra (embalagem)").fill("Fardo 30 kg");
  await page.getByLabel(/Fator: quantos/).fill("30");
  await page.getByRole("button", { name: "Cadastrar item" }).click();
  await page.getByText(/Item cadastrado com o código/).waitFor();
  expect(await seriousViolations(page), "detalhe do item").toEqual([]);

  for (const path of ["/estoque/itens", "/estoque/grupos", "/equipe", "/estoque/locais"]) {
    await page.goto(path);
    expect(await seriousViolations(page), path).toEqual([]);
  }
  await page.getByRole("link", { name: "Folha de contagem" }).first().click();
  await page.getByRole("heading", { name: /Folha de contagem/ }).waitFor();
  expect(await seriousViolations(page), "folha de contagem").toEqual([]);
});
