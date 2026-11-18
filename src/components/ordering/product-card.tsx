import type { MenuProduct } from "@/application/ordering/menu";
import { brl } from "./format";
import { ProductPhoto } from "./product-photo";
import { QuickAddButton } from "./quick-add-button";

/**
 * Largura da foto em cada layout (spec 016, R10): 112 px na linha do celular; 3 colunas de 600 px
 * até a coluna do carrinho aparecer; 3 e depois 4 colunas ao lado dos 320 px do carrinho.
 */
export const CARD_PHOTO_SIZES =
  "(min-width: 1280px) calc((100vw - 400px) / 4), (min-width: 1024px) calc((100vw - 400px) / 3), (min-width: 600px) calc((100vw - 80px) / 3), 112px";

/**
 * Cartão do produto no cardápio do cliente (spec 013, US6.3 a US6.5; compacto na 016, US2-1). Um
 * só componente para os dois layouts, trocado pela largura no CSS (sem pular na hidratação):
 *
 * - até 599 px, linha: foto 4:3 de 112 px à esquerda, nome e descrição em até 2 linhas, preço e "+";
 * - a partir de 600 px, cartão: foto em cima, o mesmo texto e o "+" no canto de baixo.
 *
 * Tocar na foto ou no nome abre a tela do prato, com a foto maior e a descrição inteira.
 */
export function ProductCard({
  product,
  eager,
  onQuickAdd,
  onOpen,
}: {
  product: MenuProduct;
  eager: boolean;
  onQuickAdd: () => void;
  onOpen: () => void;
}) {
  return (
    <li
      data-place
      className="relative flex min-w-0 scroll-mt-20 items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-xs tab:flex-col tab:items-stretch tab:gap-2"
    >
      <button
        type="button"
        aria-label={`Ver ${product.name}`}
        onClick={onOpen}
        className="flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background tab:flex-col tab:items-stretch tab:gap-2"
      >
        <ProductPhoto
          photo={product.photo}
          name={product.name}
          eager={eager}
          sizes={CARD_PHOTO_SIZES}
          className="w-28 shrink-0 tab:w-full"
        />
        <span className="grid min-w-0 flex-1 grid-cols-1 content-start gap-1">
          <h3
            title={product.name}
            className="line-clamp-2 text-base font-medium leading-snug [overflow-wrap:anywhere]"
          >
            {product.name}
          </h3>
          {product.description && (
            <p data-clamp className="line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">
              {product.description}
            </p>
          )}
          <span className="min-h-11 content-center text-base font-semibold tabular-nums text-primary tab:pr-14">
            {brl(product.price)}
          </span>
        </span>
      </button>
      <span className="tab:absolute tab:bottom-3 tab:right-3">
        <QuickAddButton name={product.name} onClick={onQuickAdd} />
      </span>
    </li>
  );
}
