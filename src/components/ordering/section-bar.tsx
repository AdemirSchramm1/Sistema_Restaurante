import { cn } from "@/lib/utils";

/** Âncora do título da seção; "Outros" não tem id. */
export const sectionAnchor = (id: string | null): string => `secao-${id ?? "outros"}`;

/**
 * Barra de seções do cardápio do cliente (spec 013, US6.1): fica presa no topo; com muitas seções,
 * rola para o lado só dentro dela, sem rolar a página.
 */
export function SectionBar({
  sections,
  current,
}: {
  sections: readonly { id: string | null; name: string }[];
  /** Seção que está na tela: o id dela, "outros", ou `null` antes de rolar. */
  current: string | null;
}) {
  return (
    <nav
      aria-label="Seções do cardápio"
      className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 backdrop-blur"
    >
      <ul className="flex gap-2 overflow-x-auto overscroll-x-contain py-2">
        {sections.map((s) => {
          const active = current === (s.id ?? "outros");
          return (
            <li key={s.id ?? "outros"} className="shrink-0">
              <a
                href={`#${sectionAnchor(s.id)}`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-4 text-base font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
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
