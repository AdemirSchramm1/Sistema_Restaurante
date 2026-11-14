import AxeBuilder from "@axe-core/playwright";
import { test as base, type Page } from "@playwright/test";
import { login, seedMenu, type Seeded, type SeedScenario } from "../support/seed";

/**
 * Dados fixos dos testes de tela (spec 013, contracts/screens.md). Cada processo de teste cria o
 * seu restaurante uma vez (pelos casos de uso, em tests/support/seed-menu.mts) e entra uma vez como
 * gerente; os testes reaproveitam a sessão.
 */
type WorkerFixtures = {
  scenario: SeedScenario;
  seeded: Seeded;
  /** Arquivo com a sessão do gerente já logado. */
  staffSession: string;
};

export const test = base.extend<{ asStaff: Page; asCustomer: Page }, WorkerFixtures>({
  scenario: ["board", { scope: "worker", option: true }],
  seeded: [
    async ({ scenario }, provide) => {
      await provide(seedMenu(scenario));
    },
    { scope: "worker" },
  ],
  staffSession: [
    async ({ browser, seeded }, provide, info) => {
      const context = await browser.newContext({ baseURL: info.project.use.baseURL });
      const page = await context.newPage();
      await login(page, seeded.manager, seeded.password);
      const file = info.project.outputDir + `/sessao-${info.workerIndex}-${info.project.name}.json`;
      await context.storageState({ path: file });
      await context.close();
      await provide(file);
    },
    { scope: "worker" },
  ],
  /** Página já logada como gerente, no tamanho e no modo de cor do teste. */
  asStaff: async ({ browser, staffSession, viewport, colorScheme }, provide, info) => {
    const context = await browser.newContext({
      baseURL: info.project.use.baseURL,
      storageState: staffSession,
      viewport,
      colorScheme,
      locale: "pt-BR",
    });
    const page = await context.newPage();
    await provide(page);
    await context.close();
  },
  /** Página de um cliente que acabou de ler o QR code da mesa 12 (acesso novo a cada teste). */
  asCustomer: async ({ browser, seeded, viewport, colorScheme }, provide, info) => {
    const context = await browser.newContext({
      baseURL: info.project.use.baseURL,
      viewport,
      colorScheme,
      locale: "pt-BR",
    });
    const page = await context.newPage();
    await page.goto(seeded.qrPath);
    await provide(page);
    await context.close();
  },
});

export { expect } from "@playwright/test";

/** Falhas graves de acessibilidade (WCAG 2.1 A e AA) na página (TDD-005). */
export async function seriousViolations(page: Page): Promise<string[]> {
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
