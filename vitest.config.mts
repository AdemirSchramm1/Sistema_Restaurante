import { defineConfig } from "vitest/config";
import path from "node:path";

const alias = { "@": path.resolve(import.meta.dirname, "src") };

/**
 * Régua da spec 013 (TDD-008), usada por `pnpm test:menu` (`--mode menu`): o código novo da edição
 * do cardápio tem 100% de linhas, desvios e funções cobertos, somando unidade e integração.
 */
const menuCoverage = {
  provider: "v8" as const,
  include: [
    "src/domain/menu/**/*.ts",
    "src/application/menu/**/*.ts",
    "src/components/menu/**/*.{ts,tsx}",
    "src/components/ordering/{section-bar,product-card,product-photo}.tsx",
    "src/infra/photos/**/*.ts",
    "src/infra/db/repositories/menu-repository.ts",
  ],
  exclude: ["**/*.test.{ts,tsx}"],
  thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
  reportsDirectory: "coverage/menu",
};

export default defineConfig(({ mode }) => ({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
    // Régua por pasta (spec 012, FR-012). Os casos de uso são cobertos pelos testes de integração;
    // aqui entram o domínio, os componentes de tela e os leitores de formulário.
    coverage:
      mode === "menu"
        ? menuCoverage
        : {
            provider: "v8" as const,
            include: ["src/domain/**/*.ts", "src/components/**/*.{ts,tsx}", "src/application/**/*-input.ts"],
            exclude: ["**/*.test.{ts,tsx}"],
            thresholds: {
              "src/domain/**": { lines: 95, branches: 90, functions: 95 },
              "src/components/**": { lines: 90, branches: 80 },
              "src/application/**": { lines: 90, branches: 80 },
            },
          },
  },
}));
