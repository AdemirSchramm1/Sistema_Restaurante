import type { Appearance } from "@/application/menu/ports";
import { photoSrcSet, photoUrl } from "@/domain/menu/photo";
import { coverGradient } from "@/domain/menu/cover-overlay";
import { cn } from "@/lib/utils";

/**
 * Boas-vindas do tablet da mesa (spec 016, US5-1): a capa e o logo em tela cheia, "Mesa 12" e o
 * botão grande **Ver o cardápio**. É onde o tablet fica quando ninguém está usando.
 */
export function TabletWelcome({
  restaurantName,
  tableName,
  appearance,
  onStart,
}: {
  restaurantName: string;
  tableName: string;
  appearance: Appearance;
  onStart: () => void;
}) {
  const { logo, cover } = appearance;
  const text = cover ? "text-on-photo" : "text-primary-foreground";
  return (
    <section
      aria-label="Boas-vindas"
      className={cn(
        "fixed inset-0 z-40 grid min-h-dvh place-items-center overflow-hidden p-6 text-center",
        !cover && "bg-primary",
      )}
    >
      {cover && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- variantes prontas da loja de fotos */}
          <img
            data-cover
            src={photoUrl(cover, cover.widths.at(-1)!)}
            srcSet={photoSrcSet(cover)}
            sizes="100vw"
            alt=""
            fetchPriority="high"
            className="absolute inset-0 size-full object-cover"
          />
          <div aria-hidden className="absolute inset-0" style={{ backgroundImage: coverGradient() }} />
        </>
      )}
      <div className="relative grid justify-items-center gap-6">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- variantes prontas da loja de fotos
          <img
            src={photoUrl(logo, logo.widths.at(-1)!)}
            srcSet={photoSrcSet(logo)}
            sizes="160px"
            width={160}
            height={160}
            alt={`Logo de ${restaurantName}`}
            className="aspect-square size-40 rounded-2xl bg-on-photo object-cover shadow-lg"
          />
        )}
        <span className={cn("text-lg font-semibold uppercase tracking-[0.16em] [overflow-wrap:anywhere]", text)}>
          {restaurantName}
        </span>
        <h1 className={cn("font-display text-5xl font-semibold tracking-tight", text)}>Mesa {tableName}</h1>
        <button
          type="button"
          onClick={onStart}
          className="h-16 rounded-full bg-primary px-10 text-xl font-semibold text-primary-foreground shadow-lg ring-2 ring-on-photo/70 focus-visible:outline-none focus-visible:ring-4"
        >
          Ver o cardápio
        </button>
      </div>
    </section>
  );
}
