import { expect, test, type Page } from "@playwright/test";
import {
  expectColumns,
  expectLazyPhotos,
  expectNoBrokenImage,
  expectNoClippedText,
  expectNoOverlap,
  expectNoSideScroll,
  expectPhotoRatio,
  expectReadableAt200,
  expectStickyAfterScroll,
  expectSurvivesRotation,
  expectTapTargets,
} from "./layout";

/**
 * Teste das próprias asserções de layout (spec 013, TDD-003 e research R9): cada uma passa numa
 * página certa e é obrigada a falhar numa página quebrada de propósito. Sem isto, um teste de tela
 * verde não quer dizer nada.
 */

test.use({ viewport: { width: 390, height: 844 } });

const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAYAAAC09K7GAAAAEElEQVR4nGP8z8Dwn4EIAAAxKgL/yD0KxwAAAABJRU5ErkJggg==";

const html = (body: string, css = "") =>
  `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
   <meta name="viewport" content="width=device-width, initial-scale=1">
   <style>*{box-sizing:border-box}html{font-size:16px}body{margin:0;font-family:sans-serif}${css}</style></head>
   <body><main>${body}</main></body></html>`;

const show = async (page: Page, body: string, css = "") => {
  await page.setContent(html(body, css));
  return page.locator("main");
};

const fails = async (run: () => Promise<void>, message: RegExp) => {
  let error: Error | undefined;
  try {
    await run();
  } catch (e) {
    error = e as Error;
  }
  expect(error?.message ?? "a asserção passou numa página quebrada").toMatch(message);
};

test.describe("expectNoSideScroll", () => {
  test("passa quando a página cabe na largura", async ({ page }) => {
    await show(page, `<p>Cardápio</p>`);
    await expectNoSideScroll(page);
  });

  test("falha quando a página rola para o lado", async ({ page }) => {
    await show(page, `<div style="width:600px">largo demais</div>`);
    await fails(() => expectNoSideScroll(page), /rolagem para o lado/);
  });
});

test.describe("expectNoClippedText", () => {
  test("passa com texto que quebra em linhas dentro do cartão", async ({ page }) => {
    const scope = await show(
      page,
      `<article style="width:200px;border:1px solid"><h3>Hambúrguer artesanal de costela com cheddar inglês</h3></article>`,
    );
    await expectNoClippedText(scope);
  });

  test("falha com texto cortado por reticências", async ({ page }) => {
    const scope = await show(
      page,
      `<article style="width:200px"><h3 style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Hambúrguer artesanal de costela com cheddar inglês</h3></article>`,
    );
    await fails(() => expectNoClippedText(scope), /texto cortado.*Hambúrguer/s);
  });

  test("falha com texto que sai da caixa do pai que corta", async ({ page }) => {
    const scope = await show(
      page,
      `<article style="width:120px;overflow:hidden"><span style="white-space:nowrap">R$ 1.234.567,00 por pessoa</span></article>`,
    );
    await fails(() => expectNoClippedText(scope), /texto cortado/);
  });

  test("falha com texto que passa da borda da tela", async ({ page }) => {
    const scope = await show(page, `<p style="margin-left:300px;white-space:nowrap">Preço fora da tela</p>`);
    await fails(() => expectNoClippedText(scope), /fora da tela.*Preço fora da tela/s);
  });

  test("aceita o corte marcado com data-clamp (descrição do cartão)", async ({ page }) => {
    const scope = await show(
      page,
      `<article style="width:200px"><p data-clamp style="display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden">Pão brioche, carne, queijo prato e molho da casa, tudo feito aqui</p></article>`,
    );
    await expectNoClippedText(scope);
  });

  test("aceita texto dentro de área que rola de propósito", async ({ page }) => {
    const scope = await show(
      page,
      `<nav style="width:200px;overflow-x:auto;white-space:nowrap"><a href="#a">Entradas</a> <a href="#b">Lanches</a> <a href="#c">Sobremesas da casa</a></nav>`,
    );
    await expectNoClippedText(scope);
  });
});

test.describe("expectTapTargets", () => {
  test("passa com botões de 44 px", async ({ page }) => {
    const scope = await show(
      page,
      `<button style="min-height:44px;min-width:44px">Subir</button>
       <a href="#x" style="display:inline-flex;min-height:44px;min-width:44px">Abrir</a>
       <p>Texto com <a href="#y">link no meio da frase</a>, que não conta.</p>
       <input type="hidden" name="id" value="1">`,
    );
    await expectTapTargets(scope);
  });

  test("falha com botão de 30 px", async ({ page }) => {
    const scope = await show(page, `<button style="height:30px;width:80px;padding:0">Subir</button>`);
    await fails(() => expectTapTargets(scope), /menor que 44.*Subir/s);
  });

  test("falha com campo de 40 px de altura", async ({ page }) => {
    const scope = await show(page, `<input aria-label="Buscar" style="height:40px;width:200px">`);
    await fails(() => expectTapTargets(scope), /menor que 44.*Buscar/s);
  });

  test("falha com dois botões sobrepostos", async ({ page }) => {
    const scope = await show(
      page,
      `<div style="position:relative;height:60px">
         <button style="position:absolute;left:0;top:0;height:44px;width:100px">Subir</button>
         <button style="position:absolute;left:60px;top:10px;height:44px;width:100px">Descer</button>
       </div>`,
    );
    await fails(() => expectTapTargets(scope), /sobrepostos.*Subir.*Descer/s);
  });

  test("caixa de marcar conta pela área do rótulo", async ({ page }) => {
    const scope = await show(
      page,
      `<label style="display:flex;min-height:44px;align-items:center"><input type="checkbox"> Esgotado hoje</label>`,
    );
    await expectTapTargets(scope);
  });
});

test.describe("expectNoOverlap", () => {
  test("falha quando dois toques se sobrepõem, mesmo com tamanho certo", async ({ page }) => {
    const scope = await show(
      page,
      `<div style="position:relative;height:60px">
         <a href="#a" style="position:absolute;left:0;top:0;height:48px;width:120px">Entradas</a>
         <a href="#b" style="position:absolute;left:100px;top:0;height:48px;width:120px">Lanches</a>
       </div>`,
    );
    await fails(() => expectNoOverlap(scope), /sobrepostos/);
  });

  test("passa com botão dentro de cartão clicável vizinho", async ({ page }) => {
    const scope = await show(
      page,
      `<button style="height:44px;width:100px">Um</button> <button style="height:44px;width:100px">Dois</button>`,
    );
    await expectNoOverlap(scope);
  });
});

test.describe("expectPhotoRatio", () => {
  test("passa com foto 4:3 em object-fit cover e com alt", async ({ page }) => {
    const scope = await show(
      page,
      `<img data-photo alt="X-Burger" src="${PIXEL}" style="width:300px;aspect-ratio:4/3;object-fit:cover">`,
    );
    await expectPhotoRatio(scope);
  });

  test("falha com foto esticada (16:9)", async ({ page }) => {
    const scope = await show(
      page,
      `<img data-photo alt="X-Burger" src="${PIXEL}" style="width:320px;height:180px;object-fit:cover">`,
    );
    await fails(() => expectPhotoRatio(scope), /proporção.*X-Burger/s);
  });

  test("falha com foto que deforma (object-fit fill)", async ({ page }) => {
    const scope = await show(
      page,
      `<img data-photo alt="X-Burger" src="${PIXEL}" style="width:300px;height:225px;object-fit:fill">`,
    );
    await fails(() => expectPhotoRatio(scope), /object-fit/);
  });

  test("falha com foto sem texto alternativo", async ({ page }) => {
    const scope = await show(
      page,
      `<img data-photo alt="" src="${PIXEL}" style="width:300px;aspect-ratio:4/3;object-fit:cover">`,
    );
    await fails(() => expectPhotoRatio(scope), /texto alternativo/);
  });

  test("falha quando não há nenhuma foto para conferir", async ({ page }) => {
    const scope = await show(page, `<p>sem fotos</p>`);
    await fails(() => expectPhotoRatio(scope), /nenhuma foto/);
  });
});

test.describe("expectNoBrokenImage", () => {
  test("passa com imagem carregada", async ({ page }) => {
    const scope = await show(page, `<img alt="ok" src="${PIXEL}">`);
    await expectNoBrokenImage(scope);
  });

  test("falha com imagem quebrada", async ({ page }) => {
    const scope = await show(page, `<img alt="Suco" src="data:image/png;base64,AAAA">`);
    await fails(() => expectNoBrokenImage(scope), /imagem quebrada.*Suco/s);
  });
});

test.describe("expectColumns", () => {
  const grid = (columns: number) =>
    `<ul style="display:grid;grid-template-columns:repeat(${columns},1fr);gap:8px;list-style:none;padding:0;margin:0">
       ${[1, 2, 3, 4, 5].map((n) => `<li data-card style="height:80px">Prato ${n}</li>`).join("")}
     </ul>`;

  test("passa com o número certo de colunas", async ({ page }) => {
    const scope = await show(page, grid(2));
    await expectColumns(scope.locator("[data-card]"), 2);
  });

  test("falha com uma coluna a mais", async ({ page }) => {
    const scope = await show(page, grid(3));
    await fails(() => expectColumns(scope.locator("[data-card]"), 2), /3 colunas.*esperava 2/s);
  });
});

test.describe("expectStickyAfterScroll", () => {
  const body = (position: string, barStyle = "overflow-x:auto") =>
    `<nav id="bar" style="position:${position};top:0;height:48px;background:#eee;white-space:nowrap;${barStyle}">
       ${Array.from({ length: 12 }, (_, i) => `<a href="#s${i}" style="display:inline-block;width:120px">Seção ${i}</a>`).join("")}
     </nav>
     <div style="height:3000px">conteúdo</div>`;

  test("passa com a barra presa no topo e rolando só dentro dela", async ({ page }) => {
    await show(page, body("sticky"));
    await expectStickyAfterScroll(page, page.locator("#bar"));
  });

  test("falha quando a barra some ao rolar", async ({ page }) => {
    await show(page, body("static"));
    await fails(() => expectStickyAfterScroll(page, page.locator("#bar")), /não ficou no topo/);
  });

  test("falha quando a barra larga faz a página rolar para o lado", async ({ page }) => {
    await show(page, body("sticky", "overflow-x:visible;width:1440px"));
    await fails(() => expectStickyAfterScroll(page, page.locator("#bar")), /rolagem para o lado/);
  });
});

test.describe("expectReadableAt200", () => {
  test("passa com layout em rem que quebra linha", async ({ page }) => {
    const scope = await show(
      page,
      `<article style="padding:1rem"><h3 style="font-size:1.25rem">Hambúrguer artesanal de costela</h3>
       <button style="min-height:2.75rem;min-width:2.75rem">Adicionar</button></article>`,
    );
    await expectReadableAt200(page, scope);
    expect(await page.evaluate(() => document.documentElement.style.fontSize)).toBe("");
  });

  test("falha quando a letra em 200% não cabe", async ({ page }) => {
    const scope = await show(
      page,
      `<article style="width:20rem"><h3 style="white-space:nowrap">Hambúrguer artesanal de costela</h3></article>`,
    );
    await fails(() => expectReadableAt200(page, scope), /letra em 200%/);
  });
});

test.describe("expectSurvivesRotation", () => {
  const body = (script: string) =>
    `<p id="cart" data-count="2">Carrinho: 2</p><div style="height:1500px"></div><h2 id="alvo">Lanches</h2><div style="height:1500px"></div>
     <script>${script}</script>`;

  test("passa quando o estado e a posição continuam depois de girar", async ({ page }) => {
    await show(page, body(""));
    const anchor = page.locator("#alvo");
    await expectSurvivesRotation(page, () => page.locator("#cart").innerText(), anchor);
    expect(page.viewportSize()).toEqual({ width: 390, height: 844 });
  });

  test("falha quando girar perde o carrinho", async ({ page }) => {
    await show(
      page,
      body(
        `addEventListener("resize", () => { if (innerWidth > innerHeight) document.getElementById("cart").textContent = "Carrinho: 0"; });`,
      ),
    );
    const anchor = page.locator("#alvo");
    await fails(
      () => expectSurvivesRotation(page, () => page.locator("#cart").innerText(), anchor),
      /mudou ao girar/,
    );
  });

  test("falha quando girar perde a posição", async ({ page }) => {
    await show(
      page,
      body(`addEventListener("resize", () => { if (innerWidth > innerHeight) scrollTo(0, 0); });`),
    );
    const anchor = page.locator("#alvo");
    await fails(
      () => expectSurvivesRotation(page, () => page.locator("#cart").innerText(), anchor),
      /saiu da tela ao girar/,
    );
  });
});

test.describe("expectLazyPhotos", () => {
  const photo = (id: string, loading: string, srcset = true) =>
    `<img data-photo alt="${id}" loading="${loading}" width="400" height="300"
        style="display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover"
        src="http://telas.test/fotos/${id}/600.webp"
        ${srcset ? `srcset="http://telas.test/fotos/${id}/300.webp 300w, http://telas.test/fotos/${id}/600.webp 600w, http://telas.test/fotos/${id}/900.webp 900w, http://telas.test/fotos/${id}/1200.webp 1200w" sizes="100vw"` : ""}>`;
  const body = (far: string) => `${photo("perto", "eager")}<div style="height:9000px"></div>${far}`;

  const serve = async (page: Page) => {
    const requested: string[] = [];
    await page.route("http://telas.test/**", async (route) => {
      requested.push(route.request().url());
      await route.fulfill({ contentType: "image/png", body: Buffer.from(PIXEL.split(",")[1]!, "base64") });
    });
    return requested;
  };

  test("passa quando a foto longe só é pedida ao chegar perto", async ({ page }) => {
    await serve(page);
    await show(page, body(photo("longe", "lazy")));
    await expectLazyPhotos(page, page.locator("img[data-photo]"));
  });

  test("falha quando a foto longe é pedida logo de cara", async ({ page }) => {
    await serve(page);
    await show(page, body(photo("longe", "eager")));
    await fails(
      () => expectLazyPhotos(page, page.locator("img[data-photo]")),
      /antes de chegar perto.*longe/s,
    );
  });

  test("falha quando o celular baixa a foto maior que precisa", async ({ page }) => {
    await serve(page);
    await show(page, body(photo("longe", "lazy")).replaceAll('sizes="100vw"', 'sizes="1200px"'));
    await fails(() => expectLazyPhotos(page, page.locator("img[data-photo]")), /maior que precisa/);
  });
});
