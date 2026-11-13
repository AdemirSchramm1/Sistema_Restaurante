import type { MenuProduct } from "@/application/ordering/menu";
import { Button } from "@/components/ui/button";
import { brl } from "./format";
import { ProductPhoto } from "./product-photo";

/**
 * Cartão do produto no cardápio do cliente (spec 013, US6.3 a US6.5): foto em 4:3 (se houver), nome
 * inteiro, descrição em até 3 linhas, preço e o botão de adicionar. Tocar na foto ou no nome abre a
 * tela do prato, com a foto maior e a descrição inteira.
 */
export function ProductCard({
  product,
  eager,
  onAdd,
  onOpen,
}: {
  product: MenuProduct;
  eager: boolean;
  onAdd: () => void;
  onOpen: () => void;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
      <button
        type="button"
        aria-label={`Ver ${product.name}`}
        onClick={onOpen}
        className="grid min-h-11 gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ProductPhoto photo={product.photo} name={product.name} eager={eager} />
        <h3 className="text-base font-medium leading-snug [overflow-wrap:anywhere]">{product.name}</h3>
      </button>
      {product.description && (
        <p data-clamp className="line-clamp-3 whitespace-pre-line text-sm text-muted-foreground">
          {product.description}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        <span className="text-base font-semibold tabular-nums text-primary">{brl(product.price)}</span>
        <Button
          type="button"
          className="h-auto min-h-11 text-base"
          aria-label={`Adicionar ${product.name}`}
          onClick={onAdd}
        >
          Adicionar
        </Button>
      </div>
    </li>
  );
}
