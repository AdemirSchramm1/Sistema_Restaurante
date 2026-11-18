import { cn } from "@/lib/utils";
import { photoSrcSet, photoUrl, type Photo } from "@/domain/menu/photo";

/** Largura do cartão em cada tela: 3 colunas no tablet deitado, 2 no tablet em pé, 1 no celular. */
export const CARD_SIZES =
  "(min-width: 1152px) 332px, (min-width: 1024px) calc(33.4vw - 52px), (min-width: 640px) calc(50vw - 56px), calc(100vw - 66px)";

/**
 * Foto do produto no cardápio do cliente (spec 013, US6.3 e US6.10; research R5): sempre 4:3, com
 * largura e altura declaradas para a página não pular, e o navegador escolhe a menor variante que
 * serve. Produto sem foto não desenha nada, nem espaço.
 */
export function ProductPhoto({
  photo,
  name,
  eager = false,
  sizes = CARD_SIZES,
  className,
}: {
  photo: Photo | null;
  name: string;
  /** As primeiras fotos da tela: carregam junto com a página. */
  eager?: boolean;
  sizes?: string;
  /** Largura na linha do celular (spec 016). */
  className?: string;
}) {
  if (!photo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- as variantes já vêm prontas da loja de fotos (research R1)
    <img
      data-photo
      src={photoUrl(photo, photo.widths[0]!)}
      srcSet={photoSrcSet(photo)}
      sizes={sizes}
      width={400}
      height={300}
      alt={name}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={cn("aspect-[4/3] h-auto w-full rounded-lg bg-muted object-cover", className)}
    />
  );
}
