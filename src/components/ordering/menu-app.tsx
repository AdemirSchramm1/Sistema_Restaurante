"use client";

import { useEffect, useRef, useState } from "react";
import type { AccessOrderView, MenuProduct, MenuView } from "@/application/ordering/menu";
import type { CustomerMenu } from "@/domain/menu/customer-menu";
import { normalizeDescription } from "@/domain/inventory/description";
import { Input } from "@/components/ui/input";
import { AccessTimer } from "./access-timer";
import { AutoRefresh } from "./auto-refresh";
import { Cart, type SubmitFn } from "./cart";
import { addToCart, type CartLine } from "./cart-state";
import { DishOptions } from "./dish-options";
import { MyOrders } from "./my-orders";
import { ProductCard } from "./product-card";
import { SectionBar, sectionAnchor } from "./section-bar";

/** Cartões por linha: 1 no celular, 2 a partir de 640 px, 3 a partir de 1024 px (contracts/screens.md). */
const CARDS = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";
/** Quantas fotos carregam junto com a página; as outras, só quando chegam perto da tela (US6.10). */
const EAGER_PHOTOS = 2;

/**
 * Seção que está na tela, para marcar na barra. Vale a última que cruzou a faixa logo abaixo da
 * barra; sair da faixa não desmarca, para a barra nunca ficar sem seção no meio da rolagem.
 */
function useCurrentSection(anchors: readonly string[]): string | null {
  const [current, setCurrent] = useState<string | null>(null);
  const key = anchors.join(" ");
  useEffect(() => {
    if (!key || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.find((e) => e.isIntersecting);
        if (seen) setCurrent(seen.target.id.slice("secao-".length));
      },
      { rootMargin: "-64px 0px -60% 0px" },
    );
    for (const id of key.split(" ")) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [key]);
  return current;
}

/** Abaixo desta linha (a barra de seções) começa o que o cliente está vendo. */
const TOP_LINE = 64;

/**
 * Girar o aparelho muda a largura e a altura de tudo que está acima; sem isto, o cliente cairia em
 * outro ponto do cardápio (spec 013, US6.8). Guarda o primeiro título ou cartão à vista a cada
 * rolagem e volta a ele quando a largura muda. Só a altura mudar (a barra do navegador some ao
 * rolar) não mexe em nada.
 */
function useKeepPlaceOnRotate(): void {
  useEffect(() => {
    let place: Element | null = null;
    let width = window.innerWidth;
    const onScroll = () => {
      place =
        window.scrollY > 0
          ? ([...document.querySelectorAll("[data-place]")].find(
              (el) => el.getBoundingClientRect().bottom > TOP_LINE,
            ) ?? null)
          : null;
    };
    const onResize = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      place?.scrollIntoView({ block: "start" });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);
}

/**
 * Cardápio do cliente, sem login (spec 009 US2/US3, spec 010 US3, spec 013 US6): seções com barra
 * no topo, cartões com foto e descrição, busca, tela do prato com botões, carrinho, tempo do acesso
 * e "Meus pedidos". O carrinho fica no estado desta tela: a atualização automática troca o cardápio
 * sem mexer nele.
 */
export function MenuApp(
  props:
    | { menu: MenuView; orders: AccessOrderView[]; submit: SubmitFn; preview?: false }
    /** Pré-visualização da equipe (spec 013, US5): o mesmo cardápio, sem mesa, sem tempo e sem envio. */
    | { menu: CustomerMenu<MenuProduct>; preview: true },
) {
  const { menu } = props;
  const live = props.preview ? null : props;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [open, setOpen] = useState<MenuProduct | null>(null);
  const [q, setQ] = useState("");
  const search = useRef<HTMLInputElement>(null);
  // Num celular lento, a pessoa pode digitar antes de a página ficar pronta: o que já está no campo vale.
  useEffect(() => {
    const typed = search.current?.value;
    if (typed) setQ(typed);
  }, []);
  const [expired, setExpired] = useState(false);

  const query = normalizeDescription(q);
  const all = menu.sections.flatMap((s) => s.products);
  const shown = query ? all.filter((p) => normalizeDescription(p.name).includes(query)) : all;
  const titled = menu.showSectionTitles && !query && !open && !expired;
  useKeepPlaceOnRotate();
  const current = useCurrentSection(titled ? menu.sections.map((s) => sectionAnchor(s.id)) : []);
  /** As primeiras fotos na ordem da tela. */
  const eager = new Set(
    shown
      .filter((p) => p.photo)
      .slice(0, EAGER_PHOTOS)
      .map((p) => p.id),
  );
  const cards = (products: readonly MenuProduct[]) =>
    products.map((p) => (
      <ProductCard
        key={p.id}
        product={p}
        eager={eager.has(p.id)}
        onAdd={() => add(p)}
        onOpen={() => setOpen(p)}
      />
    ));
  const add = (p: MenuProduct) => {
    if (p.addons.length === 0 && p.removables.length === 0)
      setLines((c) =>
        addToCart(c, {
          productId: p.id,
          name: p.name,
          basePrice: p.price,
          quantity: 1,
          addons: [],
          removals: [],
        }),
      );
    else setOpen(p);
  };

  return (
    <div className="grid grid-cols-1 gap-5">
      {live ? (
        <header className="grid grid-cols-1 gap-1">
          <span className="text-sm font-semibold uppercase tracking-[0.12em] text-primary">
            {live.menu.restaurantName}
          </span>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Mesa {live.menu.tableName}</h1>
          <AccessTimer
            key={live.menu.serverNow}
            serverNow={live.menu.serverNow}
            expiresAt={live.menu.expiresAt}
            unsent={lines.map((l) => ({ name: l.name, quantity: l.quantity }))}
            onExpire={() => setExpired(true)}
          />
        </header>
      ) : (
        <header className="grid grid-cols-1 gap-2">
          <p
            role="status"
            className="rounded-lg bg-warning-soft px-3 py-2 text-center text-sm font-medium text-warning-soft-foreground"
          >
            Pré-visualização: pedidos não são enviados
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Cardápio</h1>
        </header>
      )}

      {live && !expired && <AutoRefresh seconds={10} />}

      {!expired &&
        (open ? (
          <DishOptions
            product={open}
            onClose={() => setOpen(null)}
            onAdd={(line) => {
              setLines((c) => addToCart(c, line));
              setOpen(null);
            }}
          />
        ) : (
          <>
            <Input
              type="search"
              ref={search}
              aria-label="Buscar no cardápio"
              placeholder="Buscar no cardápio"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-11 text-base"
            />
            {titled ? (
              <>
                <SectionBar sections={menu.sections} current={current} />
                {menu.sections.map((section) => (
                  <section key={section.id ?? "outros"} className="grid grid-cols-1 gap-3">
                    <h2
                      id={sectionAnchor(section.id)}
                      data-place
                      className="scroll-mt-20 font-display text-2xl font-semibold tracking-tight"
                    >
                      {section.name}
                    </h2>
                    <ul className={CARDS} aria-label={section.name}>
                      {cards(section.products)}
                    </ul>
                  </section>
                ))}
              </>
            ) : (
              <ul className={CARDS} aria-label="Cardápio">
                {cards(shown)}
                {shown.length === 0 && <li className="text-sm text-muted-foreground">Nada com esse nome.</li>}
              </ul>
            )}
            {!live || live.menu.ordersLeft > 0 ? (
              <Cart lines={lines} onChange={setLines} submit={live?.submit ?? null} />
            ) : (
              <p role="status" className="rounded-xl bg-muted p-4 text-center">
                Chame um garçom para continuar pedindo.
              </p>
            )}
          </>
        ))}

      {live && <MyOrders orders={live.orders} />}
    </div>
  );
}
