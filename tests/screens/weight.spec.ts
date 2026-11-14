import { expect, test } from "./fixtures";
import { screen } from "./matrix";

/**
 * Peso e velocidade do cardápio do cliente (spec 013, SC-004; research R12): 40 produtos com foto,
 * no iPhone, com a rede de um 4G lento. Só no Chromium, que deixa limitar a rede: o projeto
 * telas-webkit ignora este arquivo (playwright.config.ts).
 */
const IPHONE = screen("celular-iphone");
/** Perfil "4G lento": 1,6 Mbit/s para baixar, 750 kbit/s para subir, 150 ms de ida e volta. */
const SLOW_4G = {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
};

test.use({ scenario: "weight40", viewport: { width: IPHONE.width, height: IPHONE.height } });

test("40 produtos com foto no 4G lento: conteúdo em até 2 s e até 1 MB de fotos", async ({
  browser,
  seeded,
}, info) => {
  const context = await browser.newContext({
    baseURL: info.project.use.baseURL,
    viewport: { width: IPHONE.width, height: IPHONE.height },
    deviceScaleFactor: 3,
    locale: "pt-BR",
  });
  const page = await context.newPage();
  // O QR code abre o acesso e redireciona; a medida é a do cardápio já com o acesso aberto.
  await page.goto(seeded.qrPath);
  await expect(page.getByRole("heading", { level: 1, name: "Mesa 12" })).toBeVisible();
  const menuUrl = page.url();

  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  await cdp.send("Network.emulateNetworkConditions", SLOW_4G);
  const sizes = new Map<string, number>();
  const photoRequests = new Set<string>();
  cdp.on("Network.requestWillBeSent", (e) => {
    if (e.type === "Image" && /\/menu\/[^/]+\/\d+\.webp/.test(e.request.url)) photoRequests.add(e.requestId);
  });
  cdp.on("Network.loadingFinished", (e) => {
    if (photoRequests.has(e.requestId)) sizes.set(e.requestId, e.encodedDataLength);
  });

  await page.goto(menuUrl, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  const fcp = await page.evaluate(
    () => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? Number.POSITIVE_INFINITY,
  );
  const photoBytes = [...sizes.values()].reduce((a, b) => a + b, 0);
  await context.close();

  expect(photoRequests.size, "fotos pedidas no primeiro carregamento").toBeGreaterThan(0);
  expect(fcp, "primeira pintura com conteúdo (ms)").toBeLessThanOrEqual(2000);
  expect(photoBytes, "bytes de fotos no primeiro carregamento").toBeLessThanOrEqual(1024 * 1024);
});
