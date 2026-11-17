import { defineConfig } from "vitest/config";
import path from "node:path";

/** Teste de mutação (specs 013 e 014): só os testes de unidade do domínio do cardápio e do caixa. */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { include: ["src/domain/menu/**/*.test.ts", "src/domain/cash/**/*.test.ts"], environment: "node" },
});
