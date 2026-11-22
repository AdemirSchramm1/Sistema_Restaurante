import { Button } from "@/components/ui/button";
import { cartTotal, itemCount, type CartLine } from "./cart-state";
import { brl } from "./format";

/** "3 itens" ou "1 item". */
export const itemsText = (n: number) => (n === 1 ? "1 item" : `${n} itens`);

/**
 * Barra do carrinho presa no pé da tela estreita (spec 016, US3-2): quantos itens e o total sempre
 * à vista; tocar abre o carrinho por cima do cardápio. Na tela larga o carrinho fica ao lado.
 */
export function CartBar({ lines, onOpen }: { lines: readonly CartLine[]; onOpen: () => void }) {
  if (lines.length === 0) return null;
  return (
    <div
      data-testid="cart-bar"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden"
    >
      <Button
        type="button"
        size="xl"
        className="h-auto min-h-12 w-full whitespace-normal py-2"
        onClick={onOpen}
      >
        Ver pedido · {itemsText(itemCount(lines))} · {brl(cartTotal(lines))}
      </Button>
    </div>
  );
}
