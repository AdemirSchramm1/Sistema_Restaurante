import { defineConfig } from "vitest/config";
import path from "node:path";

/** Teste de mutação (specs 013 a 015 e 018): testes de unidade de todo o domínio. */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["src/domain/**/*.test.ts"],
    environment: "node",
  },
});
