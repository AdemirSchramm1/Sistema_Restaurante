import { defineConfig } from "vitest/config";
import path from "node:path";

/** Teste de mutação (spec 013, TDD-008): só os testes de unidade do domínio do cardápio. */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { include: ["src/domain/menu/**/*.test.ts"], environment: "node" },
});
