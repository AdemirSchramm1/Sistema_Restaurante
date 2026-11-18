"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Âncora do título da seção; "Outros" não tem id. */
export const sectionAnchor = (id: string | null): string => `secao-${id ?? "outros"}`;

/**
 * Abas em até 2 linhas a partir de 600 px (spec 016, US2-5, R10). Passando de 2 linhas, vira uma
 * linha só que rola; volta a quebrar quando a largura muda (girar o tablet).
 */
function useWrapUpToTwoRows() {
  const ref = useRef<HTMLUListElement>(null);
  const [wrap, setWrap] = useState(true);
  useEffect(() => {
    const ul = ref.current;
    if (!ul || typeof ResizeObserver === "undefined") return;
    let width = -1;
    const observer = new ResizeObserver(() => {
      const rows = new Set([...ul.children].map((li) => (li as HTMLElement).offsetTop)).size;
      if (rows > 2) setWrap(false);
      else if (ul.clientWidth !== width) setWrap(true);
      width = ul.clientWidth;
    });
    observer.observe(ul);
    return () => observer.disconnect();
  }, []);
  return { ref, wrap };
}

/**
 * Barra de seções do cardápio do cliente (spec 013, US6.1): fica presa no topo; no celular, com
 * muitas seções, rola para o lado só dentro dela, sem rolar a página.
 */
export function SectionBar({
  sections,
  current,
  onPick,
}: {
  sections: readonly { id: string | null; name: string }[];
  /** Tocou numa seção: ela fica marcada mesmo que a página não role até ela. */
  onPick?: (current: string) => void;
  /** Seção que está na tela: o id dela, "outros", ou `null` antes de rolar. */
  current: string | null;
}) {
  const { ref, wrap } = useWrapUpToTwoRows();
  return (
    <nav
      aria-label="Seções do cardápio"
      className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 backdrop-blur"
    >
      <ul
        ref={ref}
        data-wrap={wrap}
        className={cn("flex gap-2 overflow-x-auto overscroll-x-contain py-2", wrap && "tab:flex-wrap")}
      >
        {sections.map((s) => {
          const active = current === (s.id ?? "outros");
          return (
            <li key={s.id ?? "outros"} className="shrink-0">
              <a
                href={`#${sectionAnchor(s.id)}`}
                aria-current={active ? "true" : undefined}
                onClick={() => onPick?.(s.id ?? "outros")}
                className={cn(
                  "inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-4 text-base font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                {s.name}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
