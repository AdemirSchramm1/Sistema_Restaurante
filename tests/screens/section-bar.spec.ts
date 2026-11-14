import { expect, test } from "./fixtures";
import { expectNoSideScroll, expectStickyAfterScroll, expectTapTargets } from "./layout";
import { CUSTOMER_SCREENS } from "./matrix";

/** Cardápio com 8 seções: a barra não cabe no celular e rola só dentro dela (spec 013, US6.1). */
test.use({ scenario: "sections8" });

for (const screen of CUSTOMER_SCREENS.filter((s) => s.columns === 1)) {
  test(`${screen.name}: a barra rola para o lado só dentro dela`, async ({ browser, seeded }, info) => {
    const context = await browser.newContext({
      baseURL: info.project.use.baseURL,
      viewport: { width: screen.width, height: screen.height },
      locale: "pt-BR",
    });
    const page = await context.newPage();
    await page.goto(seeded.qrPath);
    const bar = page.getByRole("navigation", { name: "Seções do cardápio" });
    await expect(bar.getByRole("link")).toHaveCount(8);
    const list = bar.locator("ul");
    expect(await list.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await expectNoSideScroll(page);
    await expectStickyAfterScroll(page, list);
    await expectTapTargets(bar);
    // A última seção é alcançável: o link rola a barra e a página.
    await bar.getByRole("link", { name: "Cervejas e drinks" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Cervejas e drinks" })).toBeInViewport();
    await expectNoSideScroll(page);
    await context.close();
  });
}
