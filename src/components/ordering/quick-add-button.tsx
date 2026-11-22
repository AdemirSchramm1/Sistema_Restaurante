import { Button } from "@/components/ui/button";

/** "+" do cartão (spec 016, US2-6): 44 × 44 px, com o nome do prato para o leitor de tela. */
export function QuickAddButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      size="icon"
      className="size-11 shrink-0 rounded-full text-2xl leading-none"
      aria-label={`Pôr ${name} no carrinho`}
      onClick={onClick}
    >
      +
    </Button>
  );
}
