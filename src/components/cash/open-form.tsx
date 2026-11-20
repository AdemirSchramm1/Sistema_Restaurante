"use client";

import { useId, useState } from "react";
import type { ActionState } from "@/actions/_session";
import { CASH_NOTE_MAX } from "@/domain/cash/session";
import { d } from "@/domain/shared/decimal";
import { FormError } from "@/components/forms/form-error";
import { useFormAction } from "@/components/forms/use-form-action";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { brl } from "@/components/ordering/format";
import { moneyField, parsedMoney } from "./format";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

/**
 * Abrir o caixa com o troco (spec 014, US1-2 e US1-3). O campo vem com o que ficou na gaveta no
 * último fechamento; se o caixa muda o valor, a tela pede o porquê. O id da abertura é o mesmo
 * enquanto o formulário está na tela: o toque duplo não abre dois turnos.
 */
export function OpenForm({
  previousKept,
  action,
  children,
}: {
  previousKept: string | null;
  action: Action;
  /** Botões ao lado de "Abrir caixa" (Voltar). */
  children?: React.ReactNode;
}) {
  const { state, pending, formProps } = useFormAction(action);
  const [float, setFloat] = useState(() => moneyField(previousKept ?? "0"));
  const [requestId] = useState(() => crypto.randomUUID());
  const id = useId();
  const value = parsedMoney(float);
  const differs = previousKept !== null && value !== null && !value.equals(d(previousKept));
  return (
    <form {...formProps} aria-label="Abrir o caixa" className="grid gap-3">
      <input type="hidden" name="clientRequestId" value={requestId} />
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-float`}>Troco inicial (R$)</Label>
        <Input
          id={`${id}-float`}
          name="openingFloat"
          inputMode="decimal"
          size="lg"
          className="w-40"
          value={float}
          onChange={(e) => setFloat(e.target.value)}
          required
        />
        <p className="text-sm text-muted-foreground">O dinheiro que está na gaveta agora, para dar troco.</p>
      </div>
      {differs && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-note`}>Por que o troco é outro?</Label>
          <Input id={`${id}-note`} name="note" size="lg" maxLength={CASH_NOTE_MAX} required />
          <p className="text-sm text-muted-foreground">
            {`Ficaram ${brl(previousKept)} na gaveta no último fechamento. Por que o troco é outro?`}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="xl" disabled={pending}>
          Abrir caixa
        </Button>
        {children}
      </div>
      <FormError error={state && !state.ok ? state.error : null} />
    </form>
  );
}
