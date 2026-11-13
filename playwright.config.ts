import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  timeout: 60_000,
  // Referências de imagem dos testes de tela (spec 013, TDD-004): uma pasta por motor.
  snapshotPathTemplate: "tests/screens/__screenshots__/{projectName}/{arg}{ext}",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, threshold: 0.2, animations: "disabled", caret: "hide" },
  },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "pt-BR",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testDir: "tests/e2e",
      use: { ...devices["Desktop Chrome"], launchOptions: executablePath ? { executablePath } : {} },
    },
    // Testes de tela (spec 013): a matriz de tests/screens/matrix.ts nos dois motores. Rodam dentro
    // da imagem oficial do Playwright (pnpm test:screens), para os pixels serem os mesmos em todo lugar.
    {
      name: "telas-chromium",
      testDir: "tests/screens",
      use: { browserName: "chromium", launchOptions: executablePath ? { executablePath } : {} },
    },
    { name: "telas-webkit", testDir: "tests/screens", use: { browserName: "webkit" } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.E2E_START ?? "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
