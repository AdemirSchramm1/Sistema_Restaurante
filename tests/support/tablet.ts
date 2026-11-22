import { expect, type Page } from "@playwright/test";

/**
 * Sai das boas-vindas do tablet da mesa tocando em **Ver o cardápio** (spec 016, US5).
 *
 * O tablet ouve qualquer toque na janela e já vai para o cardápio, então o toque no botão funciona
 * mesmo quando o ponto do botão é tomado por outra camada no meio da troca de tela. O clique do
 * Playwright, por outro lado, desiste de tocar quando outra camada "recebe" o ponto e espera até o
 * tempo do teste acabar. Por isso o toque é forçado no lugar do botão e o teste confere o que
 * importa: as boas-vindas saíram.
 */
export async function openTabletMenu(page: Page) {
  const welcome = page.getByRole("region", { name: "Boas-vindas" });
  await welcome.getByRole("button", { name: "Ver o cardápio" }).click({ force: true });
  await expect(welcome).toHaveCount(0);
}
