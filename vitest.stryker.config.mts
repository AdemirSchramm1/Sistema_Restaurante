import { defineConfig } from "vitest/config";
import path from "node:path";

/** Teste de mutação (specs 013 a 015): testes de unidade do domínio do cardápio, do caixa e do pedido da equipe. */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: [
      "src/domain/menu/**/*.test.ts",
      "src/domain/cash/**/*.test.ts",
      "src/domain/ordering/{kitchen-note,staff-request,reorder,similar-orders,menu-access,tablet-screen,tablet-signal,quick-add}.test.ts",
    ],
    environment: "node",
  },
});
