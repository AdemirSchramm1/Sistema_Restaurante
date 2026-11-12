import { defineConfig } from "vitest/config";
import path from "node:path";

const alias = { "@": path.resolve(import.meta.dirname, "src") };

export default defineConfig({
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
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts", "src/components/**/*.{ts,tsx}", "src/application/**/*-input.ts"],
      exclude: ["**/*.test.{ts,tsx}"],
      thresholds: {
        "src/domain/**": { lines: 95, branches: 90, functions: 95 },
        "src/components/**": { lines: 90, branches: 80 },
        "src/application/**": { lines: 90, branches: 80 },
      },
    },
  },
});
