import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const MAIL_DIR = process.env.MAIL_DIR ?? ".mail";
export const PASSWORD = "senha-forte-123";

export const uniqueEmail = (who: string) =>
  `${who}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@teste.com.br`;

/** Cria um restaurante novo pela tela e fica logado como gerente. */
export async function signUp(page: Page, restaurantName = "Restaurante E2E") {
  const email = uniqueEmail("gerente");
  await page.goto("/criar-conta");
  await page.getByLabel("Nome do restaurante").fill(restaurantName);
  await page.getByLabel("Seu nome").fill("Gerente E2E");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/estoque\/itens/);
  return email;
}

/** Último e-mail gravado pelo FileMailer para o destinatário. */
export async function lastMailTo(to: string): Promise<{ subject: string; text: string }> {
  for (let i = 0; i < 20; i++) {
    const files = (await readdir(MAIL_DIR).catch(() => [])).sort().reverse();
    for (const f of files) {
      const m = JSON.parse(await readFile(path.join(MAIL_DIR, f), "utf8")) as {
        to: string;
        subject: string;
        text: string;
      };
      if (m.to === to) return m;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`nenhum e-mail para ${to}`);
}
