import type { Locator, Page } from "@playwright/test";

/**
 * Asserções de layout dos testes de tela (spec 013, TDD-003; contracts/screens.md). Cada uma lança
 * um erro que diz o que está errado e em qual elemento. `layout.spec.ts` prova que cada uma falha
 * numa página quebrada de propósito.
 */

/** Menor área de toque aceita (US6.5). Meio pixel de folga para arredondamento. */
const MIN_TAP = 44;
/** Distância abaixo da tela a partir da qual uma foto só pode carregar depois de rolar (US6.10). */
const FAR_BELOW = 4000;

const fail = (issues: string[]) => {
  if (issues.length) throw new Error(issues.join("\n"));
};

const settle = (page: Page) =>
  page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );

/** US6.6: a página não rola para o lado. */
export async function expectNoSideScroll(page: Page): Promise<void> {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    client: document.documentElement.clientWidth,
  }));
  if (scroll > client + 1)
    throw new Error(`rolagem para o lado: o conteúdo tem ${scroll} px e a tela ${client} px`);
}

/**
 * US6.4: nenhum texto é cortado nem sai da tela. Aceita o corte marcado com `data-clamp` (descrição
 * do cartão) e o texto dentro de uma área que rola de propósito (barra de seções).
 */
export async function expectNoClippedText(scope: Locator): Promise<void> {
  fail(
    await scope.evaluate((root) => {
      const issues: string[] = [];
      const clips = (v: string) => v === "hidden" || v === "clip";
      const scrolls = (v: string) => v === "auto" || v === "scroll";
      for (const el of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
        const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
        if (!own || el.closest("[data-clamp]")) continue;
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        if (style.visibility === "hidden" || box.width <= 1 || box.height <= 1) continue;
        const range = document.createRange();
        range.selectNodeContents(el);
        const text = range.getBoundingClientRect();
        const label = `"${(el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60)}"`;
        let clipped = false;
        let scrollable = false;
        for (let a: HTMLElement | null = el as HTMLElement; a; a = a.parentElement) {
          const s = getComputedStyle(a);
          const r = a.getBoundingClientRect();
          if (scrolls(s.overflowX)) {
            scrollable = true;
            break;
          }
          if (clips(s.overflowX) && (text.right > r.right + 1 || text.left < r.left - 1)) clipped = true;
          if (clips(s.overflowY) && (text.bottom > r.bottom + 1 || text.top < r.top - 1)) clipped = true;
        }
        if (clipped) issues.push(`texto cortado: ${label}`);
        else if (!scrollable && (text.right > innerWidth + 1 || text.left < -1))
          issues.push(`texto fora da tela: ${label}`);
      }
      return issues;
    }),
  );
}

type Target = { name: string; x: number; y: number; w: number; h: number; layer: number; path: number[] };

/** Botões, links e campos visíveis, com a caixa que a pessoa toca. Link no meio de uma frase não conta. */
async function tapTargets(scope: Locator): Promise<Target[]> {
  return scope.evaluate((root) => {
    const selector =
      "a[href], button, input, select, textarea, summary, [role=button], [role=link], [role=tab], [role=switch], [role=checkbox]";
    const layers: Element[] = [];
    const out: Target[] = [];
    const all = [...document.querySelectorAll("*")];
    for (const el of root.querySelectorAll<HTMLElement>(selector)) {
      if (el instanceof HTMLInputElement && el.type === "hidden") continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      let box: Element = el;
      if (el instanceof HTMLInputElement && ["checkbox", "radio", "file"].includes(el.type)) {
        const label = el.closest("label") ?? (el.id ? document.querySelector(`label[for="${el.id}"]`) : null);
        if (label) box = label;
      }
      const r = box.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1) continue;
      const inline =
        el.tagName === "A" &&
        style.display === "inline" &&
        [...(el.parentElement?.childNodes ?? [])].some(
          (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
        );
      if (inline) continue;
      let layerEl: Element | null = null;
      for (let a: Element | null = el; a; a = a.parentElement) {
        const p = getComputedStyle(a).position;
        if (p === "fixed" || p === "sticky") {
          layerEl = a;
          break;
        }
      }
      if (layerEl && !layers.includes(layerEl)) layers.push(layerEl);
      const path: number[] = [];
      for (let a: Element | null = box; a; a = a.parentElement) path.push(all.indexOf(a));
      out.push({
        name: (
          el.getAttribute("aria-label") ||
          el.textContent?.trim() ||
          (box !== el ? box.textContent?.trim() : "") ||
          el.getAttribute("name") ||
          el.tagName.toLowerCase()
        )
          .replace(/\s+/g, " ")
          .slice(0, 40),
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        layer: layerEl ? layers.indexOf(layerEl) + 1 : 0,
        path,
      });
    }
    return out;
  });
}

function overlaps(targets: Target[]): string[] {
  const issues: string[] = [];
  for (let i = 0; i < targets.length; i++)
    for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i]!;
      const b = targets[j]!;
      // Camadas diferentes (barra presa no topo sobre o conteúdo) e um dentro do outro não contam.
      if (a.layer !== b.layer || a.path.includes(b.path[0]!) || b.path.includes(a.path[0]!)) continue;
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (w > 1 && h > 1) issues.push(`toques sobrepostos: ${a.name} e ${b.name}`);
    }
  return issues;
}

/** US6.5: nenhuma área de toque fica sobre outra. */
export async function expectNoOverlap(scope: Locator): Promise<void> {
  fail(overlaps(await tapTargets(scope)));
}

/** US6.5: toda área de toque tem pelo menos 44 × 44 px e nenhuma fica sobre outra. */
export async function expectTapTargets(scope: Locator): Promise<void> {
  const targets = await tapTargets(scope);
  const small = targets
    .filter((t) => t.w < MIN_TAP - 0.5 || t.h < MIN_TAP - 0.5)
    .map((t) => `toque menor que ${MIN_TAP} px: ${t.name} (${Math.round(t.w)} × ${Math.round(t.h)})`);
  fail([...small, ...overlaps(targets)]);
}

/** US6.3: toda foto de produto (`img[data-photo]`) aparece em 4:3, sem deformar, com texto alternativo. */
export async function expectPhotoRatio(scope: Locator): Promise<void> {
  fail(
    await scope.evaluate((root) => {
      const photos = [...root.querySelectorAll<HTMLImageElement>("img[data-photo]")];
      if (!photos.length) return ["nenhuma foto para conferir"];
      const issues: string[] = [];
      for (const img of photos) {
        const r = img.getBoundingClientRect();
        const name = img.alt.trim() || img.currentSrc || "(sem nome)";
        if (!img.alt.trim()) issues.push(`foto sem texto alternativo: ${name}`);
        if (Math.abs(r.width * 3 - r.height * 4) > 6)
          issues.push(
            `foto fora da proporção 4:3: ${name} (${Math.round(r.width)} × ${Math.round(r.height)})`,
          );
        const fit = getComputedStyle(img).objectFit;
        if (fit !== "cover") issues.push(`foto com object-fit ${fit} (deforma): ${name}`);
      }
      return issues;
    }),
  );
}

/** US6.3: nenhuma imagem quebrada. Foto que ainda não foi pedida (carregamento sob demanda) não conta. */
export async function expectNoBrokenImage(scope: Locator): Promise<void> {
  fail(
    await scope.evaluate(async (root) => {
      const imgs = [...root.querySelectorAll("img")];
      await Promise.all(
        imgs
          .filter((i) => !i.complete && i.loading !== "lazy")
          .map((i) => new Promise((r) => (i.onload = i.onerror = r))),
      );
      return imgs
        .filter((i) => i.complete && i.naturalWidth === 0)
        .map((i) => `imagem quebrada: ${i.alt || i.src.slice(0, 60)}`);
    }),
  );
}

/** US6.2: os cartões da primeira linha ocupam `n` colunas. */
export async function expectColumns(cards: Locator, n: number): Promise<void> {
  const columns = await cards.evaluateAll((els) => {
    const rects = els.map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
    if (!rects.length) return 0;
    const top = Math.min(...rects.map((r) => r.top));
    return new Set(rects.filter((r) => r.top < top + r.height / 2).map((r) => Math.round(r.left))).size;
  });
  if (columns !== n) throw new Error(`${columns} colunas na primeira linha, esperava ${n}`);
}

/** US6.1: a barra continua no topo depois de rolar, e rolar a barra para o lado não rola a página. */
export async function expectStickyAfterScroll(page: Page, bar: Locator): Promise<void> {
  try {
    await page.evaluate(() => scrollTo(0, 600));
    await settle(page);
    const box = await bar.boundingBox();
    const height = page.viewportSize()!.height;
    if (!box || box.y < -1 || box.y + box.height > height / 2)
      throw new Error(
        `a barra não ficou no topo depois de rolar (y = ${box ? Math.round(box.y) : "sem caixa"})`,
      );
    await bar.evaluate((el) => (el.scrollLeft = el.scrollWidth));
    await settle(page);
    const scrollX = await page.evaluate(() => scrollX);
    if (scrollX !== 0) throw new Error("rolagem para o lado: rolar a barra rolou a página");
    await expectNoSideScroll(page);
  } finally {
    await bar.evaluate((el) => (el.scrollLeft = 0));
    await page.evaluate(() => scrollTo(0, 0));
  }
}

/** US6.7: com a letra em 200%, nada rola para o lado, é cortado ou fica sobreposto. */
export async function expectReadableAt200(page: Page, scope: Locator): Promise<void> {
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  await settle(page);
  try {
    await expectNoSideScroll(page);
    await expectNoClippedText(scope);
    await expectNoOverlap(scope);
  } catch (e) {
    throw new Error(`com a letra em 200%: ${(e as Error).message}`);
  } finally {
    await page.evaluate(() => (document.documentElement.style.fontSize = ""));
    await settle(page);
  }
}

/**
 * US6.8: girar o aparelho (largura ↔ altura) mantém o estado lido por `state` (o carrinho) e deixa
 * `anchor` ainda na tela. A asserção põe `anchor` no topo da tela antes de girar.
 */
export async function expectSurvivesRotation(
  page: Page,
  state: () => Promise<string>,
  anchor: Locator,
): Promise<void> {
  const size = page.viewportSize()!;
  // O que conta como "à vista" é o que está no topo da tela: é o que o aparelho mantém ao girar.
  await anchor.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await settle(page);
  const before = await state();
  try {
    await page.setViewportSize({ width: size.height, height: size.width });
    await page.waitForFunction((w) => innerWidth === w, size.height);
    await settle(page);
    // Folga para o que a página faz ao girar (o WebKit avisa a página do giro um pouco depois).
    await page.waitForTimeout(300);
    const after = await state();
    if (after !== before) throw new Error(`o estado mudou ao girar: era "${before}", ficou "${after}"`);
    const box = await anchor.boundingBox();
    if (!box || box.y + box.height < 0 || box.y > size.width)
      throw new Error(
        `o que estava à vista saiu da tela ao girar (y = ${box ? Math.round(box.y) : "sem caixa"})`,
      );
  } finally {
    await page.setViewportSize(size);
    await settle(page);
  }
}

/**
 * US6.10: foto longe da tela só é pedida ao chegar perto, e a foto pedida é a menor do `srcset`
 * que cobre a largura desenhada × densidade da tela.
 */
export async function expectLazyPhotos(page: Page, photos: Locator): Promise<void> {
  await page.waitForLoadState("load");
  await settle(page);
  const early = await photos.evaluateAll(
    (imgs, far) =>
      (imgs as HTMLImageElement[])
        .filter((i) => i.getBoundingClientRect().top > innerHeight + far && i.complete && i.naturalWidth > 0)
        .map((i) => i.alt || i.src),
    FAR_BELOW,
  );
  if (early.length) throw new Error(`foto pedida antes de chegar perto: ${early.join(", ")}`);
  try {
    const count = await photos.count();
    for (let n = 0; n < count; n++) {
      const img = photos.nth(n);
      await img.scrollIntoViewIfNeeded();
      const loaded = await img
        .evaluate(
          (i: HTMLImageElement) =>
            new Promise<boolean>((resolve) => {
              const done = () => resolve(i.naturalWidth > 0);
              if (i.complete) return done();
              i.addEventListener("load", done, { once: true });
              i.addEventListener("error", done, { once: true });
              setTimeout(() => resolve(false), 5000);
            }),
        )
        .catch(() => false);
      if (!loaded) throw new Error(`a foto ${n + 1} não carregou ao chegar perto`);
    }
    fail(
      await photos.evaluateAll((imgs) =>
        (imgs as HTMLImageElement[]).flatMap((i) => {
          const widths = [...i.srcset.matchAll(/(\S+)\s+(\d+)w/g)].map((m) => ({
            url: new URL(m[1]!, location.href).href,
            w: Number.parseInt(m[2]!, 10),
          }));
          const chosen = widths.find((c) => c.url === i.currentSrc);
          if (!chosen) return [];
          const needed = i.getBoundingClientRect().width * devicePixelRatio;
          const best =
            widths
              .map((c) => c.w)
              .sort((a, b) => a - b)
              .find((w) => w >= needed - 1) ?? chosen.w;
          return chosen.w > best
            ? [`foto maior que precisa: ${i.alt} baixou ${chosen.w} px para ${Math.round(needed)} px`]
            : [];
        }),
      ),
    );
  } finally {
    await page.evaluate(() => scrollTo(0, 0));
  }
}
