"use client";

import type { ActionState } from "@/actions/_session";
import { useFormAction } from "@/components/forms/use-form-action";
import { FormError } from "@/components/forms/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type SalePriceProps = {
  id: string;
  version: number;
  /** Já formatado com vírgula; null = sem preço. */
  salePrice: string | null;
  /** Textos prontos ("R$ 8,50", "30,4%"); null quando não dá para calcular. */
  costText: string | null;
  shareText: string | null;
  bandLabel: string | null;
  marginText: string | null;
  marginNegative: boolean;
  canEdit: boolean;
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
};

/** Quadro "Preço de venda" da página do produto vendido (spec 008, US1). */
export function SalePrice(p: SalePriceProps) {
  const { state, pending, formProps } = useFormAction(p.action);
  return (
    <Card className="grid gap-2 text-sm">
      <CardTitle>Preço de venda</CardTitle>
      {p.canEdit ? (
        <form {...formProps} className="grid gap-2">
          <input type="hidden" name="id" value={p.id} />
          <input type="hidden" name="version" value={p.version} />
          <label htmlFor="sale-price" className="font-medium">
            Vendo por (R$)
          </label>
          <Input
            id="sale-price"
            name="salePrice"
            inputMode="decimal"
            placeholder="Ex.: 28,00 (em branco = sem preço)"
            defaultValue={p.salePrice ?? ""}
            aria-invalid={state && !state.ok ? true : undefined}
          />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            Salvar preço
          </Button>
          <FormError error={state && !state.ok ? state.error : null} />
          {state?.ok && <p role="status">Preço salvo.</p>}
        </form>
      ) : (
        <p>{p.salePrice ? `Vendo por R$ ${p.salePrice}` : "Sem preço de venda."}</p>
      )}
      {p.costText === null ? (
        <p className="text-muted-foreground">O custo aparece depois da primeira compra dos itens.</p>
      ) : p.shareText === null ? (
        <p className="text-muted-foreground">
          Custa {p.costText}. Informe o preço para ver quanto dele vai em ingredientes.
        </p>
      ) : (
        <div className="grid gap-1 rounded-md bg-muted p-3">
          <p>
            Custa {p.costText}:{" "}
            <strong>
              {p.shareText} do preço vai em ingredientes ({p.bandLabel})
            </strong>
            .
          </p>
          <p className={p.marginNegative ? "font-medium text-red-800" : undefined}>
            {p.marginNegative ? `Prejuízo de ${p.marginText} por venda.` : `Sobra ${p.marginText} por venda.`}
          </p>
          <p className="text-muted-foreground">
            A faixa comum vai até 35%; acima de 40% sobra pouco para o resto.
          </p>
        </div>
      )}
    </Card>
  );
}
