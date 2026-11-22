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
    // Spec 016: cardápio por largura, aparência e tablet da mesa.
    "src/domain/ordering/{menu-access,tablet-screen,tablet-signal,quick-add}.ts",
    "src/application/ordering/{tablets,menu-access,menu}.ts",
    "src/components/ordering/{menu-header,product-card,quick-add-button,section-bar,cart-panel,cart-bar,tablet-shell,tablet-welcome,still-there,table-tablet-card}.tsx",
    "src/infra/photos/**/*.ts",
    "src/infra/db/repositories/menu-repository.ts",
  ],
  exclude: ["**/*.test.{ts,tsx}"],
  thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
  reportsDirectory: "coverage/menu",
};

/**
 * Régua da spec 014 (R12), usada por `pnpm test:cash` (`--mode cash`): o código do caixa do dia
 * tem 100% de linhas, desvios e funções cobertos, somando unidade e integração.
 */
const cashCoverage = {
  provider: "v8" as const,
  include: [
    "src/domain/cash/**/*.ts",
    "src/application/cash/**/*.ts",
    "src/components/cash/**/*.{ts,tsx}",
    "src/components/sales/**/*.{ts,tsx}",
    "src/infra/db/repositories/cash-repository.ts",
    "src/infra/db/repositories/sales-repository.ts",
  ],
  exclude: ["**/*.test.{ts,tsx}"],
  thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
  reportsDirectory: "coverage/cash",
};

/**
 * Régua da spec 015 (R19), usada por `pnpm test:staff` (`--mode staff`): o código novo do pedido
 * lançado pela equipe tem 100% de linhas, desvios e funções cobertos, somando unidade e integração.
 */
const staffCoverage = {
  provider: "v8" as const,
  include: [
    "src/domain/ordering/kitchen-note.ts",
    "src/domain/ordering/staff-request.ts",
    "src/domain/ordering/reorder.ts",
    "src/domain/ordering/similar-orders.ts",
    "src/domain/menu/staff-menu.ts",
    "src/domain/menu/search.ts",
    "src/application/ordering/staff-orders.ts",
    "src/application/ordering/staff-order-input.ts",
    "src/application/ordering/save-order.ts",
    "src/components/staff-ordering/**/*.{ts,tsx}",
  ],
  exclude: ["**/*.test.{ts,tsx}"],
  thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
  reportsDirectory: "coverage/staff",
};

const focused = { menu: menuCoverage, cash: cashCoverage, staff: staffCoverage } as const;

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
      mode in focused
        ? focused[mode as keyof typeof focused]
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
