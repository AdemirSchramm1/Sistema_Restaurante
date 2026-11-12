import { formatBrDecimal, type Decimal } from "@/domain/shared/decimal";
import { Alert } from "@/components/ui/alert";

/**
 * Saldo do item na sua medida. Negativo só acontece pela venda (spec 011, FR-007): o aviso vem em
 * texto, não só em cor.
 */
export function StockBalance({ balance, unit }: { balance: Decimal; unit: string }) {
  const negative = balance.lt(0);
  return (
    <>
      <p className="text-base" data-testid="item-balance">
        Em estoque:{" "}
        <strong className={negative ? "text-destructive" : undefined}>
          {formatBrDecimal(balance, { maxPlaces: 4 })} {unit}
        </strong>
      </p>
      {negative && (
        <Alert tone="warning" role="alert">
          O estoque está menor que o que o sistema esperava. Lance a compra que faltou ou peça um acerto.
        </Alert>
      )}
    </>
  );
}
