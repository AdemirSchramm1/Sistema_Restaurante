"use client";

import { useId, useState } from "react";
import type { ActionState } from "@/actions/_session";
import {
  DENOMINATIONS,
  DENOMINATION_LABELS,
  sumDenominations,
  type Denominations,
} from "@/domain/cash/count";
import { FormError } from "@/components/forms/form-error";
import { useFormAction } from "@/components/forms/use-form-action";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { countsText, moneyField } from "./format";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/** Só as cédulas e moedas com quantidade inteira acima de zero. */
function used(quantities: Record<string, string>): Denominations {
  const out: Denominations = {};
  for (const v of DENOMINATIONS) {
    const n = /^\d+$/.test(quantities[v] ?? "") ? Number(quantities[v]) : 0;
    if (n > 0) out[v] = n;
  }
  return out;
}

/**
 * Contar o dinheiro da gaveta (spec 014, US4-1 e US4-2). O caixa conta **sem ver o esperado**: esta
 * tela não recebe esse valor. A calculadora por cédula e moeda soma e preenche o contado; digitar o
 * total direto zera a calculadora, para a soma e o total nunca discordarem.
 */
export function CountForm({
  sessionId,
  counts,
  outdated = false,
  action,
}: {
  sessionId: string;
  /** Contagens já feitas neste turno, em ordem. */
  counts: string[];
  /** Entrou ou saiu dinheiro depois da última contagem. */
  outdated?: boolean;
  action: Action;
}) {
  const { state, pending, formProps } = useFormAction(action);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [counted, setCounted] = useState("");
  const id = useId();
  const denominations = used(quantities);

  const setQuantity = (value: string, text: string) => {
    const next = { ...quantities, [value]: text };
    setQuantities(next);
    setCounted(moneyField(sumDenominations(used(next))));
  };

  return (
    <form {...formProps} aria-label="Contar o dinheiro da gaveta" className="grid gap-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input
        type="hidden"
        name="denominations"
        value={Object.keys(denominations).length ? JSON.stringify(denominations) : ""}
      />
      {outdated && <Alert>Entrou dinheiro no turno depois da contagem. Conte de novo.</Alert>}
      {counts.length > 0 && <p className="text-sm text-muted-foreground">{countsText(counts)}</p>}
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">
          Quantas cédulas e moedas de cada valor (opcional)
        </legend>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
          {DENOMINATIONS.map((v) => (
            <div key={v} className="flex items-center justify-between gap-2">
              <span aria-hidden="true" className="text-sm font-medium tabular-nums">
                {DENOMINATION_LABELS[v]}
              </span>
              <Input
                aria-label={`Quantas de ${DENOMINATION_LABELS[v]}`}
                inputMode="numeric"
                size="lg"
                className="w-20 text-right"
                value={quantities[v] ?? ""}
                onChange={(e) => setQuantity(v, e.target.value)}
              />
            </div>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-counted`}>Dinheiro contado na gaveta (R$)</Label>
        <Input
          id={`${id}-counted`}
          name="counted"
          inputMode="decimal"
          size="lg"
          className="w-44 text-lg font-semibold"
          value={counted}
          onChange={(e) => {
            setCounted(e.target.value);
            setQuantities({});
          }}
          required
        />
      </div>
      <div>
        <Button type="submit" size="xl" disabled={pending}>
          Confirmar contagem
        </Button>
      </div>
      <FormError error={state && !state.ok ? state.error : null} />
    </form>
  );
}
