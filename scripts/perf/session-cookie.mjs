// Cria um restaurante novo pela tela /criar-conta e imprime o cookie da sessão do gerente.
// Uso: node scripts/perf/session-cookie.mjs > /tmp/cookie.txt   (BASE_URL muda o endereço do app)
import { chromium } from "@playwright/test";

const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/criar-conta");
  await page.getByLabel("Nome do restaurante").fill("Restaurante Medida");
  await page.getByLabel("Seu nome").fill("Gerente");
  await page.getByLabel("E-mail").fill(`medida-${Date.now()}@teste.com.br`);
  await page.getByLabel("Senha").fill("senha-forte-123");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await page.waitForURL(/\/estoque\/itens/);
  const cookies = await context.cookies();
  console.log(cookies.map((c) => `${c.name}=${c.value}`).join("; "));
} finally {
  await browser.close();
}
