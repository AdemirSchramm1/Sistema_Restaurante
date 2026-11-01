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
  expect(await seriousViolations(page), "/estoque/itens (primeiro acesso)").toEqual([]);

  await page.goto("/estoque/itens/novo");
  expect(await seriousViolations(page), "/estoque/itens/novo").toEqual([]);
  await page.getByLabel("Nome do item").fill("Arroz agulhinha");
  await page.getByLabel("Grupo", { exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Embalagem", { exact: true }).fill("Fardo");
  await page.getByLabel("Quanto vem em cada embalagem").fill("30");
  await page.getByRole("button", { name: "Cadastrar item" }).click();
  await page.getByText(/Item cadastrado com o código/).waitFor();
  expect(await seriousViolations(page), "detalhe do item").toEqual([]);

  for (const path of ["/estoque/itens", "/estoque/grupos", "/equipe"]) {
    await page.goto(path);
    expect(await seriousViolations(page), path).toEqual([]);
  }
});
