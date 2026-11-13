import { execFileSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

export type Seeded = {
  restaurant: string;
  password: string;
  manager: string;
  chef: string;
  stockkeeper: string;
  /** Caminho do QR code da mesa 12 (o que a câmera do celular abre). */
  qrPath: string;
  sections: Record<string, string>;
  products: Record<string, string>;
};

export type SeedScenario = "plain" | "board" | "sections8" | "weight40";

/** Restaurante de teste criado pelos casos de uso (tests/support/seed-menu.mts). */
export function seedMenu(scenario: SeedScenario): Seeded {
  const out = execFileSync("node_modules/.bin/tsx", ["tests/support/seed-menu.mts", scenario], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return JSON.parse(out.trim().split("\n").at(-1)!) as Seeded;
}

/** Entra pela tela de login. */
export async function login(page: Page, email: string, password: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/entrar/);
}
