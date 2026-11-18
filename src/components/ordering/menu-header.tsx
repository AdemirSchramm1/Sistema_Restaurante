import type { ReactNode } from "react";
import type { Appearance } from "@/application/menu/ports";
import { photoSrcSet, photoUrl } from "@/domain/menu/photo";
import { coverGradient } from "@/domain/menu/cover-overlay";
import { cn } from "@/lib/utils";

/**
 * Topo do cardápio com a cara do restaurante (spec 016, US1, R9): a capa com a camada escura, o
 * logo, o nome e a mesa em branco embaixo. 120 px no celular e 160 px a partir de 600 px; ao rolar
 * ele sai e fica a barra de seções. Sem capa, a cor principal; sem logo, só o nome.
 */
export function MenuHeader({
  restaurantName,
  title,
  appearance,
  children,
}: {
  restaurantName: string;
  /** "Mesa 12", ou "Cardápio" na pré-visualização. */
  title: string;
  appearance: Appearance;
  children?: ReactNode;
}) {
  const { logo, cover } = appearance;
  const text = cover ? "text-on-photo" : "text-primary-foreground";
  return (
    <div className="grid grid-cols-1 gap-2">
      <header
        className={cn(
          "relative -mx-4 flex min-h-30 items-end overflow-hidden px-4 pb-3 tab:mx-0 tab:min-h-40 tab:rounded-xl",
          !cover && "bg-primary",
        )}
      >
        {cover && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- variantes prontas da loja de fotos */}
            <img
              data-cover
              src={photoUrl(cover, cover.widths[0]!)}
              srcSet={photoSrcSet(cover)}
              sizes="100vw"
              alt=""
              fetchPriority="high"
              className="absolute inset-0 size-full object-cover"
            />
            <div
              data-overlay
              aria-hidden
              className="absolute inset-0"
              style={{ backgroundImage: coverGradient() }}
            />
          </>
        )}
        <div className="relative flex min-w-0 items-center gap-3">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element -- variantes prontas da loja de fotos
            <img
              src={photoUrl(logo, logo.widths[0]!)}
              srcSet={photoSrcSet(logo)}
              sizes="(min-width: 600px) 80px, 64px"
              width={64}
              height={64}
              alt={`Logo de ${restaurantName}`}
              className="aspect-square size-16 shrink-0 rounded-lg bg-on-photo object-cover shadow-sm tab:size-20"
            />
          )}
          <div className="grid min-w-0 grid-cols-1">
            <span
              className={cn(
                "text-sm font-semibold uppercase tracking-[0.12em] [overflow-wrap:anywhere]",
                text,
              )}
            >
              {restaurantName}
            </span>
            <h1 className={cn("font-display text-3xl font-semibold tracking-tight [overflow-wrap:anywhere]", text)}>{title}</h1>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
