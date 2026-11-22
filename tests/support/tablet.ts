import { expect, type Page } from "@playwright/test";

/** Sai das boas-vindas do tablet da mesa tocando em **Ver o cardápio** (spec 016, US5). */
export async function openTabletMenu(page: Page) {
  const welcome = page.getByRole("region", { name: "Boas-vindas" });
  await welcome.getByRole("button", { name: "Ver o cardápio" }).click();
  await expect(welcome).toHaveCount(0);
}
